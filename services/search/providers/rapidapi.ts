import { FlightResult, FlightSource } from "@/types/hybridFlight";

export async function searchSkyScrapper(params: { 
  origin: string, 
  destination: string, 
  date: string, 
  currency?: string,
  cabinClass?: string,
  adults?: number
}): Promise<FlightResult[]> {
  const apiKey = process.env.RAPID_API_KEY_SKY || 'a5019e6badmsh72c554c174620e5p18995ajsnd5606f30e000';
  const apiHost = process.env.RAPID_API_HOST_SKY || 'flights-sky.p.rapidapi.com';
  
  // Tarih Düzeltmesi
  let targetDate = params.date.includes('T') ? params.date.split('T')[0] : params.date;
  if (targetDate.startsWith('2025')) targetDate = targetDate.replace('2025', '2026');

  const url = `https://${apiHost}/web/flights/search-one-way`;

  try {
    // 1. KABİN SINIFI AYARI (API Büyük Harf İster)
    const cabin = (params.cabinClass || 'ECONOMY').toUpperCase();

    // 2. YOLCU SAYISI AYARI
    const adultCount = (params.adults || 1).toString();

    // 3. MARKET AYARI (Para birimine göre otomatik)
    const currency = params.currency || 'AUD';
    const market = currency === 'AUD' ? 'AU' : 'US';

    console.log(`🚀 [SKY] UÇUŞ ARAMA: ${params.origin} -> ${params.destination} (${targetDate}) | ${cabin}, ${adultCount} yolcu`);

    const queryParams = new URLSearchParams({
      placeIdFrom: params.origin,
      placeIdTo: params.destination,
      departDate: targetDate, 
      market: market,
      locale: 'en-US',
      currency: currency,
      adults: adultCount,
      cabinClass: cabin
    });

    const fullUrl = `${url}?${queryParams.toString()}`;
    console.log(`[SKY] 📍 API URL: ${fullUrl}`);

    const res = await fetch(fullUrl, {
      method: 'GET',
      headers: { 
        'X-RapidAPI-Key': apiKey, 
        'X-RapidAPI-Host': apiHost 
      }
    });

    console.log(`[SKY] 📊 Response Status: ${res.status}`);

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[SKY] 🔥 HATA (${res.status}):`, errText.substring(0, 500));
      return [];
    }

    const json = await res.json();
    
    // 🕵️‍♂️ VERİ MADENCİLİĞİ: Uçuşlar nerede saklanıyor?
    let items: any[] = [];
    const itineraries = json.data?.itineraries || json.itineraries;

    if (itineraries) {
        // DURUM 1: 'buckets' yapısı (Web API genelde bunu kullanır)
        if (itineraries.buckets && Array.isArray(itineraries.buckets)) {
            console.log("📦 'Buckets' yapısı bulundu, uçuşlar toplanıyor...");
            itineraries.buckets.forEach((bucket: any) => {
                if (bucket.items && Array.isArray(bucket.items)) {
                    items.push(...bucket.items);
                }
            });
        } 
        // DURUM 2: Direkt 'results' listesi
        else if (itineraries.results && Array.isArray(itineraries.results)) {
            console.log("📄 'Results' listesi bulundu...");
            items = itineraries.results;
        } 
        // DURUM 3: Direkt kendisi bir liste
        else if (Array.isArray(itineraries)) {
            console.log("📋 Direct array found...");
            items = itineraries;
        }
    }

    // Çift kayıtları temizle
    const uniqueItems = Array.from(new Map(items.map(item => [item.id, item])).values());

    console.log(`✅ SONUÇ: ${uniqueItems.length} benzersiz uçuş bulundu.`);

    return uniqueItems.map((item: any) => {
      // Satıcıları Topla
      const agents = item.pricingOptions?.map((opt: any) => ({
        name: opt.agent?.name,           
        price: opt.price?.amount,        
        image: opt.agent?.imageUrl,      
        url: opt.items?.[0]?.url 
      })) || [];

      agents.sort((a: any, b: any) => (a.price || 0) - (b.price || 0));
      const bestAgentWithUrl = agents.find((a: any) => a.url && a.url.startsWith('http'));
      const firstLeg = item.legs?.[0];

      return {
        id: `SKY_${item.id || Math.random()}`,
        source: 'SKY_SCANNER_PRO' as FlightSource,
        airline: firstLeg?.carriers?.marketing?.[0]?.name || "Airline",
        airlineLogo: firstLeg?.carriers?.marketing?.[0]?.logoUrl,
        flightNumber: firstLeg?.carriers?.marketing?.[0]?.alternateId || "FLY",
        
        from: params.origin,
        to: params.destination,
        departTime: firstLeg?.departure,
        arriveTime: firstLeg?.arrival,
        duration: firstLeg?.durationInMinutes || 0,
        stops: firstLeg?.stopCount || 0,
        
        price: agents[0]?.price || item.price?.raw || 0,
        currency: currency,
        cabinClass: cabin.toLowerCase() as any,
        
        // Frontend listesi için booking providers
        bookingProviders: agents.map((a: any) => ({
          name: a.name || 'Unknown',
          price: a.price || 0,
          currency: currency,
          link: a.url || '',
          logo: a.image,
          type: 'agency' as const
        })),
        
        // Link varsa koy, yoksa undefined
        deepLink: bestAgentWithUrl ? bestAgentWithUrl.url : undefined,
        bookingLink: bestAgentWithUrl ? bestAgentWithUrl.url : undefined
      };
    });

  } catch (error: any) {
    console.error("🔥 CATCH HATASI:", error.message);
    return [];
  }
}

export async function searchAirScraper(params: any) {
    return []; // Placeholder
}

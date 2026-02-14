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
  
  let targetDate = params.date.includes('T') ? params.date.split('T')[0] : params.date;
  if (targetDate.startsWith('2025')) targetDate = targetDate.replace('2025', '2026');

  const searchUrl = `https://${apiHost}/web/flights/search-one-way`;
  const incompleteUrl = `https://${apiHost}/web/flights/search-incomplete`;

  try {
    const cabin = (params.cabinClass || 'ECONOMY').toUpperCase();
    const adultCount = (params.adults || 1).toString();
    const currency = params.currency || 'AUD';
    const market = currency === 'AUD' ? 'AU' : 'US';

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

    console.log(`🚀 API İsteği (İlk Parti): ${searchUrl}?${queryParams.toString()}`);

    // 1. İLK İSTEK
    let res = await fetch(`${searchUrl}?${queryParams.toString()}`, {
      method: 'GET',
      headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': apiHost }
    });

    if (!res.ok) return [];

    let json = await res.json();
    let allItems: any[] = extractFlights(json);
    
    // Durum kontrolü
    let status = json.data?.context?.status || 'complete';
    let sessionId = json.data?.context?.sessionId;
    let loopCount = 0;

    console.log(`📊 İlk tur: ${allItems.length} uçuş, Status: ${status}`);

    // 2. DÖNGÜ: "incomplete" olduğu sürece devam et (Max 5 kere dene)
    while (status === 'incomplete' && sessionId && loopCount < 5) {
        loopCount++;
        console.log(`⏳ Yükleniyor... Tur: ${loopCount} (Şu anki: ${allItems.length} uçuş)`);
        
        // 1.5 saniye bekle (API'yi boğmamak için)
        await new Promise(r => setTimeout(r, 1500));

        const nextParams = new URLSearchParams({ sessionId: sessionId });
        
        res = await fetch(`${incompleteUrl}?${nextParams.toString()}`, {
            method: 'GET',
            headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': apiHost }
        });

        if (!res.ok) break;

        json = await res.json();
        
        // Yeni gelenleri ekle
        const newItems = extractFlights(json);
        if (newItems.length > 0) {
            allItems = [...allItems, ...newItems];
            console.log(`✅ Tur ${loopCount}: +${newItems.length} uçuş (Toplam: ${allItems.length})`);
        }

        // Durumu güncelle
        status = json.data?.context?.status || 'complete';
    }

    // 3. ÇİFT KAYITLARI TEMİZLE
    const uniqueItems = Array.from(new Map(allItems.map(item => [item.id, item])).values());

    console.log(`✅ TOPLAM SONUÇ: ${uniqueItems.length} benzersiz uçuş bulundu! 🎉`);

    return uniqueItems.map((item: any) => {
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
        
        bookingProviders: agents.map((a: any) => ({
          name: a.name || 'Unknown',
          price: a.price || 0,
          currency: currency,
          link: a.url || '',
          logo: a.image,
          type: 'agency' as const
        })),
        
        deepLink: bestAgentWithUrl ? bestAgentWithUrl.url : undefined,
        bookingLink: bestAgentWithUrl ? bestAgentWithUrl.url : undefined
      };
    });

  } catch (error: any) {
    console.error("🔥 CATCH HATASI:", error.message);
    return [];
  }
}

// 🕵️‍♂️ YARDIMCI FONKSİYON: JSON'dan Uçuşları Çıkarır
function extractFlights(json: any) {
    let items: any[] = [];
    const itineraries = json.data?.itineraries || json.itineraries;

    if (itineraries) {
        // Bucket yapısı
        if (itineraries.buckets && Array.isArray(itineraries.buckets)) {
            itineraries.buckets.forEach((bucket: any) => {
                if (bucket.items && Array.isArray(bucket.items)) {
                    items.push(...bucket.items);
                }
            });
        } 
        // Results Listesi
        else if (itineraries.results && Array.isArray(itineraries.results)) {
            items = itineraries.results;
        } 
        // Direkt Liste
        else if (Array.isArray(itineraries)) {
            items = itineraries;
        }
    }
    return items;
}

export async function searchAirScraper(params: any) {
    return []; // Placeholder
}

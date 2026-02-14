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
    
    console.log(`[SKY] 📡 Response Keys: ${Object.keys(json).join(', ')}`);
    
    let items = json.data?.itineraries || [];
    console.log(`[SKY] ✓ Found ${items.length} itineraries`);
    
    if (items.length === 0) {
      console.warn(`[SKY] ⚠️ Response Dump:`, JSON.stringify(json).substring(0, 1000));
      return [];
    }

    console.log(`[SKY] ✅ SONUÇ: ${items.length} uçuş bulundu.`);

    return items.map((item: any, idx: number) => {
      
      // Satıcıları Topla (Trip.com, Aunt Betty, Gotogate, vb.)
      const agents = item.pricingOptions?.map((opt: any) => ({
        name: opt.agent?.name || "Provider",
        price: opt.price?.amount,        
        image: opt.agent?.imageUrl,      
        url: opt.items?.[0]?.url 
      })) || [];

      agents.sort((a: any, b: any) => (a.price || 0) - (b.price || 0));
      
      // Linki olan en ucuz satıcıyı bul
      const bestAgentWithUrl = agents.find((a: any) => a.url && a.url.startsWith('http'));

      const firstLeg = item.legs?.[0];

      if (idx === 0) {
        console.log(`[SKY] 📍 Sample item - Agents: ${agents.length}, Legs: ${item.legs?.length}`);
      }

      return {
        id: `SKY_${item.id || idx}`,
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
          currency: params.currency || 'AUD',
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
    console.error("[SKY] 🔥 KRİTİK HATA:", error.name, error.message);
    console.error("[SKY] Stack:", error.stack?.substring(0, 300));
    return [];
  }
}

export async function searchAirScraper(params: any) {
    return []; // Placeholder
}

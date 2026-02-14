import { FlightResult, FlightSource } from "@/types/hybridFlight";

export async function searchSkyScrapper(params: { origin: string, destination: string, date: string, currency?: string }): Promise<FlightResult[]> {
  // 1. AYARLAR
  const apiKey = process.env.RAPID_API_KEY_SKY || 'a5019e6badmsh72c554c174620e5p18995ajsnd5606f30e000';
  const apiHost = process.env.RAPID_API_HOST_SKY || 'flights-sky.p.rapidapi.com';
  
  // Tarih Düzeltmesi
  let targetDate = params.date.includes('T') ? params.date.split('T')[0] : params.date;
  if (targetDate.startsWith('2025')) targetDate = targetDate.replace('2025', '2026');

  console.log(`🚀 [SKY] DİREKT UÇUŞ ARAMA: ${params.origin} -> ${params.destination} (${targetDate})`);

  const url = `https://${apiHost}/web/flights/search-one-way`;

  try {
    const queryParams = new URLSearchParams({
      placeIdFrom: params.origin,      // Direkt 'BNE'
      placeIdTo: params.destination,   // Direkt 'IST'
      departDate: targetDate, 
      market: 'AU',       
      locale: 'en-AU',
      currency: params.currency || 'AUD', 
      adults: '1', 
      cabinClass: 'ECONOMY'
    });

    const fullUrl = `${url}?${queryParams.toString()}`;
    console.log(`[SKY] 📍 Full URL: ${fullUrl}`);

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
    
    // ✅ VERİ YAPISINI LOGLAYALIM
    console.log(`[SKY] 📡 Response Keys: ${Object.keys(json).join(', ')}`);
    console.log(`[SKY] 📡 data keys: ${Object.keys(json.data || {}).join(', ')}`);
    
    // Path 1'i dene
    let items = json.data?.itineraries || [];
    console.log(`[SKY] ✓ data.itineraries: ${items.length} items`);
    
    // Path 2'yi dene (eğer ilki boş ise)
    if (items.length === 0) {
      items = json.itineraries || [];
      console.log(`[SKY] ✓ itineraries (direct): ${items.length} items`);
    }
    
    // Path 3'ü dene: results
    if (items.length === 0) {
      items = json.data?.itineraries?.results || [];
      console.log(`[SKY] ✓ data.itineraries.results: ${items.length} items`);
    }

    console.log(`[SKY] ✅ SONUÇ: ${items.length} uçuş bulundu.`);

    if (items.length === 0) {
      console.warn(`[SKY] ⚠️ Response Dump:`, JSON.stringify(json).substring(0, 1000));
      return [];
    }

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
        currency: params.currency || 'AUD',
        cabinClass: 'economy' as const,
        
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

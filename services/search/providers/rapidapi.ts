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
    console.log(`[SKY] � data Keys: ${Object.keys(json.data || {}).join(', ')}`);
    console.log(`[SKY] 📡 itineraries Keys: ${Object.keys(json.data?.itineraries || {}).join(', ')}`);
    
    let items: any[] = [];
    
    // The API returns itineraries as an object, not array
    // Look for individual flight items in different locations
    if (json.data?.itineraries) {
      const iter = json.data.itineraries;
      
      // Try common paths for flight arrays
      if (Array.isArray(iter.itineraries)) {
        items = iter.itineraries;
        console.log(`[SKY] ✓ Found data.itineraries.itineraries (array): ${items.length}`);
      } else if (Array.isArray(iter.results)) {
        items = iter.results;
        console.log(`[SKY] ✓ Found data.itineraries.results (array): ${items.length}`);
      } else if (iter.filterStats?.total) {
        console.log(`[SKY] 📊 API says ${iter.filterStats.total} flights exist but they're not in expected structure`);
        console.log(`[SKY] 📋 Available keys:`, Object.keys(iter).slice(0, 10).join(', '));
    
        // Look for any array in the object
        const allArrays = Object.entries(iter)
          .filter(([_, v]) => Array.isArray(v) && (v as any[]).length > 0)
          .map(([k, v]) => ({ key: k, count: (v as any[]).length }));
        
        if (allArrays.length > 0) {
          console.log(`[SKY] 🔍 Found arrays:`, allArrays.map(a => `${a.key}(${a.count})`).join(', '));
          items = iter[allArrays[0].key as keyof typeof iter] as any[];
          console.log(`[SKY] ✓ Using ${allArrays[0].key}: ${items.length} items`);
        }
      }
    }
    
    if (items.length === 0) {
      console.warn(`[SKY] ⚠️ No flights found. Response structure:`, JSON.stringify({
        hasData: !!json.data,
        iterKeys: Object.keys(json.data?.itineraries || {}),
        total: json.data?.itineraries?.filterStats?.total,
        firstItems: JSON.stringify(json.data?.itineraries).substring(0, 800)
      }));
      return [];
    }

    console.log(`[SKY] ✅ SONUÇ: ${items.length} uçuş bulundu.`);

    if (!Array.isArray(items)) {
      console.error(`[SKY] 🔥 Items is not an array! Type:`, typeof items, 'Value:', items);
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

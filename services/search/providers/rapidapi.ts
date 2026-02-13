import { FlightResult, FlightSource } from "@/types/hybridFlight";

// API Host Adresi (Flights Sky için)
const RAPID_API_HOST = 'flights-sky.p.rapidapi.com';

export async function searchSkyScrapper(params: { origin: string, destination: string, date: string, currency?: string }): Promise<FlightResult[]> {
  // .env dosyanın içine RAPID_API_KEY_SKY olarak o paralı üyeliğinin key'ini koyduğundan emin ol!
  const apiKey = process.env.RAPID_API_KEY_SKY || '';
  
  if (!apiKey) {
    console.error("❌ RAPID_API_KEY_SKY tanımlı değil");
    return [];
  }

  const currency = params.currency || 'AUD';
  
  // Tarih düzeltmesi (2025 -> 2026)
  let targetDate = params.date.includes('T') ? params.date.split('T')[0] : params.date;
  if (targetDate.startsWith('2025')) targetDate = targetDate.replace('2025', '2026');

  // Konum ID'lerini bul (PlaceId olarak dönecek)
  const originPlaceId = await resolveLocation(params.origin, apiKey);
  const destPlaceId = await resolveLocation(params.destination, apiKey);

  if (!originPlaceId || !destPlaceId) {
    console.error("❌ Konum bulunamadı:", params.origin, params.destination);
    return [];
  }

  try {
    // 📢 Doğru Flights Sky Endpoint (WEB prefix LAZIM!)
    const url = `https://${RAPID_API_HOST}/web/flights/search-one-way`;
    
    // Doğru parametre isimleri: placeIdFrom, placeIdTo
    const queryParams = new URLSearchParams({
      placeIdFrom: originPlaceId,
      placeIdTo: destPlaceId,
      departDate: targetDate,
      adults: '1', 
      currency: currency, 
      market: 'en-US', 
      locale: 'en-US'
    });

    console.log("🚀 Flights Sky API İsteği:", `${url}?placeIdFrom=${originPlaceId}&placeIdTo=${destPlaceId}&...`);

    const res = await fetch(`${url}?${queryParams.toString()}`, {
      method: 'GET',
      headers: { 
        'X-RapidAPI-Key': apiKey, 
        'X-RapidAPI-Host': RAPID_API_HOST 
      }
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("🔥 Flights Sky Hatası:", res.status, err.substring(0, 200));
      return [];
    }

    const data = await res.json();
    
    // Incomplete handling (dokümanda belirtildiği gibi)
    if (data.data?.context?.status === 'incomplete') {
      console.log("⏳ Incomplete status, polling için wait needed (şimdilik skip)");
      // TODO: Polling implementasyonu gerekli olabilir
    }

    return processFlights(data, params.origin, params.destination, currency);

  } catch (error: any) {
    console.error("🔥 API CATCH HATASI:", error.message);
    return [];
  }
}

// Uçuş verilerini işle
function processFlights(data: any, origin: string, destination: string, currency: string): FlightResult[] {
  // Doğru path: data.itineraries.results (not just data.itineraries)
  const items = data.data?.itineraries?.results || data.itineraries?.results || [];

  console.log(`✅ FLIGHTS SKY SONUÇ: ${items.length} uçuş bulundu.`);

  if (items.length === 0) {
    return [];
  }

  return items.map((item: any, idx: number) => {
    
    // 🕵️‍♂️ SATICILARI VE LİNKLERİ TOPLA (Skyscanner Mantığı)
    const agents = item.pricingOptions?.map((opt: any) => ({
      name: opt.agent?.name,
      price: opt.price?.amount,
      image: opt.agent?.imageUrl,
      rating: opt.agent?.rating,
      reviewCount: opt.agent?.reviewCount,
      isOfficial: opt.agent?.isOfficial,
      url: opt.items?.[0]?.url || opt.url || opt.agent?.link || undefined
    })) || [];

    // En ucuzdan pahalıya sırala
    agents.sort((a: any, b: any) => (a.price || 0) - (b.price || 0));

    // En iyi linki bul
    const bestAgentWithUrl = agents.find((a: any) => a.url && a.url.startsWith('http'));

    // Uçuş bilgileri
    const firstLeg = item.legs?.[0];
    const airline = firstLeg?.carriers?.marketing?.[0]?.name || "Airline";
    const airlineLogo = firstLeg?.carriers?.marketing?.[0]?.logoUrl;

    if (agents.length > 0) {
      console.log(`✅ FLIGHTS_SKY: ${agents.length} agent, cheapest: ${agents[0].name} @ ${agents[0].price}`);
    }

    return {
      id: `SKYSP_${item.id || idx}`,
      source: 'SKY_SCANNER_PRO' as FlightSource,
      airline: airline,
      airlineLogo: airlineLogo,
      flightNumber: firstLeg?.carriers?.marketing?.[0]?.alternateId || "FLY",
      
      from: origin,
      to: destination,
      departTime: firstLeg?.departure,
      arriveTime: firstLeg?.arrival,
      duration: firstLeg?.durationInMinutes || 0,
      stops: firstLeg?.stopCount || 0,
      
      price: agents[0]?.price || item.price?.raw || 0,
      currency: currency,
      cabinClass: 'economy',
      
      // Frontend için satıcı listesi
      bookingProviders: agents.map((a: any) => ({
        name: a.name || 'Unknown',
        price: a.price || 0,
        currency: currency,
        link: a.url || '',
        logo: a.image,
        type: 'agency' as const,
        rating: a.rating,
        reviewCount: a.reviewCount,
        isOfficial: a.isOfficial
      })),

      // Link varsa koy, yoksa undefined (Aviasales YOK)
      deepLink: bestAgentWithUrl?.url || undefined,
      bookingLink: bestAgentWithUrl?.url || undefined
    };
  });
}

// 📍 KONUM ÇÖZÜCÜ (Flights Sky için)
async function resolveLocation(query: string, apiKey: string): Promise<string | null> {
  try {
    // Doğru endpoint: /web/flights/auto-complete (not /flights/auto-complete)
    const url = `https://${RAPID_API_HOST}/web/flights/auto-complete`;
    
    // İlk denemesi: query parametresi
    let q = new URLSearchParams({ query: query });
    
    console.log(`🔍 Konum çözümleniyor: ${query} -> ${url}?${q}`);

    let res = await fetch(`${url}?${q}`, { 
      headers: { 
        'X-RapidAPI-Key': apiKey, 
        'X-RapidAPI-Host': RAPID_API_HOST 
      } 
    });
    
    // 400 hatası alırsa alternatif parametreleri dene
    if (res.status === 400) {
      console.warn(`⚠️ 'query' parametresi başarısız (400), 'searchTerm' deneniyor...`);
      q = new URLSearchParams({ 
        searchTerm: query,
        market: 'en-US',
        locale: 'en-US'
      });
      
      res = await fetch(`${url}?${q}`, { 
        headers: { 
          'X-RapidAPI-Key': apiKey, 
          'X-RapidAPI-Host': RAPID_API_HOST 
        } 
      });
    }
    
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`❌ Konum çözümleme başarısız: ${query} (${res.status})`);
      console.error(`   Yanıt: ${errText.substring(0, 200)}`);
      // Fallback: IATA kodu direkt kullan
      return query;
    }
    
    const json = await res.json();
    console.log(`📡 API Yanıtı yapısı:`, JSON.stringify(json).substring(0, 300));
    
    // Farklı response yapıları dene
    const results = json.data || json.results || json;
    const resultArray = Array.isArray(results) ? results : (results[0] ? [results] : []);
    
    if (resultArray.length === 0) {
      console.warn(`⚠️ Boş sonuç, fallback: ${query}`);
      return query;
    }
    
    const bestMatch = resultArray[0];
    console.log(`✅ Konum çözüldü:`, bestMatch);
    
    // PlaceId almayı dene
    const placeId = bestMatch?.PlaceId || bestMatch?.placeId || bestMatch?.id || bestMatch?.code;
    
    if (placeId) {
      console.log(`✅ PlaceId bulundu: ${query} -> ${placeId}`);
      return placeId;
    }
    
    // Fallback: sorgu parametresini direkt kullan
    console.warn(`⚠️ PlaceId bulunamadı, fallback: ${query}`);
    return query;
  } catch(e) { 
    console.error(`🔥 Konum çözümleme hatası:`, e);
    // Fallback: sorgu parametresini direkt kullan
    return query;
  }
}

export async function searchAirScraper(params: any) {
    return []; // Placeholder
}

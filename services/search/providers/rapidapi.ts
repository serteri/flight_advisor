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

  // Konum ID'lerini bul
  const originLoc = await resolveLocation(params.origin, apiKey);
  const destLoc = await resolveLocation(params.destination, apiKey);

  if (!originLoc || !destLoc) {
    console.error("❌ Konum bulunamadı:", params.origin, params.destination);
    return [];
  }

  try {
    // 📢 Flights Sky Endpoint
    const url = `https://${RAPID_API_HOST}/flights/search-one-way`;
    
    // İlk denemesi: fromId/toId parametreleri
    let queryParams = new URLSearchParams({
      fromId: originLoc.entityId,
      toId: destLoc.entityId,
      date: targetDate, 
      cabinClass: 'ECONOMY', 
      adults: '1', 
      currency: currency, 
      market: 'en-US', 
      countryCode: 'AU'
    });

    console.log("🚀 Flights Sky API İsteği:", `${url}?${queryParams.toString().substring(0, 100)}`);

    const res = await fetch(`${url}?${queryParams.toString()}`, {
      method: 'GET',
      headers: { 
        'X-RapidAPI-Key': apiKey, 
        'X-RapidAPI-Host': RAPID_API_HOST 
      }
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("🔥 Flights Sky Hatası:", err);
      
      // Alternatif parametre denemesi
      console.log("🔄 Alternatif parametre yapısı deneniyor...");
      queryParams = new URLSearchParams({
        placeIdFrom: params.origin,
        placeIdTo: params.destination,
        departDate: targetDate,
        currency: currency,
        market: 'en-US'
      });

      const retryRes = await fetch(`${url}?${queryParams.toString()}`, {
        method: 'GET',
        headers: { 
          'X-RapidAPI-Key': apiKey, 
          'X-RapidAPI-Host': RAPID_API_HOST 
        }
      });

      if (!retryRes.ok) {
        console.error("🔥 Alternatif parametre de başarısız");
        return [];
      }

      const retryData = await retryRes.json();
      return processFlights(retryData, params.origin, params.destination, currency);
    }

    const data = await res.json();
    return processFlights(data, params.origin, params.destination, currency);

  } catch (error: any) {
    console.error("🔥 API CATCH HATASI:", error.message);
    return [];
  }
}

// Uçuş verilerini işle
function processFlights(data: any, origin: string, destination: string, currency: string): FlightResult[] {
  const items = data.data?.itineraries || data.itineraries || [];

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
async function resolveLocation(query: string, apiKey: string) {
  try {
    const RAPID_API_HOST = 'flights-sky.p.rapidapi.com';
    const url = `https://${RAPID_API_HOST}/flights/auto-complete`;
    const q = new URLSearchParams({ query: query });
    
    const res = await fetch(`${url}?${q}`, { 
      headers: { 
        'X-RapidAPI-Key': apiKey, 
        'X-RapidAPI-Host': RAPID_API_HOST 
      } 
    });
    
    if (!res.ok) return null;
    const json = await res.json();
    
    // İlk eşleşmeyi al
    const bestMatch = json.data?.[0] || json[0]; 
    if (bestMatch) {
      return { 
        skyId: bestMatch.skyId || bestMatch.PlaceId || query, 
        entityId: bestMatch.entityId || bestMatch.PlaceId || query
      };
    }
    return null;
  } catch(e) { 
    console.error("Konum çözümleme hatası:", e);
    return null; 
  }
}

export async function searchAirScraper(params: any) {
    return []; // Placeholder
}

import { FlightResult, FlightSource } from "@/types/hybridFlight";
import { resolveSkyPlaceIds } from "../skyPlaceResolver";

// "Flight Intelligence Platform" Provider - RapidAPI (Real-Time Scraper)
// Configured to use ONLY flights-scraper-real-time.p.rapidapi.com
// This provider fetches prices to mirror OTA availability (Skyscanner parity)
// and enriches them with "Smart" data (score, rating).

export async function searchSkyScrapper(params: {
  origin: string,
  destination: string,
  date: string,
  currency?: string,
  cabinClass?: string,
  adults?: number
}): Promise<FlightResult[]> {
  const apiKey = process.env.RAPID_API_KEY_SKY || process.env.RAPID_API_KEY;
  const apiHost = process.env.RAPID_API_HOST_FLIGHT || 'flights-scraper-real-time.p.rapidapi.com';

  console.log(`🔑 RapidAPI Provider Check: Key=${apiKey ? `${apiKey.substring(0, 10)}...` : 'MISSING'}, Host=${apiHost}`);

  if (!apiKey) {
    console.error('❌ RAPID_API_KEY not set - RapidAPI provider disabled');
    return [];
  }

  // Tarih Formatı (yyyy-mm-dd)
  const targetDate = params.date.includes('T') ? params.date.split('T')[0] : params.date;

  // Use direct IATA codes - the API accepts them
  const originCode = params.origin.toUpperCase();
  const destCode = params.destination.toUpperCase();

  console.log(`🚀 RapidAPI: Searching ${originCode} → ${destCode} on ${targetDate}`);

  try {
    const endpoints: Array<{
      name: string;
      url: string;
      params: Record<string, string>;
    }> = [
      {
        name: 'search-oneway',
        url: `https://${apiHost}/flights/search-oneway`,
        params: {
          originSkyId: originCode,
          destinationSkyId: destCode,
          departureDate: targetDate,
          cabinClass: (params.cabinClass || 'ECONOMY').toUpperCase(),
          adults: (params.adults || 1).toString(),
          currency: params.currency || 'USD'
        }
      },
      {
        name: 'search-alternative',
        url: `https://${apiHost}/api/v1/flights/searchFlights`,
        params: {
          origin: originCode,
          destination: destCode,
          date: targetDate,
          cabinClass: params.cabinClass || 'economy',
          adults: (params.adults || 1).toString(),
          currency: params.currency || 'USD'
        }
      }
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`🔍 Trying endpoint: ${endpoint.name}`);
        const query = new URLSearchParams(endpoint.params);
        const fullUrl = `${endpoint.url}?${query.toString()}`;
        
        console.log(`📡 RapidAPI Request: ${fullUrl.substring(0, 150)}...`);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        const res = await fetch(fullUrl, {
          headers: { 
            'X-RapidAPI-Key': apiKey, 
            'X-RapidAPI-Host': apiHost 
          },
          signal: controller.signal
        }).finally(() => clearTimeout(timeout));

        console.log(`📊 RapidAPI Response [${endpoint.name}]: ${res.status} ${res.statusText}`);

        if (!res.ok) {
          const errorText = await res.text();
          console.error(`❌ RapidAPI error [${endpoint.name}] (${res.status}):`, errorText.slice(0, 300));
          continue; // Try next endpoint
        }

        const json = await res.json();
        console.log(`📦 RapidAPI JSON structure:`, Object.keys(json).join(', '));
        
        const items = json.data?.itineraries || json.data || json.flights || json.results || [];

        if (Array.isArray(items) && items.length > 0) {
          console.log(`✅ RapidAPI [${endpoint.name}] returned ${items.length} itineraries`);
          
          const mappedFlights = items.map((item: any, idx: number) => {
            try {
              return mapRapidApiToFlightResult(item, params, idx);
            } catch (itemError: any) {
              console.warn(`⚠️ Error mapping RapidAPI item:`, itemError.message);
              return null;
            }
          }).filter((item: any): item is FlightResult => item !== null);

          console.log(`✅ Successfully mapped ${mappedFlights.length} flights from RapidAPI`);
          return mappedFlights;
        } else {
          console.warn(`⚠️ RapidAPI [${endpoint.name}] returned empty or invalid data structure`);
        }
      } catch (endpointError: any) {
        console.error(`❌ RapidAPI endpoint [${endpoint.name}] error:`, endpointError.message);
        continue;
      }
    }

    console.warn(`⚠️ All RapidAPI endpoints failed or returned no results`);
    return [];

  } catch (error: any) {
    console.error(`🔥 RapidAPI Provider fatal error: ${error.message}`);
    console.error(error.stack);
    return [];
  }
}

function mapRapidApiToFlightResult(item: any, params: any, idx: number): FlightResult {
  // Map Kiwi/RapidAPI response to FlightResult
  const segment = item.sector?.sectorSegments?.[0]?.segment || item.segments?.[0] || item;
  const price = parseFloat(item.price?.amount || item.price || item.totalPrice || "0");
  const relativeUrl = item.bookingOptions?.edges?.[0]?.node?.bookingUrl || item.bookingUrl || item.deepLink;
  const deepLink = relativeUrl && !relativeUrl.startsWith('http') 
    ? `https://www.kiwi.com${relativeUrl}` 
    : relativeUrl;

  // --- INTELLIGENCE LAYER (Zeka Katmanı) ---
  let score = 7.5; // Taban puan
  let tags: string[] = [];

  // Akıllı Etiketleme Mantığı
  if (price > 0 && price < 600) { tags.push("Best Price"); score += 1.5; }
  const durationSeconds = item.duration || item.totalDuration || 0;
  if (durationSeconds < 15 * 3600) { tags.push("Fastest"); score += 0.5; }

  // Carrier name
  const carrierName = segment?.operatingCarrier?.name 
    || segment?.carrier?.name 
    || segment?.airline 
    || item.airline
    || "Airline";
    
  if (carrierName.toLowerCase().includes("turkish")) { 
    tags.push("Top Rated Airline"); 
    score += 0.5; 
  }

  const durationMins = Math.floor((durationSeconds || 0) / 60);
  const stops = (item.sector?.sectorSegments?.length || item.segments?.length || 1) - 1;

  return {
    id: `RAPID_${item.id || idx}`,
    source: 'SKY_SCANNER_PRO' as FlightSource,
    airline: carrierName,
    airlineLogo: segment?.operatingCarrier?.logoUrl || segment?.carrier?.logo,
    flightNumber: segment?.operatingCarrier?.code || segment?.flightNumber || "FLT",

    from: params.origin.toUpperCase(),
    to: params.destination.toUpperCase(),
    departTime: segment?.source?.localTime || item.departTime || new Date().toISOString(),
    arriveTime: item.sector?.sectorSegments?.at(-1)?.segment?.destination?.localTime 
      || item.arriveTime 
      || new Date().toISOString(),
    duration: durationMins,
    stops: stops,

    price: price,
    currency: params.currency || 'USD',
    cabinClass: (params.cabinClass || 'economy').toLowerCase() as any,

    score: parseFloat(score.toFixed(1)),
    tags: tags,
    
    amenities: {
      hasWifi: false,
      hasMeal: true,
      baggage: 'Dahil'
    },
    
    policies: {
      baggageKg: 20, // Default for RapidAPI
      cabinBagKg: 7
    },
    
    baggageSummary: {
      checked: '20kg',
      cabin: '7kg',
      totalWeight: '20kg'
    },
    
    bookingProviders: [
      {
        name: item.provider?.[0]?.name || "Kiwi.com",
        price: price,
        currency: params.currency || 'USD',
        link: deepLink || '',
        type: 'agency' as const,
        rating: 4.2
      }
    ],
    deepLink: deepLink,
    segments: item.segments || item.sector?.sectorSegments || [],
    layovers: []
  } as FlightResult;
}

// Dummy implementation for AirScraper to satisfy imports in aggregator
export async function searchAirScraper(params: any): Promise<FlightResult[]> {
  return [];
}

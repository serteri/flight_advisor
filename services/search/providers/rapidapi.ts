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
  const segments = item.sector?.sectorSegments || item.segments || [];
  const firstSegment = segments[0]?.segment || segments[0] || item;
  const lastSegment = segments[segments.length - 1]?.segment || segments[segments.length - 1] || item;
  
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
  const carrierName = firstSegment?.operatingCarrier?.name 
    || firstSegment?.carrier?.name 
    || firstSegment?.airline 
    || item.airline
    || "Airline";
    
  if (carrierName.toLowerCase().includes("turkish")) { 
    tags.push("Top Rated Airline"); 
    score += 0.5; 
  }

  const durationMins = Math.floor((durationSeconds || 0) / 60);
  const stops = Math.max(0, segments.length - 1);

  // Extract layovers between segments
  const layovers: any[] = [];
  for (let i = 0; i < segments.length - 1; i++) {
    const current = segments[i]?.segment || segments[i];
    const next = segments[i + 1]?.segment || segments[i + 1];
    
    try {
      const arriveTime = new Date(current.destination?.localTime || current.arrivalTime || current.arrival).getTime();
      const departTime = new Date(next.source?.localTime || next.departureTime || next.departure).getTime();
      const layoverMins = Math.floor((departTime - arriveTime) / 60000);
      
      layovers.push({
        duration: layoverMins,
        airport: current.destination?.iataCode || current.destination || current.to || 'XXX',
        city: current.destination?.city || current.destination?.name || ''
      });
    } catch (e) {
      console.warn('Error calculating layover:', e);
    }
  }

  // Map segments to proper format
  const mappedSegments = segments.map((seg: any) => {
    const segment = seg.segment || seg;
    return {
      from: segment.source?.iataCode || segment.origin?.iataCode || segment.from || 'XXX',
      to: segment.destination?.iataCode || segment.destination || segment.to || 'XXX',
      departure: segment.source?.localTime || segment.departureTime || segment.departure,
      arrival: segment.destination?.localTime || segment.arrivalTime || segment.arrival,
      duration: segment.duration || 0,
      carrier: segment.operatingCarrier?.iataCode || segment.carrier?.code || segment.airline || 'XX',
      carrierName: segment.operatingCarrier?.name || segment.carrier?.name || segment.airlineName || 'Airline',
      flightNumber: segment.operatingCarrier?.code || segment.flightNumber || 'FLT',
      aircraft: segment.aircraft?.name || segment.equipmentName || '',
      departing_at: segment.source?.localTime || segment.departureTime || segment.departure,
      arriving_at: segment.destination?.localTime || segment.arrivalTime || segment.arrival,
      operating_carrier: {
        name: segment.operatingCarrier?.name || segment.carrier?.name || 'Airline',
        iata_code: segment.operatingCarrier?.iataCode || segment.carrier?.code || 'XX',
        logo_url: segment.operatingCarrier?.logoUrl || segment.carrier?.logo || ''
      },
      origin: {
        iata_code: segment.source?.iataCode || segment.origin?.iataCode || segment.from || 'XXX',
        city_name: segment.source?.city || segment.origin?.city || ''
      },
      destination: {
        iata_code: segment.destination?.iataCode || segment.destination || segment.to || 'XXX',
        city_name: segment.destination?.city || segment.destination?.name || ''
      }
    };
  });

  // Try to extract real baggage info from item
  let baggageKg = 20; // default
  let cabinBagKg = 7; // default
  
  if (item.baggageOptions) {
    const checked = item.baggageOptions.find((b: any) => b.type === 'checked' || b.category === 'hold');
    const cabin = item.baggageOptions.find((b: any) => b.type === 'cabin' || b.category === 'cabin');
    
    if (checked?.weight) baggageKg = parseInt(checked.weight) || 20;
    if (cabin?.weight) cabinBagKg = parseInt(cabin.weight) || 7;
  }

  return {
    id: `RAPID_${item.id || idx}`,
    source: 'SKY_SCANNER_PRO' as FlightSource,
    airline: carrierName,
    airlineLogo: firstSegment?.operatingCarrier?.logoUrl || firstSegment?.carrier?.logo,
    flightNumber: firstSegment?.operatingCarrier?.code || firstSegment?.flightNumber || "FLT",

    from: params.origin.toUpperCase(),
    to: params.destination.toUpperCase(),
    departTime: firstSegment?.source?.localTime || firstSegment?.departure || new Date().toISOString(),
    arriveTime: lastSegment?.destination?.localTime || lastSegment?.arrival || new Date().toISOString(),
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
      baggage: `${baggageKg}kg`
    },
    
    policies: {
      baggageKg: baggageKg,
      cabinBagKg: cabinBagKg
    },
    
    baggageSummary: {
      checked: `${baggageKg}kg`,
      cabin: `${cabinBagKg}kg`,
      totalWeight: `${baggageKg}kg`
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
    segments: mappedSegments,
    layovers: layovers
  } as FlightResult;
}

// Dummy implementation for AirScraper to satisfy imports in aggregator
export async function searchAirScraper(params: any): Promise<FlightResult[]> {
  return [];
}

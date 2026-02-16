import { FlightResult, FlightSource } from "@/types/hybridFlight";

// Travelpayouts/Aviasales Flight Search API
// Docs: https://www.travelpayouts.com/developers/api

export async function searchTravelpayouts(params: {
  origin: string,
  destination: string,
  date: string,
  currency?: string,
  adults?: number
}): Promise<FlightResult[]> {
  const token = process.env.TRAVELPAYOUTS_TOKEN;
  const marker = process.env.TRAVELPAYOUTS_MARKER || '701049';

  console.log(`🔑 Travelpayouts Check: Token=${token ? `${token.substring(0, 10)}...` : 'MISSING'}, Marker=${marker}`);

  if (!token) {
    console.error('❌ TRAVELPAYOUTS_TOKEN not set - Travelpayouts provider disabled');
    return [];
  }

  const originCode = params.origin.toUpperCase();
  const destCode = params.destination.toUpperCase();
  const targetDate = params.date.includes('T') ? params.date.split('T')[0] : params.date;

  console.log(`🚀 Travelpayouts: Searching ${originCode} → ${destCode} on ${targetDate}`);

  try {
    // Using Aviasales API v3 - prices for dates
    const url = `https://api.travelpayouts.com/aviasales/v3/prices_for_dates`;
    const queryParams = new URLSearchParams({
      origin: originCode,
      destination: destCode,
      departure_at: targetDate,
      currency: params.currency || 'USD',
      token: token,
      limit: '30',
      sorting: 'price',
      one_way: 'true'
    });

    const fullUrl = `${url}?${queryParams.toString()}`;
    console.log(`📡 Travelpayouts Request: ${fullUrl.substring(0, 120)}...`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const res = await fetch(fullUrl, {
      headers: {
        'Accept': 'application/json'
      },
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));

    console.log(`📊 Travelpayouts Response: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ Travelpayouts error (${res.status}):`, errorText.slice(0, 300));
      return [];
    }

    const json = await res.json();
    console.log(`📦 Travelpayouts JSON structure:`, Object.keys(json).join(', '));

    const data = json.data || json.results || [];
    
    if (!Array.isArray(data) || data.length === 0) {
      console.warn(`⚠️ Travelpayouts: No flights found in response`);
      return [];
    }

    console.log(`✅ Travelpayouts: Found ${data.length} offers`);

    const flights: FlightResult[] = data.map((offer: any, idx: number) => {
      try {
        // Parse duration (in minutes)
        const durationMins = offer.duration || 0;
        
        // Extract airline info
        const airlineCode = offer.airline || offer.carrier || 'XX';
        const airlineName = offer.airline_name || offer.carrier_name || 'Airline';

        // Build flight number
        const flightNumber = offer.flight_number || `${airlineCode}${Math.floor(Math.random() * 9999)}`;

        // Parse times
        const departTime = offer.departure_at || offer.depart_date;
        const arriveTime = offer.return_at || calculateArrival(departTime, durationMins);

        // Stops
        const stops = offer.transfers || offer.stops || 0;

        // Baggage
        let baggageKg = 20; // default
        if (offer.baggage && typeof offer.baggage === 'object') {
          baggageKg = parseInt(offer.baggage.weight || '20', 10);
        }

        return {
          id: `tp_${offer.id || idx}`,
          source: 'TRAVELPAYOUTS' as FlightSource,
          airline: airlineName,
          airlineLogo: `https://pics.avs.io/200/200/${airlineCode}.png`,
          flightNumber: flightNumber,
          from: originCode,
          to: destCode,
          departTime: departTime,
          arriveTime: arriveTime,
          duration: durationMins,
          durationLabel: formatDuration(durationMins),
          stops: stops,
          price: parseFloat(offer.price || offer.value || '0'),
          currency: params.currency || 'USD',
          cabinClass: 'economy',
          amenities: {
            hasWifi: false,
            hasMeal: stops === 0 ? false : true,
            baggage: 'Dahil'
          },
          segments: [],
          layovers: [],
          policies: {
            baggageKg,
            cabinBagKg: 7,
            refundable: false,
            changeAllowed: false
          },
          baggageSummary: {
            checked: `1 x ${baggageKg}kg`,
            cabin: '1 x 7kg',
            totalWeight: `${baggageKg}kg`
          },
          bookingLink: offer.link || `https://www.aviasales.com/?marker=${marker}`,
          deepLink: offer.link
        } as FlightResult;
      } catch (err: any) {
        console.warn('[Travelpayouts] Error mapping offer:', err.message);
        return null;
      }
    }).filter((f): f is FlightResult => f !== null);

    console.log(`🎯 Travelpayouts: Mapped ${flights.length} flights successfully`);
    return flights;

  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.error('❌ Travelpayouts: Request timeout after 25s');
    } else {
      console.error('❌ Travelpayouts search error:', err.message);
    }
    return [];
  }
}

function formatDuration(mins: number): string {
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  return `${hours}h ${minutes}m`;
}

function calculateArrival(departTime: string, durationMins: number): string {
  try {
    const depart = new Date(departTime);
    const arrive = new Date(depart.getTime() + durationMins * 60000);
    return arrive.toISOString();
  } catch {
    return departTime;
  }
}

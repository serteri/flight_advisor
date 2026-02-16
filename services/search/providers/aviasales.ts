import { FlightResult, FlightSource } from "@/types/hybridFlight";

// Travelpayouts (Aviasales) - Price Mirror Engine
// API Docs: https://www.travelpayouts.com/developers/api

export async function searchAviasales(params: {
  origin: string;
  destination: string;
  date: string;
  currency?: string;
  adults?: number;
}): Promise<FlightResult[]> {
  const token = process.env.TRAVELPAYOUTS_TOKEN;
  const marker = process.env.TRAVELPAYOUTS_MARKER || '701049';

  console.log(`🦁 Aviasales: Searching ${params.origin} → ${params.destination}`);

  if (!token) {
    console.warn('❌ TRAVELPAYOUTS_TOKEN missing');
    return [];
  }

  const originCode = params.origin.toUpperCase();
  const destCode = params.destination.toUpperCase();
  const dateStr = params.date.includes('T') ? params.date.split('T')[0] : params.date;

  try {
    // Travelpayouts v2 API - Latest Prices
    const url = new URL('https://api.travelpayouts.com/v2/prices/latest');
    url.searchParams.append('token', token);
    url.searchParams.append('origin', originCode);
    url.searchParams.append('destination', destCode);
    url.searchParams.append('beginning_of_period', dateStr);
    url.searchParams.append('period_type', 'day');
    url.searchParams.append('one_way', 'true');
    url.searchParams.append('limit', '50');
    url.searchParams.append('sorting', 'price');

    console.log(`📡 Aviasales Request: ${url.toString().substring(0, 120)}...`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const res = await fetch(url.toString(), {
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      const text = await res.text();
      console.error(`❌ Aviasales Error (${res.status}):`, text.substring(0, 200));
      return [];
    }

    const json = await res.json();
    const data = Array.isArray(json.data) ? json.data : [];

    console.log(`✅ Aviasales: Found ${data.length} flights`);

    if (data.length === 0) return [];

    return data.map((item: any, idx: number) => {
      try {
        const price = item.price || item.value || 0;
        const mainAirline = item.main_airline || item.airline || 'Multi-Airline';
        const stops = item.number_of_changes || 0;
        const departDate = item.depart_date || dateStr;
        const returnDate = item.return_date || dateStr;

        // Deep link for affiliate tracking
        const deepLink = `https://search.aviasales.com/flights/?origin_iata=${originCode}&destination_iata=${destCode}&depart_date=${dateStr}&marker=${marker}&with_request=true`;

        // Pricing  
        let duration = 0;
        if (item.duration && typeof item.duration === 'object') {
          duration = (item.duration.hours || 0) * 60 + (item.duration.minutes || 0);
        } else if (typeof item.duration === 'number') {
          duration = item.duration;
        }

        // Score calculation
        let score = 7.0;
        const pros: string[] = [];
        const cons: string[] = [];

        if (price < 400) {
          score += 2;
          pros.push('Дешевле');
        }
        if (stops === 0) {
          score += 1;
          pros.push('Директ');
        } else {
          cons.push(`${stops} остановок`);
        }

        return {
          id: `aviasales_${item.flight_number || idx}`,
          source: 'TRAVELPAYOUTS' as FlightSource,
          airline: mainAirline,
          airlineLogo: mainAirline ? `https://pics.avs.io/200/200/${mainAirline}.png` : '',
          flightNumber: item.flight_number || `AV${Math.floor(Math.random() * 9999)}`,
          from: originCode,
          to: destCode,
          departTime: new Date(departDate).toISOString(),
          arriveTime: new Date(returnDate).toISOString(),
          duration: duration,
          stops: stops,
          price: Math.round(price),
          currency: 'USD',
          cabinClass: 'economy',
          amenities: {
            hasWifi: false,
            hasMeal: stops === 0 ? false : true,
            baggage: 'Dahil'
          },
          policies: {
            baggageKg: 20,
            cabinBagKg: 7,
            refundable: false,
            changeAllowed: false
          },
          baggageSummary: {
            checked: '1 x 20kg',
            cabin: '1 x 7kg',
            totalWeight: '20kg'
          },
          segments: [],
          layovers: [],
          deepLink: deepLink,
          bookingLink: deepLink,
          agentScore: score,
          scorePros: pros,
          scoreCons: cons,
          bookingProviders: [
            {
              name: item.gate || 'Aviasales',
              price: Math.round(price),
              currency: params.currency || 'USD',
              link: deepLink,
              type: 'agency' as const,
              rating: 4.5
            }
          ]
        } as FlightResult;
      } catch (err: any) {
        console.warn('[Aviasales] Mapping error:', err.message);
        return null;
      }
    }).filter((f: any): f is FlightResult => f !== null);

  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.error('❌ Aviasales: Timeout');
    } else {
      console.error('❌ Aviasales error:', err.message);
    }
    return [];
  }
}

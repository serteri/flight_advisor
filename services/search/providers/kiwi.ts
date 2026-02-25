import { FlightResult, HybridSearchParams } from '@/types/hybridFlight';

/**
 * KIWI.COM (TEQUILA API)
 * 
 * FREE API - API key gerekmez!
 * Documentation: https://tequila.kiwi.com/docs/search_api/search/
 * 
 * Özellikler:
 * - Ücretsiz kullanım (rate limit var)
 * - 300+ havayolu
 * - Dünya genelinde kapsam
 * - Gerçek fiyatlar ve rezervasyon linkleri
 */

const KIWI_API_BASE = 'https://api.tequila.kiwi.com';

function parsePositivePrice(value: unknown): number {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? parseFloat(value.replace(/[^0-9.]/g, ''))
        : NaN;

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }

  return numeric;
}

export async function searchKiwi(params: HybridSearchParams): Promise<FlightResult[]> {
  console.log(`\n🥝 KIWI.COM SEARCH START`);
  console.log(`  Origin: ${params.origin}`);
  console.log(`  Destination: ${params.destination}`);
  console.log(`  Date: ${params.date}`);

  try {
    const dateStr = params.date.split('T')[0];
    const dateFormatted = dateStr.replace(/-/g, '/'); // 2026-04-17 -> 2026/04/17

    // Kiwi.com API search endpoint
    const url = new URL(`${KIWI_API_BASE}/v2/search`);
    url.searchParams.set('fly_from', params.origin);
    url.searchParams.set('fly_to', params.destination);
    url.searchParams.set('date_from', dateFormatted);
    url.searchParams.set('date_to', dateFormatted);
    url.searchParams.set('adults', String(params.adults || 1));
    url.searchParams.set('curr', params.currency || 'USD');
    url.searchParams.set('limit', '100'); // Max results
    url.searchParams.set('max_stopovers', '3');
    url.searchParams.set('vehicle_type', 'aircraft');
    url.searchParams.set('sort', 'price'); // En ucuz önce

    console.log(`📡 Kiwi API Request...`);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    console.log(`  Response Status: ${response.status}`);

    if (!response.ok) {
      const errText = await response.text();
      console.error("🔥 Kiwi API Error:", response.status, errText.substring(0, 200));
      return [];
    }

    const json = await response.json();

    console.log("\n📦 KIWI PARSING:");
    console.log(`  Response keys: ${Object.keys(json).join(', ')}`);
    console.log(`  Data count: ${json.data?.length || 0}`);

    const flights: FlightResult[] = [];

    if (!Array.isArray(json.data)) {
      console.log("  ⚠️ No flights in response");
      return [];
    }

    for (const flight of json.data) {
      try {
        // Kiwi route structure: multiple segments
        const routes = flight.route || [];
        if (routes.length === 0) continue;

        // 🚫 CRITICAL: Filter out $0 price flights (invalid)
        const price =
          parsePositivePrice(flight.price) ||
          parsePositivePrice(flight.conversion?.[params.currency || 'USD']) ||
          parsePositivePrice(flight.conversion?.USD) ||
          parsePositivePrice(flight.conversion?.EUR);

        if (price <= 0 || !price) {
          console.log(`  ⏭️ Skipped 1 Kiwi flight: $0 price`);
          continue;
        }

        const firstRoute = routes[0];
        const lastRoute = routes[routes.length - 1];

        // Times
        const departTime = new Date(flight.dTime * 1000).toISOString();
        const arriveTime = new Date(flight.aTime * 1000).toISOString();

        // Duration in minutes
        const durationMins = Math.floor(flight.duration?.total || 0) / 60;

        // Airline extraction
        const airlines = new Set<string>();
        routes.forEach((r: any) => {
          if (r.airline) airlines.add(r.airline);
        });

        // Layovers
        const layovers = routes.slice(0, -1).map((r: any, idx: number) => {
          const nextRoute = routes[idx + 1];
          const layoverSec = (nextRoute.dTime - r.aTime);
          const layoverMins = Math.floor(layoverSec / 60);
          return {
            city: r.cityTo || r.flyTo,
            airport: r.flyTo,
            duration: layoverMins
          };
        });

        const flightResult: FlightResult = {
          id: `kiwi_${flight.id || Math.random().toString(36).substr(2, 9)}`,
          source: 'KIWI' as any,
          airline: Array.from(airlines)[0] || flight.airlines?.[0] || 'Multiple',
          flightNumber: firstRoute.flight_no || 'KIWI',
          from: params.origin,
          to: params.destination,
          departTime,
          arriveTime,
          duration: durationMins,
          durationLabel: formatDuration(durationMins),
          stops: Math.max(0, routes.length - 1),
          price: price,
          currency: flight.currency || params.currency || 'EUR',
          cabinClass: 'economy',
          layovers: layovers.length > 0 ? layovers : undefined,
          segments: routes,
          deepLink: flight.deep_link,
          bookingLink: flight.booking_token ? `https://www.kiwi.com/deep?from=${params.origin}&to=${params.destination}&departure=${dateFormatted}&booking_token=${flight.booking_token}` : undefined
        };

        flights.push(flightResult);
      } catch (err) {
        console.log(`  ⚠️ Skipped 1 Kiwi flight: ${err}`);
      }
    }

    console.log(`  ✅ Parsed ${flights.length} Kiwi flights\n`);
    return flights;

  } catch (error) {
    console.error("🔥 Kiwi Fail:", error);
    return [];
  }
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0h';
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

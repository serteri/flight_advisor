import { FlightResult, HybridSearchParams } from "@/types/hybridFlight";
import { searchDuffel } from './providers/duffel';
import { searchPricelineProvider } from './providers/priceline';
import { PricelineRateLimitError } from '@/lib/providers/priceline';
// Kiwi (auth required), Travelpayouts (unreliable), RapidAPI (removed)

export type SearchProvidersMeta = {
  flights: FlightResult[];
  warnings: string[];
  rateLimited: boolean;
};

export async function searchAllProvidersWithMeta(params: HybridSearchParams): Promise<SearchProvidersMeta> {
  const base = await searchAllProvidersInternal(params);
  return base;
}

export async function searchAllProviders(params: HybridSearchParams): Promise<FlightResult[]> {
  const { flights } = await searchAllProvidersInternal(params);
  return flights;
}

async function searchAllProvidersInternal(params: HybridSearchParams): Promise<SearchProvidersMeta> {
  console.log(`\n🔎 Flight Search Started`);
  console.log(`  Route: ${params.origin} → ${params.destination}`);
  console.log(`  Date: ${params.date}`);

  const startTime = Date.now();
  const promises: Promise<FlightResult[]>[] = [];
  const providers: string[] = [];
  const warnings: string[] = [];
  let rateLimited = false;

  // Duffel - primary source
  if (process.env.DUFFEL_ACCESS_TOKEN) {
    console.log(`✅ Adding Duffel provider`);
    promises.push(searchDuffel(params));
    providers.push('Duffel');
  }

  // PRICELINE - RapidAPI
  if (process.env.RAPID_API_KEY && process.env.RAPID_API_HOST_PRICELINE) {
    console.log(`✅ Adding PRICELINE provider`);
    promises.push(searchPricelineProvider(params));
    providers.push('Priceline');
  }

  console.log(`🚀 Starting ${promises.length} providers...\n`);

  try {
    const results = await Promise.allSettled(promises);
    const elapsed = Date.now() - startTime;

    let allFlights: FlightResult[] = [];
    let duffelCount = 0;
    let pricelineCount = 0;

    results.forEach((result, idx) => {
      const providerName = providers[idx] || `Provider-${idx + 1}`;
      if (result.status === 'fulfilled') {
        const flights = result.value || [];
        allFlights = [...allFlights, ...flights];

        if (providerName === 'Duffel') {
          duffelCount = flights.length;
          console.log(`✅ Duffel: ${duffelCount} flights`);
        } else if (providerName === 'Priceline') {
          pricelineCount = flights.length;
          console.log(`✅ PRICELINE: ${pricelineCount} flights`);
        }
      } else {
        // Log detailed rejection information
        const errorMsg = result.reason?.message || String(result.reason);
        console.error(`❌ ${providerName} provider failed:`, errorMsg);

        if (result.reason instanceof PricelineRateLimitError || result.reason?.code === 'PRICELINE_RATE_LIMIT') {
          rateLimited = true;
          warnings.push('Hızlı Arama Limiti Doldu');
        }
      }
    });

    const normalizeCode = (value: any) => {
      if (!value) return "";
      if (typeof value === "string") return value.toUpperCase();
      if (typeof value === "object") {
        return (
          value.iata || value.iataCode || value.iata_code || value.code || ""
        ).toUpperCase();
      }
      return "";
    };

    const targetOrigin = params.origin.toUpperCase();
    const targetDest = params.destination.toUpperCase();

    const filteredFlights = allFlights.filter((flight) => {
      const flightOrigin = normalizeCode(flight.from || (flight as any).origin);
      const flightDest = normalizeCode(flight.to || (flight as any).destination);
      const price = Number(flight.price);

      const originMatch = !flightOrigin || flightOrigin === targetOrigin;
      const destMatch = !flightDest || flightDest === targetDest;
      const validPrice = Number.isFinite(price) && price > 0;

      return originMatch && destMatch && validPrice;
    });

    const hasExplicitTimezone = (value: string): boolean => /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim());
    const withDurationDebug = filteredFlights.map((flight) => {
      if ((flight as any).durationDebug) return flight;

      const dep = String(flight.departTime || '');
      const arr = String(flight.arriveTime || '');
      const depMs = dep && hasExplicitTimezone(dep) ? new Date(dep).getTime() : NaN;
      const arrMs = arr && hasExplicitTimezone(arr) ? new Date(arr).getTime() : NaN;
      const timestampDuration = Number.isFinite(depMs) && Number.isFinite(arrMs) && arrMs > depMs
        ? Math.round((arrMs - depMs) / 60000)
        : 0;

      return {
        ...flight,
        durationDebug: {
          providerDuration: Number(flight.duration) || 0,
          timestampDuration,
          resolvedDuration: Number(flight.duration) || timestampDuration || 0,
          provider: String(flight.source || 'UNKNOWN'),
          fallback: true,
        },
      } as FlightResult;
    });

    console.log(`\n📊 Total: ${allFlights.length} flights (${elapsed}ms)`);
    console.log(`   Duffel: ${duffelCount} | PRICELINE: ${pricelineCount}`);
    console.log(`   Filtered: ${filteredFlights.length} (origin/destination match)\n`);
    
    // Sort by price
    return {
      flights: withDurationDebug.sort((a, b) => a.price - b.price),
      warnings: Array.from(new Set(warnings)),
      rateLimited,
    };

  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`❌ Search failed (${elapsed}ms):`, error);
    return {
      flights: [],
      warnings: ['Arama sağlayıcı hatası oluştu'],
      rateLimited,
    };
  }
}


import { FlightResult, HybridSearchParams } from "@/types/hybridFlight";
import { searchDuffel } from './providers/duffel';
import { searchSerpApi } from './providers/serpapi';
// Kiwi (auth required), Travelpayouts (unreliable), RapidAPI (removed)

export async function searchAllProviders(params: HybridSearchParams): Promise<FlightResult[]> {
  console.log(`\n🔎 Flight Search Started`);
  console.log(`  Route: ${params.origin} → ${params.destination}`);
  console.log(`  Date: ${params.date}`);

  const startTime = Date.now();
  const promises: Promise<FlightResult[]>[] = [];

  // Duffel - primary source
  if (process.env.DUFFEL_ACCESS_TOKEN) {
    console.log(`✅ Adding Duffel provider`);
    promises.push(searchDuffel(params));
  }

  // SERPAPI - Google Flights via SerpApi
  if (process.env.SERPAPI_KEY) {
    console.log(`✅ Adding SERPAPI provider`);
    promises.push(searchSerpApi(params));
  }

  console.log(`🚀 Starting ${promises.length} providers...\n`);

  try {
    const results = await Promise.allSettled(promises);
    const elapsed = Date.now() - startTime;

    let allFlights: FlightResult[] = [];
    let duffelCount = 0;
    let serpApiCount = 0;

    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        const flights = result.value || [];
        allFlights = [...allFlights, ...flights];
        
        if (idx === 0 && process.env.DUFFEL_ACCESS_TOKEN) {
          duffelCount = flights.length;
          console.log(`✅ Duffel: ${duffelCount} flights`);
        } else if (process.env.SERPAPI_KEY) {
          serpApiCount = flights.length;
          console.log(`✅ SERPAPI: ${serpApiCount} flights`);
        }
      } else {
        // Log detailed rejection information
        const errorMsg = result.reason?.message || String(result.reason);
        const providerName = idx === 0 && process.env.DUFFEL_ACCESS_TOKEN ? 'Duffel' : 'SERPAPI';
        console.error(`❌ ${providerName} provider failed:`, errorMsg);
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

      const originMatch = !flightOrigin || flightOrigin === targetOrigin;
      const destMatch = !flightDest || flightDest === targetDest;

      return originMatch && destMatch;
    });

    console.log(`\n📊 Total: ${allFlights.length} flights (${elapsed}ms)`);
    console.log(`   Duffel: ${duffelCount} | SERPAPI: ${serpApiCount}`);
    console.log(`   Filtered: ${filteredFlights.length} (origin/destination match)\n`);
    
    // Sort by price
    return filteredFlights.sort((a, b) => a.price - b.price);

  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`❌ Search failed (${elapsed}ms):`, error);
    return [];
  }
}


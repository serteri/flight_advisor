import { FlightResult, HybridSearchParams } from "@/types/hybridFlight";
import { searchDuffel } from './providers/duffel';
// ALL OTHER PROVIDERS REMOVED: Oxylabs (unsupported), Kiwi (auth failed), Travelpayouts (unreliable), RapidAPI (removed)
// SINGLE RELIABLE SOURCE: Duffel - Real bookable flights, live data, 155+ results per search

export async function searchAllProviders(params: HybridSearchParams): Promise<FlightResult[]> {
  console.log(`\n🔎 Flight Search Started`);
  console.log(`  Route: ${params.origin} → ${params.destination}`);
  console.log(`  Date: ${params.date}`);
  console.log(`  Provider: DUFFEL (Single reliable source)\n`);

  const startTime = Date.now();

  try {
    // Single provider - Duffel (most reliable)
    const flights = await searchDuffel(params);
    const elapsed = Date.now() - startTime;

    console.log(`✅ Search complete: ${flights.length} flights found (${elapsed}ms)\n`);
    
    // Sort by price (cheapest first)
    return flights.sort((a, b) => a.price - b.price);

  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`❌ Search failed (${elapsed}ms):`, error);
    return [];
  }
}


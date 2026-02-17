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
        console.error(`❌ Provider ${idx} failed:`, result.reason?.message);
      }
    });

    console.log(`\n📊 Total: ${allFlights.length} flights (${elapsed}ms)`);
    console.log(`   Duffel: ${duffelCount} | SERPAPI: ${serpApiCount}\n`);
    
    // Sort by price
    return allFlights.sort((a, b) => a.price - b.price);

  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`❌ Search failed (${elapsed}ms):`, error);
    return [];
  }
}


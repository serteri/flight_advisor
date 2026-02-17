import { FlightResult, HybridSearchParams } from "@/types/hybridFlight";
import { searchDuffel } from './providers/duffel';
import { searchOxylabs } from './providers/oxylabs'; // Google Flights proxy via Oxylabs
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

  // Oxylabs - secondary source
  if (process.env.OXYLABS_USERNAME && process.env.OXYLABS_PASSWORD) {
    console.log(`✅ Adding Oxylabs provider`);
    promises.push(searchOxylabs(params));
  }

  console.log(`🚀 Starting ${promises.length} providers...\n`);

  try {
    const results = await Promise.allSettled(promises);
    const elapsed = Date.now() - startTime;

    let allFlights: FlightResult[] = [];
    let duffelCount = 0;
    let oxylabsCount = 0;

    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        const flights = result.value || [];
        allFlights = [...allFlights, ...flights];
        
        if (idx === 0 && process.env.DUFFEL_ACCESS_TOKEN) {
          duffelCount = flights.length;
          console.log(`✅ Duffel: ${duffelCount} flights`);
        } else if (process.env.OXYLABS_USERNAME) {
          oxylabsCount = flights.length;
          console.log(`✅ Oxylabs: ${oxylabsCount} flights`);
        }
      } else {
        console.error(`❌ Provider ${idx} failed:`, result.reason?.message);
      }
    });

    console.log(`\n📊 Total: ${allFlights.length} flights (${elapsed}ms)`);
    console.log(`   Duffel: ${duffelCount} | Oxylabs: ${oxylabsCount}\n`);
    
    // Sort by price
    return allFlights.sort((a, b) => a.price - b.price);

  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`❌ Search failed (${elapsed}ms):`, error);
    return [];
  }
}


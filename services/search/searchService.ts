import { FlightResult, HybridSearchParams } from "@/types/hybridFlight";
import { searchDuffel } from './providers/duffel';
import { searchOxylabs } from './providers/oxylabs'; // Google Flights via Oxylabs proxy
// RapidAPI, Travelpayouts, Amadeus - deprecated (unreliable/no live data)

export async function searchAllProviders(params: HybridSearchParams): Promise<FlightResult[]> {
  console.log(`\n🔎 searchAllProviders STARTED`);
  console.log(`  Origin: ${params.origin}`);
  console.log(`  Destination: ${params.destination}`);

  const startTime = Date.now();

  const providerPromises: { name: string; promise: Promise<any> }[] = [];

  if (process.env.DUFFEL_ACCESS_TOKEN) {
    console.log(`✅ Adding Duffel provider`);
    providerPromises.push({ name: 'duffel', promise: searchDuffel(params) });
  } else {
    console.warn('⚠️ Skipping Duffel: DUFFEL_ACCESS_TOKEN not set');
  }

  const oxyUser = process.env.OXYLABS_USERNAME;
  const oxyPass = process.env.OXYLABS_PASSWORD;
  
  if (oxyUser && oxyPass) {
    console.log(`✅ Adding Oxylabs provider (USERNAME=SET, PASSWORD=SET)`);
    try {
      providerPromises.push({ name: 'oxylabs', promise: searchOxylabs(params) });
      console.log(`   ✅ Oxylabs promise added to queue`);
    } catch (e) {
      console.error(`❌ Failed to add Oxylabs to queue:`, e);
    }
  } else {
    console.error(`❌ CRITICAL: Oxylabs credentials missing in searchAllProviders!`);
    console.error(`    USERNAME: ${oxyUser ? 'SET' : 'NOT SET'}`);
    console.error(`    PASSWORD: ${oxyPass ? 'SET' : 'NOT SET'}`);
  }

  console.log(`🚀 Starting ${providerPromises.length} providers...`);

  const settled = await Promise.allSettled(providerPromises.map(p => p.promise));

  const elapsed = Date.now() - startTime;

  const resultsByName: Record<string, FlightResult[]> = { duffel: [], oxylabs: [] };

  settled.forEach((res, idx) => {
    const name = providerPromises[idx].name;
    if (res.status === 'fulfilled') {
      resultsByName[name] = res.value || [];
      console.log(`✅ ${name}: ${resultsByName[name].length} flights (${elapsed}ms)`);
    } else {
      const errorMsg = res.reason?.message || res.reason?.toString?.() || JSON.stringify(res.reason);
      console.error(`❌ ${name} REJECTED (${elapsed}ms): ${errorMsg}`);
      console.error(`   Stack:`, res.reason?.stack);
    }
  });

  console.log(`📊 Provider Stats: Duffel(${resultsByName.duffel.length}) Oxylabs(${resultsByName.oxylabs.length}) - Total: ${elapsed}ms`);

  const allFlights = [...resultsByName.duffel, ...resultsByName.oxylabs];

  console.log(`📊 TOTAL FOUND: ${allFlights.length} flights`);

  return allFlights;
}

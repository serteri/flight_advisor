import { FlightResult, HybridSearchParams } from "@/types/hybridFlight";
import { searchDuffel } from './providers/duffel';
import { searchAmadeus } from './providers/amadeus'; // Amadeus
import { searchTravelpayouts } from './providers/travelpayouts'; // Travelpayouts/Aviasales
// RapidAPI provider removed - deprecated

export async function searchAllProviders(params: HybridSearchParams): Promise<FlightResult[]> {
  console.log(`🔎 [${new Date().toISOString()}] Arama Başladı: ${params.origin} -> ${params.destination}`);

  const startTime = Date.now();

  const providerPromises: { name: string; promise: Promise<any> }[] = [];

  if (process.env.DUFFEL_ACCESS_TOKEN) {
    providerPromises.push({ name: 'duffel', promise: searchDuffel(params) });
  } else {
    console.warn('⚠️ Skipping Duffel: DUFFEL_ACCESS_TOKEN not set');
  }

  // RapidAPI provider removed - using Travelpayouts instead

  if (process.env.AMADEUS_API_KEY && process.env.AMADEUS_API_SECRET) {
    providerPromises.push({ name: 'amadeus', promise: searchAmadeus(params) });
  } else {
    console.warn('⚠️ Skipping Amadeus: AMADEUS credentials not set');
  }

  if (process.env.TRAVELPAYOUTS_TOKEN) {
    providerPromises.push({ name: 'travelpayouts', promise: searchTravelpayouts({
      origin: params.origin,
      destination: params.destination,
      date: params.date,
      currency: params.currency,
      adults: params.adults
    })});
  } else {
    console.warn('⚠️ Skipping Travelpayouts: TRAVELPAYOUTS_TOKEN not set');
  }

  // Kiwi intentionally removed; no kiwi provider used.

  const settled = await Promise.allSettled(providerPromises.map(p => p.promise));

  const elapsed = Date.now() - startTime;

  const resultsByName: Record<string, FlightResult[]> = { duffel: [], amadeus: [], travelpayouts: [] };

  settled.forEach((res, idx) => {
    const name = providerPromises[idx].name;
    if (res.status === 'fulfilled') {
      resultsByName[name] = res.value || [];
      console.log(`✅ ${name}: ${resultsByName[name].length} flights (${elapsed}ms)`);
    } else {
      const errorMsg = res.reason?.message || res.reason?.toString?.() || JSON.stringify(res.reason);
      console.error(`❌ ${name} Error (${elapsed}ms):`, errorMsg);
    }
  });

  console.log(`📊 Provider Stats: Duffel(${resultsByName.duffel.length}) Amadeus(${resultsByName.amadeus.length}) Travelpayouts(${resultsByName.travelpayouts.length}) - Total: ${elapsed}ms`);

  const allFlights = [...resultsByName.duffel, ...resultsByName.amadeus, ...resultsByName.travelpayouts];

  console.log(`📊 TOTAL FOUND: ${allFlights.length} flights`);

  return allFlights;
}

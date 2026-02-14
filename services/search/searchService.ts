import { FlightResult, HybridSearchParams } from "@/types/hybridFlight";
import { searchDuffel } from './providers/duffel';
import { searchSkyScrapper } from './providers/rapidapi'; // Sky Scrapper (RapidAPI)
import { searchKiwi } from './providers/kiwi'; // Kiwi (Yeni Ekledik)

export async function searchAllProviders(params: HybridSearchParams): Promise<FlightResult[]> {
  console.log(`🔎 [${new Date().toISOString()}] Arama Başladı: ${params.origin} -> ${params.destination}`);

  const startTime = Date.now();

  const providerPromises: { name: string; promise: Promise<any> }[] = [];

  if (process.env.DUFFEL_ACCESS_TOKEN) {
    providerPromises.push({ name: 'duffel', promise: searchDuffel(params) });
  } else {
    console.warn('⚠️ Skipping Duffel: DUFFEL_ACCESS_TOKEN not set');
  }

  if (process.env.RAPID_API_KEY_SKY || process.env.RAPID_API_KEY) {
    providerPromises.push({ name: 'sky', promise: searchSkyScrapper({
      origin: params.origin,
      destination: params.destination,
      date: params.date,
      currency: params.currency,
      cabinClass: params.cabin,
      adults: params.adults
    })});
  } else {
    console.warn('⚠️ Skipping SkyScrapper: RAPID_API_KEY_SKY not set');
  }

  if (process.env.KIWI_API_KEY) {
    providerPromises.push({ name: 'kiwi', promise: searchKiwi(params) });
  } else {
    console.warn('⚠️ Skipping Kiwi: KIWI_API_KEY not set');
  }

  const settled = await Promise.allSettled(providerPromises.map(p => p.promise));

  const elapsed = Date.now() - startTime;

  const resultsByName: Record<string, FlightResult[]> = { duffel: [], sky: [], kiwi: [] };

  settled.forEach((res, idx) => {
    const name = providerPromises[idx].name;
    if (res.status === 'fulfilled') {
      resultsByName[name] = res.value || [];
      console.log(`✅ ${name}: ${resultsByName[name].length} flights (${elapsed}ms)`);
    } else {
      console.error(`❌ ${name} Error:`, res.reason?.message || res.reason);
    }
  });

  console.log(`📊 Provider Stats: Duffel(${resultsByName.duffel.length}) Sky(${resultsByName.sky.length}) Kiwi(${resultsByName.kiwi.length}) - Total: ${elapsed}ms`);

  const allFlights = [...resultsByName.duffel, ...resultsByName.sky, ...resultsByName.kiwi];

  console.log(`📊 TOTAL FOUND: ${allFlights.length} flights`);

  return allFlights;
}

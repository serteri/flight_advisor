import { FlightResult, HybridSearchParams } from "@/types/hybridFlight";
import { searchDuffel } from './providers/duffel';
import { searchSkyScrapper } from './providers/rapidapi'; // Sky Scrapper (RapidAPI)
import { searchKiwi } from './providers/kiwi'; // Kiwi (Yeni Ekledik)

export async function searchAllProviders(params: HybridSearchParams): Promise<FlightResult[]> {
  console.log(`🔎 [${new Date().toISOString()}] Arama Başladı: ${params.origin} -> ${params.destination}`);

  // Promise.allSettled ile tüm sağlayıcıları paralel çalıştırıyoruz
  const startTime = Date.now();
  const [duffelRes, skyRes] = await Promise.allSettled([
    searchDuffel(params),
    searchSkyScrapper({
      origin: params.origin,
      destination: params.destination,
      date: params.date,
      currency: params.currency,
      cabinClass: params.cabin,
      adults: params.adults
    }),
    // searchKiwi(params),         // ❌ Kiwi (Geçici Olarak Kapalı - 401 Hatası)
    
    // ❌ BU SATIRI KESİNLİKLE SİL VEYA YORUM YAP:
    // searchOpenClaw(params) 
  ]);

  const elapsed = Date.now() - startTime;

  // Sonuçları al
  let duffelFlights: FlightResult[] = [];
  let skyFlights: FlightResult[] = [];
  
  if (duffelRes.status === 'fulfilled') {
    duffelFlights = duffelRes.value;
    console.log(`✅ Duffel: ${duffelFlights.length} flights (${elapsed}ms)`);
  } else {
    console.error(`❌ Duffel Error:`, duffelRes.reason?.message || duffelRes.reason);
  }

  if (skyRes.status === 'fulfilled') {
    skyFlights = skyRes.value;
    console.log(`✅ Sky Scrapper: ${skyFlights.length} flights (${elapsed}ms)`);
  } else {
    console.error(`❌ Sky Scrapper Error:`, skyRes.reason?.message || skyRes.reason);
  }
  
  const kiwiFlights: FlightResult[] = [];

  console.log(`📊 Provider Stats: Duffel(${duffelFlights.length}) Sky(${skyFlights.length}) Kiwi(${kiwiFlights.length}) - Total: ${elapsed}ms`);

  // Sonuçları birleştirme mantığı...
  const allFlights = [...duffelFlights, ...skyFlights, ...kiwiFlights];
    
  console.log(`📊 TOTAL FOUND: ${allFlights.length} flights`);

  return allFlights;
}

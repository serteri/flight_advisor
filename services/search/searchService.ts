import { FlightResult, HybridSearchParams } from "@/types/hybridFlight";
import { searchDuffel } from './providers/duffel';
import { searchSkyScrapper } from './providers/rapidapi'; // Sky Scrapper (RapidAPI)
import { searchKiwi } from './providers/kiwi'; // Kiwi (Yeni Ekledik)

export async function searchAllProviders(params: HybridSearchParams): Promise<FlightResult[]> {
  console.log(`🔎 Arama Başladı: ${params.origin} -> ${params.destination}`);

  // Promise.allSettled ile tüm sağlayıcıları paralel çalıştırıyoruz
  const [duffelRes, skyRes] = await Promise.allSettled([
    searchDuffel(params),       // ✅ Duffel (Aktif)
    searchSkyScrapper(params),  // ✅ Sky Scrapper (Aktif)
    // searchKiwi(params),         // ❌ Kiwi (Geçici Olarak Kapalı)
    
    // ❌ BU SATIRI KESİNLİKLE SİL VEYA YORUM YAP:
    // searchOpenClaw(params) 
  ]);

  const duffelFlights = duffelRes.status === 'fulfilled' ? duffelRes.value : [];
  const skyFlights = skyRes.status === 'fulfilled' ? skyRes.value : [];
  // const kiwiFlights = kiwiRes.status === 'fulfilled' ? kiwiRes.value : [];
  const kiwiFlights: FlightResult[] = [];

  console.log(`📊 Provider Stats: Duffel(${duffelFlights.length}) Sky(${skyFlights.length}) Kiwi(${kiwiFlights.length})`);

  // Sonuçları birleştirme mantığı...
  const allFlights = [...duffelFlights, ...skyFlights, ...kiwiFlights];
    
  console.log(`📊 TOTAL FOUND: ${allFlights.length} flights`);

  return allFlights;
}

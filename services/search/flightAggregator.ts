import { FlightResult, HybridSearchParams } from "@/types/hybridFlight";
import { searchDuffel } from "./providers/duffel";
import { searchSkyScrapper, searchAirScraper } from "./providers/rapidapi";
import { searchOpenClaw } from "./providers/openClaw"; // 🆕 YENİ OYUNCU
import { scoreFlightV3 } from "@/lib/scoring/flightScoreEngine";

export async function getHybridFlights(params: HybridSearchParams): Promise<FlightResult[]> {
    console.log(`[HybridSearch] Starting search for: ${params.origin} -> ${params.destination}`);

    // 🔥 4'LÜ PARALEL ARAMA (ARTIK OPENCLAW DA VAR)
    const [duffelResults, skyResults, airResults, openClawResults] = await Promise.all([
        searchDuffel(params),
        searchSkyScrapper(params),
        searchAirScraper(params),
        searchOpenClaw(params) // 👈 BURADA ÇAĞRILIYOR
    ]);

    // Hepsini birleştir
    let allFlights = [
        ...duffelResults, 
        ...skyResults, 
        ...airResults, 
        ...openClawResults // 👈 SONUÇLARA EKLENDİ
    ];

    // 2. Market Analysis (En ucuz fiyatı bul)
    const prices = allFlights.map(f => f.price).filter(p => p > 0);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const hasChild = (params.children || 0) > 0 || (params.infants || 0) > 0;

    // 3. Scoring & Sorting (V3) - Herkes puanlansın!
    // Not: OpenClaw zaten kendi puanıyla (agentScore) geliyor ama sistem onu normalize edebilir.
    allFlights = allFlights.map(flight => {
        // Eğer OpenClaw zaten puan verdiyse onu koruyalım veya yeniden hesaplayalım.
        // Şimdilik sistemin puanlamasına güveniyoruz.
        
        const scoreResult = scoreFlightV3(flight, {
            minPrice: minPrice > 0 ? minPrice : flight.price,
            hasChild
        });

        // OpenClaw'ın özel puanını (agentScore) ezmeyelim, eğer varsa koruyalım.
        // Ama sistem genel bir sıralama yaptığı için V3 puanını kullanmak daha adil olabilir.
        // Karar: Sistem puanını (scoreResult.score) ana puan yap, OpenClaw puanını yedekte tut.

        return {
            ...flight,
            agentScore: scoreResult.score, // Sistem puanı (Adil yarış)
            scoreDetails: {
                total: scoreResult.score,
                penalties: scoreResult.penalties,
                pros: scoreResult.pros,
                // OpenClaw'dan gelen özel detayları da buraya ekleyebiliriz (opsiyonel)
            }
        };
    });

    // Puanına göre sırala (En yüksek puan en üstte)
    allFlights.sort((a, b) => (b.agentScore || 0) - (a.agentScore || 0));

    return allFlights;
}

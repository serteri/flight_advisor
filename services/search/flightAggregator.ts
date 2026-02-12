import { FlightResult, HybridSearchParams } from "@/types/hybridFlight";
import { searchDuffel } from "./providers/duffel";
import { searchSkyScrapper, searchAirScraper } from "./providers/rapidapi";
import { searchOpenClaw } from "./providers/openClaw"; 
import { scoreFlightV3 } from "@/lib/scoring/flightScoreEngine";

export async function getHybridFlights(params: HybridSearchParams): Promise<FlightResult[]> {
    console.log(`[HybridSearch] Starting search for: ${params.origin} -> ${params.destination}`);

    // 🔥 4'LÜ PARALEL ARAMA (ARTIK OPENCLAW DA VAR)
    const [duffelResults, skyResults, airResults, openClawResults] = await Promise.all([
        searchDuffel(params),
        searchSkyScrapper(params),
        searchAirScraper(params),
        searchOpenClaw(params) 
    ]);

    // Hepsini birleştir
    let allFlights = [
        ...duffelResults, 
        ...skyResults, 
        ...airResults, 
        ...openClawResults 
    ];

    // 2. Market Analysis (En ucuz fiyatı bul)
    // @ts-ignore
    const prices = allFlights.map(f => f.price).filter(p => p > 0);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const hasChild = (params.children || 0) > 0 || (params.infants || 0) > 0;

    // 3. Scoring & Sorting (V3)
    allFlights = allFlights.map(flight => {
        /* 
           TypeScript Hatasını Önlemek İçin:
           FlightSource tipinde 'OPENCLAW' tanımlı olmayabilir.
           Bu yüzden flight nesnesini 'any' olarak geçiriyoruz.
        */
        const scoreResult = scoreFlightV3(flight as any, {
            minPrice: minPrice > 0 ? minPrice : flight.price,
            hasChild
        });

        return {
            ...flight,
            agentScore: scoreResult.score, 
            scoreDetails: {
                total: scoreResult.score,
                penalties: scoreResult.penalties,
                pros: scoreResult.pros,
            }
        };
    });

    // Puanına göre sırala
    allFlights.sort((a, b) => (b.agentScore || 0) - (a.agentScore || 0));

    return allFlights;
}

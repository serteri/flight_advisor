import { FlightResult, HybridSearchParams } from "@/types/hybridFlight";
import { searchDuffel } from "./providers/duffel";
import { searchOxylabs } from "./providers/oxylabs"; // ✅ OXYLABS MOTORU
import { scoreFlightV3 } from "@/lib/scoring/flightScoreEngine";

export async function getHybridFlights(params: HybridSearchParams): Promise<FlightResult[]> {
    console.log(`\n🚀 [HybridSearch] Starting search for: ${params.origin} -> ${params.destination}`);
    console.log(`   Date: ${params.date}`);

    // ✅ DUFFEL + OXYLABS (Parallel execution)
    const results = await Promise.allSettled([
        searchDuffel(params),
        searchOxylabs(params)
    ]);

    const duffelResults = results[0].status === 'fulfilled' ? results[0].value : [];
    const oxylabsResults = results[1].status === 'fulfilled' ? results[1].value : [];

    console.log(`✅ [HybridSearch] Results -> Duffel: ${duffelResults.length}, Oxylabs: ${oxylabsResults.length}`);

    // Hepsini birleştir
    let rawFlights: any[] = [
        ...duffelResults,
        ...oxylabsResults
    ];

    if (rawFlights.length === 0) {
        console.log(`⚠️ [HybridSearch] No flights found from any provider`);
        return [];
    }

    // 2. Market Analysis (En ucuz fiyatı bul)
    const prices = rawFlights.map(f => f.price).filter(p => p > 0);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const hasChild = (params.children || 0) > 0 || (params.infants || 0) > 0;

    // 3. Scoring & Sorting (V3)
    const scoredFlights: FlightResult[] = rawFlights.map(flight => {
        const scoreResult = scoreFlightV3(flight, {
            minPrice: minPrice > 0 ? minPrice : flight.price,
            hasChild
        });

        // Burada dönen nesneyi FlightResult tipine zorluyoruz (as unknown as FlightResult)
        // Çünkü dinamik eklenen alanlar (agentScore vb.) TypeScript'i kızdırıyor.
        return {
            ...flight,
            agentScore: scoreResult.score, 
            scoreDetails: {
                total: scoreResult.score,
                penalties: scoreResult.penalties,
                pros: scoreResult.pros,
            }
        } as unknown as FlightResult;
    });

    // Puanına göre sırala
    // Artık scoredFlights bir FlightResult[] olduğu için agentScore alanı tanımlı (types/hybridFlight.ts güncellendiği sürece)
    scoredFlights.sort((a, b) => (b.agentScore || 0) - (a.agentScore || 0));

    return scoredFlights;
}

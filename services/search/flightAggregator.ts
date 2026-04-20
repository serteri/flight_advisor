/**
 * @deprecated
 * Legacy search aggregation path retained during the FlightAgent pivot away
 * from flight search providers. Do not add new product dependencies here.
 */
import { FlightResult, HybridSearchParams } from "@/types/hybridFlight";
import { searchDuffel } from "./providers/duffel";
import { searchPricelineProvider } from "./providers/priceline";
import { scoreFlightV3 } from "@/lib/scoring/flightScoreEngine";
import { scoreBatchFlights, calculateMarketContext } from "@/lib/masterFlightScore";
import { FlightForScoring } from "@/lib/flightTypes";

export async function getHybridFlights(params: HybridSearchParams): Promise<FlightResult[]> {
    console.log(`\n🚀 [HybridSearch] Starting search for: ${params.origin} -> ${params.destination}`);
    console.log(`   Date: ${params.date}`);

    // ✅ DUFFEL + PRICELINE (Parallel execution)
    const searchResults = await Promise.allSettled([
        searchDuffel(params),
        searchPricelineProvider(params)
    ]);

    const duffelResults = searchResults[0].status === 'fulfilled' ? searchResults[0].value : [];
    const pricelineResults = searchResults[1].status === 'fulfilled' ? searchResults[1].value : [];

    console.log(`✅ [HybridSearch] Results -> Duffel: ${duffelResults.length}, PRICELINE: ${pricelineResults.length}`);

    // Hepsini birleştir
    let rawFlights: any[] = [
        ...duffelResults,
        ...pricelineResults
    ];

    if (rawFlights.length === 0) {
        console.log(`⚠️ [HybridSearch] No flights found from any provider`);
        return [];
    }

    // ========================================
    // 🧠 MASTER FLIGHT SCORE (100-point system)
    // ========================================
    console.log(`🧠 [MasterScore] Analyzing ${rawFlights.length} flights...`);
    
    // Convert to FlightForScoring format (assuming rawFlights are compatible)
    const scoredFlights = scoreBatchFlights(rawFlights as any as FlightForScoring[]);
    
    console.log(`✅ [MasterScore] Scored ${scoredFlights.length} flights (Top: ${scoredFlights[0]?.masterScore?.total || 0}/100)`);

    // 2. Legacy V3 Score (for backward compatibility)
    const hasChild = (params.children || 0) > 0 || (params.infants || 0) > 0;
    const prices = rawFlights.map(f => f.price).filter(p => p > 0);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;

    const results: FlightResult[] = scoredFlights.map((flight: any) => {
        const legacyScore = scoreFlightV3(flight, {
            minPrice: minPrice > 0 ? minPrice : flight.price,
            hasChild
        });

        return {
            ...flight,
            agentScore: flight.masterScore?.total || legacyScore.score, // Use Master Score as primary
            scoreDetails: {
                total: flight.masterScore?.total || legacyScore.score,
                penalties: legacyScore.penalties,
                pros: legacyScore.pros,
                masterBreakdown: flight.masterScore // Full 100pt breakdown
            }
        } as unknown as FlightResult;
    });

    // Sort by Master Score (already sorted by scoreBatchFlights, but ensure)
    results.sort((a, b) => (b.agentScore || 0) - (a.agentScore || 0));

    return results;
}

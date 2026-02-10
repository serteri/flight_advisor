import { FlightResult, HybridSearchParams } from "@/types/hybridFlight";
import { searchDuffel } from "./providers/duffel";
import { searchRapidApi } from "./providers/rapidapi";
import { scoreFlightV3 } from "@/lib/scoring/flightScoreEngine";

export async function getHybridFlights(params: HybridSearchParams): Promise<FlightResult[]> {
    console.log(`[HybridSearch] Starting search for: ${params.origin} -> ${params.destination}`);

    // 1. DUFFEL + RAPID API (Paralel)
    const [duffelResults, rapidResults] = await Promise.all([
        searchDuffel(params),
        searchRapidApi(params) // Eski tekil fonksiyona döndük
    ]);

    let allFlights = [...duffelResults, ...rapidResults];

    // 2. Market Analysis
    const prices = allFlights.map(f => f.price).filter(p => p > 0);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const hasChild = (params.children || 0) > 0 || (params.infants || 0) > 0;

    // 3. Scoring & Sorting (V3)
    allFlights = allFlights.map(flight => {
        const { score, penalties, pros } = scoreFlightV3(flight, {
            minPrice: minPrice > 0 ? minPrice : flight.price,
            hasChild
        });

        return {
            ...flight,
            agentScore: score,
            scoreDetails: {
                total: score,
                penalties: penalties,
                pros: pros
            }
        };
    });

    allFlights.sort((a, b) => (b.agentScore || 0) - (a.agentScore || 0));

    return allFlights;
}

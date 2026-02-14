import { FlightResult, HybridSearchParams } from "@/types/hybridFlight";
import { searchDuffel } from "./providers/duffel";
import { searchSkyScrapper, searchAirScraper } from "./providers/rapidapi";
// import { searchOpenClaw } from "./providers/openClaw"; 
import { scoreFlightV3 } from "@/lib/scoring/flightScoreEngine";

export async function getHybridFlights(params: HybridSearchParams): Promise<FlightResult[]> {
    console.log(`[HybridSearch] Starting search for: ${params.origin} -> ${params.destination}`);

    // Parallel search across enabled providers (Kiwi removed)
    const [duffelResults, skyResults, airResults] = await Promise.all([
        searchDuffel(params),
        searchSkyScrapper({
            origin: params.origin,
            destination: params.destination,
            date: params.date,
            currency: params.currency,
            cabinClass: params.cabin,
            adults: params.adults
        }),
        searchAirScraper(params),
        // searchOpenClaw(params) // DEVRE DISI
    ]);

    console.log(`[HybridSearch] Results count -> Duffel: ${duffelResults.length}, Sky: ${skyResults.length}, Air: ${airResults.length}`);

    // Hepsini birleştiriyoruz
    let rawFlights: any[] = [
        ...duffelResults,
        ...skyResults,
        ...airResults
    ];

    // 2. Market Analysis (En ucuz fiyatı bul)
    const prices = rawFlights.map(f => f.price).filter(p => p > 0);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const hasChild = (params.children || 0) > 0 || (params.infants || 0) > 0;

    // 3. Scoring & Sorting (V3)
    // Sonuçları FlightResult[] tipine dönüştürüyoruz
    const scoredFlights: FlightResult[] = rawFlights.map(flight => {
        /* 
           TypeScript Hatasını Önlemek İçin:
           flight nesnesini 'any' olarak geçiriyoruz.
        */
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

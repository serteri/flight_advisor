import { searchDuffel } from './providers/duffel';
import { searchRapidAPI } from './providers/rapidapi';
import { scoreFlight, generateInsights } from '@/lib/scoring/flightScoreEngine';
import { FlightResult, HybridSearchParams } from '@/types/hybridFlight';

export async function getHybridFlights(searchParams: HybridSearchParams): Promise<FlightResult[]> {
    // 1. Validate inputs
    if (!searchParams.origin || !searchParams.destination || !searchParams.date) {
        throw new Error("Missing required search parameters");
    }

    // 2. Call providers in parallel
    const [duffelResults, rapidResults] = await Promise.allSettled([
        searchDuffel(searchParams),
        searchRapidAPI(searchParams)
    ]);

    // 3. Normalize and Aggregate
    let allFlights: FlightResult[] = [];

    if (duffelResults.status === 'fulfilled') {
        allFlights = [...allFlights, ...duffelResults.value];
    } else {
        console.error("Duffel search failed", duffelResults.reason);
    }

    if (rapidResults.status === 'fulfilled') {
        allFlights = [...allFlights, ...rapidResults.value];
    } else {
        console.error("RapidAPI search failed", rapidResults.reason);
    }

    // 4. Score and Enrich
    const scoredFlights = allFlights.map(flight => {
        const score = scoreFlight(flight);
        const analysis = generateInsights(flight);

        return {
            ...flight,
            score,
            insights: [...analysis.pros, ...analysis.cons], // Flatten basic insights for list view
            analysis
        };
    });

    // 5. Sort by Score (Desc)
    return scoredFlights.sort((a, b) => (b.score || 0) - (a.score || 0));
}

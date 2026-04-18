import { FlightForScoring } from "@/lib/flightScoreEngine";

// LCC fare search removed — Travelpayouts price-cache API is not suitable for intelligence.
// LCC flights are sourced via Duffel and Priceline in the main search pipeline.
export async function searchLCCFares(
    _origin: string,
    _destination: string,
    _date: string,
): Promise<FlightForScoring[]> {
    return [];
}

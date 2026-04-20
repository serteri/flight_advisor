/**
 * @deprecated
 * Legacy provider stub retained only for staged removal.
 * Only referenced from legacy debug scripts. Safe to delete in Phase 7.
 */
import { FlightResult } from "@/types/hybridFlight";

// DEPRECATED: Generic RapidAPI scraper removed. Priceline is the active RapidAPI source.
export async function searchSkyScrapper(_params: any): Promise<FlightResult[]> {
    return [];
}

export async function searchAirScraper(_params: any): Promise<FlightResult[]> {
    return [];
}

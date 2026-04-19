/**
 * @deprecated — DEAD CODE. Generic RapidAPI scrapers retired.
 * Priceline is the active RapidAPI source (via lib/providers/priceline.ts).
 * Only referenced from legacy debug scripts. Safe to delete in Phase 7.
 * DO NOT import in production code.
 */
import { FlightResult } from "@/types/hybridFlight";

// DEPRECATED: Generic RapidAPI scraper removed. Priceline is the active RapidAPI source.
export async function searchSkyScrapper(_params: any): Promise<FlightResult[]> {
    return [];
}

export async function searchAirScraper(_params: any): Promise<FlightResult[]> {
    return [];
}

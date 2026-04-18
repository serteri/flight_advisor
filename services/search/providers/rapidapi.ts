import { FlightResult } from "@/types/hybridFlight";

// DEPRECATED: Generic RapidAPI scraper removed. Priceline is the active RapidAPI source.
export async function searchSkyScrapper(_params: any): Promise<FlightResult[]> {
    return [];
}

export async function searchAirScraper(_params: any): Promise<FlightResult[]> {
    return [];
}

import { FlightResult } from "@/types/hybridFlight";

// DEPRECATED: Replaced by Aviasales (Travelpayouts)
export async function searchSkyScrapper(params: any): Promise<FlightResult[]> {
  console.warn('⚠️ RapidAPI provider disabled - using Aviasales instead');
  return [];
}

export async function searchAirScraper(params: any): Promise<FlightResult[]> {
  return [];
}

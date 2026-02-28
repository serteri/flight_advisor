import { FlightResult, HybridSearchParams } from "@/types/hybridFlight";
import { searchPriceline } from '@/lib/providers/priceline';

// Retired: SerpApi provider replaced by Priceline RapidAPI integration.
export async function searchSerpApi(params: HybridSearchParams): Promise<FlightResult[]> {
  return searchPriceline(params);
}

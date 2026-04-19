import { FlightResult, HybridSearchParams } from "@/types/hybridFlight";
import { searchPriceline } from '@/lib/providers/priceline';

// Retired: SerpApi provider replaced by Priceline RapidAPI integration.
// NOTE: Results from this alias carry source: 'priceline' (set by searchPriceline),
// not 'serpapi'. Do not wire into active search pipeline without adding source override.
export async function searchSerpApi(params: HybridSearchParams): Promise<FlightResult[]> {
  return searchPriceline(params);
}

import { FlightResult, HybridSearchParams } from '@/types/hybridFlight';
import { searchPriceline } from '@/lib/providers/priceline';

export async function searchPricelineProvider(params: HybridSearchParams): Promise<FlightResult[]> {
    return searchPriceline(params);
}

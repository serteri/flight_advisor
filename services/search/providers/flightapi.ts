/**
 * @deprecated
 * Legacy flight-search provider adapter retained only for staged removal.
 */
import type { HybridSearchParams, FlightResult } from '@/types/hybridFlight';
import { searchFlightAPI, FlightAPIError } from '@/lib/providers/flightapi';
import { mapFlightAPIResponse } from '@/lib/parser/flightapiMapper';

export async function searchFlightAPIProvider(params: HybridSearchParams): Promise<FlightResult[]> {
    const start = Date.now();
    try {
        const data = await searchFlightAPI(params);
        const results = mapFlightAPIResponse(data);
        const elapsed = Date.now() - start;
        console.log(`[FlightAPI] Mapped ${results.length} flights (${elapsed}ms)`);
        return results;
    } catch (err) {
        if (err instanceof FlightAPIError) {
            console.error('[FlightAPI] Provider error:', err.message);
        } else {
            console.error('[FlightAPI] Unexpected error:', err);
        }
        return [];
    }
}

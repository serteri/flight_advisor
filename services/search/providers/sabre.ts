import type { HybridSearchParams, FlightResult } from '@/types/hybridFlight';
import { searchSabreFlights, SabreAuthError, SabreSearchError } from '@/lib/providers/sabre';
import { mapSabreToFlightResult } from '@/lib/parser/sabreMapper';

export async function searchSabreProvider(params: HybridSearchParams): Promise<FlightResult[]> {
    try {
        const itineraries = await searchSabreFlights(params);
        const results: FlightResult[] = [];
        for (const itin of itineraries) {
            const mapped = mapSabreToFlightResult(itin);
            if (mapped) results.push(mapped);
        }
        console.log(`[Sabre] Mapped ${results.length} / ${itineraries.length} itineraries`);
        return results;
    } catch (err) {
        if (err instanceof SabreAuthError) {
            console.error('[Sabre] Auth error:', err.message);
        } else if (err instanceof SabreSearchError) {
            console.error('[Sabre] Search error:', err.message);
        } else {
            console.error('[Sabre] Unexpected error:', err);
        }
        return [];
    }
}

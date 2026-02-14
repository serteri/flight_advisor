import { FlightResult, HybridSearchParams } from '@/types/hybridFlight';
import { getDuffel } from '@/lib/duffel';
import { mapDuffelToPremiumAgent } from '@/lib/parser/duffelMapper';

export async function searchDuffel(params: HybridSearchParams): Promise<FlightResult[]> {
    console.log(`[Duffel] Searching for ${params.origin} -> ${params.destination} on ${params.date}`);
    
    try {
        // instantiate client at call-time so token is read from env when needed
        const client = getDuffel();
        // @ts-ignore
        const res = await client.offerRequests.create({
            slices: [{
                origin: params.origin,
                destination: params.destination,
                departure_date: params.date
            }] as any,
            passengers: [{ type: 'adult' }],
            cabin_class: 'economy',
        });

        const offers = res.data.offers.map(mapDuffelToPremiumAgent);
        console.log(`🛫 DUFFEL returned ${offers.length} offers`);
        return offers;
    } catch (err: any) {
        // Enhanced logging for authentication issues
        const status = err?.meta?.status || err?.status;
        const requestId = err?.meta?.request_id || err?.meta?.requestId || '';
        if (status === 401) {
            console.error('🔥 DUFFEL AUTH ERROR: 401 Unauthorized - Access token invalid or not found.');
            console.error('RequestId:', requestId);
            console.error('Hint: rotate or verify `DUFFEL_ACCESS_TOKEN` in your environment.');
        } else {
            console.error('🔥 DUFFEL ERROR:', err?.message || err);
        }
        return [];
    }
}

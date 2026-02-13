import { FlightResult, HybridSearchParams } from '@/types/hybridFlight';
import { duffel } from '@/lib/duffel';
import { mapDuffelToPremiumAgent } from '@/lib/parser/duffelMapper';

export async function searchDuffel(params: HybridSearchParams): Promise<FlightResult[]> {
    console.log(`[Duffel] Searching for ${params.origin} -> ${params.destination} on ${params.date}`);
    
    try {
        // @ts-ignore
        const res = await duffel.offerRequests.create({
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
        console.error('🔥 DUFFEL ERROR:', err?.message || err);
        return [];
    }
}

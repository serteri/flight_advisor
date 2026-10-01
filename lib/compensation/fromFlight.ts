// lib/compensation/fromFlight.ts
//
// Maps normalized provider data onto the compensation engine input.
// An arrival time counts as "actual" only once the flight has landed —
// estimates before landing never produce LIKELY_ELIGIBLE.

import type { NormalizedFlight } from '@/lib/flightData/aerodatabox';
import type { CompensationInput } from './engine';

export function compensationInputFromFlight(
    flight: NormalizedFlight,
    journey: { originIata: string; finalDestinationIata: string; carrierIata: string | null },
    extra: { cancellationNoticeUtc?: string | null } = {},
): CompensationInput {
    const landed = flight.status === 'landed';
    return {
        disruption: flight.status === 'cancelled' ? 'CANCELLATION' : 'DELAY',
        carrierIata: journey.carrierIata ?? flight.airlineIata,
        originIata: journey.originIata,
        finalDestinationIata: journey.finalDestinationIata,
        scheduledDepartureUtc: flight.scheduledDepartureUtc,
        scheduledArrivalUtc: flight.scheduledArrivalUtc,
        // AeroDataBox exposes no explicit gate-in time.
        actualGateArrivalUtc: null,
        actualArrivalUtc: landed ? flight.revisedArrivalUtc || flight.runwayArrivalUtc : null,
        cancellationNoticeUtc: extra.cancellationNoticeUtc ?? null,
    };
}

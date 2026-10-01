// lib/compensation/tripCompensation.ts
//
// One place that turns a stored trip into engine input, so the trip page, the
// banner and the claim letter always show the same result.

import { evaluateCompensation, type CompensationInput, type CompensationResult } from './engine';

export interface TripForCompensation {
    routeUnknown?: boolean | null;
    segments: Array<{
        airlineCode: string;
        origin: string;
        destination: string;
        scheduledDepartureUtc: Date | null;
    }>;
    snapshot: { status?: string | null; delayMinutes?: number | null } | null;
}

export function compensationInputFromTrip(trip: TripForCompensation): CompensationInput | null {
    const first = trip.segments[0];
    const last = trip.segments[trip.segments.length - 1];
    if (!first || !last) return null;
    const disruption = trip.snapshot?.status?.toUpperCase() === 'CANCELLED' ? 'CANCELLATION' : 'DELAY';
    return {
        disruption,
        carrierIata: first.airlineCode,
        originIata: first.origin,
        finalDestinationIata: last.destination,
        scheduledDepartureUtc: first.scheduledDepartureUtc?.toISOString() ?? null,
        // No snapshot yet = no arrival data: the engine returns NEEDS_INFO.
        arrivalDelayMinutes: trip.snapshot ? (trip.snapshot.delayMinutes ?? null) : null,
    };
}

/** Engine result for a trip; NEEDS_INFO when the route is unknown or there are no segments. */
export function evaluateTripCompensation(trip: TripForCompensation): CompensationResult {
    const input = compensationInputFromTrip(trip);
    if (!input || trip.routeUnknown) {
        return {
            regime: 'NONE',
            status: 'NEEDS_INFO',
            amount: null,
            currency: null,
            distanceKm: null,
            reasons: ['The route of this flight is not known yet, so compensation cannot be assessed.'],
        };
    }
    return evaluateCompensation(input);
}

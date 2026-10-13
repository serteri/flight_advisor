// lib/guardian/verifiedFlight.ts
//
// What a leg chosen in the form's "find my flight" step writes onto the trip,
// and the rule that makes opt-in skip the provider (the form already paid for
// that lookup).

import type { FlightLegOption } from '@/lib/flightData/legs';

export interface VerifiedSegmentData {
    origin: string;
    destination: string;
    scheduledDepartureUtc: Date | null;
    scheduledArrivalUtc: Date | null;
    arrivalDate: Date;
}

/** Segment fields from the chosen leg; null when the leg lacks either airport (then it is not "verified"). */
export function verifiedSegmentData(leg: FlightLegOption, fallbackDate: Date): VerifiedSegmentData | null {
    const origin = leg.origin.iata;
    const destination = leg.destination.iata;
    if (!origin || !destination) return null;
    const arrivalUtc = leg.arrivalUtc ? new Date(leg.arrivalUtc) : null;
    return {
        origin,
        destination,
        scheduledDepartureUtc: leg.departureUtc ? new Date(leg.departureUtc) : null,
        scheduledArrivalUtc: arrivalUtc,
        arrivalDate: arrivalUtc ?? fallbackDate,
    };
}

/** Opt-in makes no second provider call for a trip whose leg was resolved in the form. */
export const skipRegistrationLookup = (trip: { flightVerifiedAt?: Date | null }): boolean => Boolean(trip.flightVerifiedAt);

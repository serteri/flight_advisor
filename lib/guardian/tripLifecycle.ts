// lib/guardian/tripLifecycle.ts
//
// Trip-level orchestration around the pure checkpoint planner:
//  - per-trip provider call budget (MAX_CALLS_PER_TRIP)
//  - applying provider route/schedule data to the stored segment
//  - (re)planning QStash checkpoints and monitoringEndsAt

import { prisma } from '@/lib/prisma';
import type { NormalizedFlight } from '@/lib/flightData/aerodatabox';
import { lookupFlight, type FlightLookupResult } from '@/lib/flightData/client';
import { MAX_CALLS_PER_TRIP, type CheckKind } from '@/lib/flightData/quotaPolicy';
import {
    monitoringEndsAt,
    planCheckpoints,
    resolveTripSchedule,
    scheduleChanged,
    type TripSchedule,
} from '@/lib/guardian/checkpoints';
import { cancelPendingChecks, scheduleTripChecks } from '@/lib/guardian/scheduler';
import { skipRegistrationLookup } from '@/lib/guardian/verifiedFlight';
import { defaultFlightNotFoundDeps, handleFlightNotFound, isFlightNotFound } from '@/lib/guardian/flightNotFound';
import { defaultPendingVerificationDeps, deferVerification, notFoundDecision } from '@/lib/guardian/flightVerification';

const UNKNOWN_IATA = 'UNK';

// Kinds that belong to the regular plan (re-planned on schedule changes).
const REGULAR_KINDS = ['DEP_MINUS_24H', 'DEP_MINUS_3H', 'DEP', 'ARR_PLUS_1H', 'ARR_PLUS_4H', 'COMPLETE'];

export interface SegmentLike {
    id: string;
    airlineCode: string;
    flightNumber: string;
    origin: string;
    destination: string;
    departureDate: Date;
    arrivalDate: Date;
    scheduledDepartureUtc: Date | null;
    scheduledArrivalUtc: Date | null;
}

export const segmentFlightNumber = (segment: SegmentLike) =>
    `${segment.airlineCode}${segment.flightNumber}`.toUpperCase().replace(/\s+/g, '');

// The local flight date AeroDataBox expects (YYYY-MM-DD).
export const segmentLookupDate = (segment: SegmentLike) => segment.departureDate.toISOString().slice(0, 10);

export const isUnknownIata = (code: string | null | undefined) =>
    !code || code.trim().toUpperCase() === UNKNOWN_IATA;

// Atomically reserves one provider call for the trip. False when the per-trip
// cap is reached — the caller must not call the provider.
export async function reserveProviderCall(tripId: string): Promise<boolean> {
    const reserved = await prisma.monitoredTrip.updateMany({
        where: { id: tripId, apiCallsUsed: { lt: MAX_CALLS_PER_TRIP } },
        data: { apiCallsUsed: { increment: 1 } },
    });
    return reserved.count === 1;
}

// Gives a reserved call back (a retried TEMPORARY failure must not eat the
// per-trip budget that the remaining checkpoints need).
export async function releaseProviderCall(tripId: string): Promise<void> {
    await prisma.monitoredTrip.updateMany({
        where: { id: tripId, apiCallsUsed: { gt: 0 } },
        data: { apiCallsUsed: { decrement: 1 } },
    });
}

// Reserves a call then looks the flight up. Returns null when the cap blocks it.
export async function lookupWithinBudget(
    tripId: string,
    segment: SegmentLike,
    kind: CheckKind,
): Promise<FlightLookupResult | null> {
    if (!(await reserveProviderCall(tripId))) {
        console.warn(`[Guardian] Trip ${tripId} reached ${MAX_CALLS_PER_TRIP} provider calls — ${kind} not executed`);
        return null;
    }
    // A known route pins the leg (a number can fly several legs a day).
    const leg = !isUnknownIata(segment.origin) && !isUnknownIata(segment.destination)
        ? { origin: segment.origin.toUpperCase(), destination: segment.destination.toUpperCase() }
        : undefined;
    return lookupFlight(segmentFlightNumber(segment), segmentLookupDate(segment), kind, { leg });
}

export interface AppliedFlightData {
    segment: SegmentLike;
    routeUnknown: boolean;
    scheduleChanged: boolean;
}

// Writes provider route + scheduled times to the segment and the trip. The
// route is only filled in when it was unknown; a known route is never
// overwritten silently. routeUnknown stays true until both airports are known.
export async function applyFlightDataToTrip(
    tripId: string,
    segment: SegmentLike,
    flight: NormalizedFlight,
): Promise<AppliedFlightData> {
    const nextDeparture = flight.scheduledDepartureUtc ? new Date(flight.scheduledDepartureUtc) : null;
    const nextArrival = flight.scheduledArrivalUtc ? new Date(flight.scheduledArrivalUtc) : null;

    const changed = scheduleChanged(
        { departureUtc: segment.scheduledDepartureUtc, arrivalUtc: segment.scheduledArrivalUtc },
        { departureUtc: nextDeparture, arrivalUtc: nextArrival },
    );

    const origin = isUnknownIata(segment.origin) && flight.origin.iata ? flight.origin.iata : segment.origin;
    const destination = isUnknownIata(segment.destination) && flight.destination.iata
        ? flight.destination.iata
        : segment.destination;
    const routeUnknown = isUnknownIata(origin) || isUnknownIata(destination);

    const updatedSegment = await prisma.flightSegment.update({
        where: { id: segment.id },
        data: {
            origin,
            destination,
            ...(nextDeparture ? { scheduledDepartureUtc: nextDeparture } : {}),
            ...(nextArrival ? { scheduledArrivalUtc: nextArrival, arrivalDate: nextArrival } : {}),
        },
    });

    await prisma.monitoredTrip.update({
        where: { id: tripId },
        data: {
            routeUnknown,
            ...(!routeUnknown && (origin !== segment.origin || destination !== segment.destination)
                ? { routeLabel: `${origin} ➝ ${destination}` }
                : {}),
        },
    });

    return { segment: updatedSegment, routeUnknown, scheduleChanged: changed };
}

// Cancels the pending regular plan and schedules a fresh one from `schedule`.
export async function replanTripChecks(
    tripId: string,
    schedule: TripSchedule,
    now: Date,
    options: { excludeCheckId?: string } = {},
): Promise<void> {
    await cancelPendingChecks(tripId, { kinds: REGULAR_KINDS, excludeCheckId: options.excludeCheckId });
    await prisma.monitoredTrip.update({
        where: { id: tripId },
        data: { monitoringEndsAt: monitoringEndsAt(schedule) },
    });
    await scheduleTripChecks(tripId, planCheckpoints(schedule, now));
}

// Called once a trip is ACTIVE: one registration lookup (route + schedule),
// then the checkpoint plan. Works with approximate times if the lookup fails.
// NOT_FOUND from the provider: final only ≤7 days before departure
// (FLIGHT_NOT_FOUND + one email); further out the schedule may simply not be
// published yet → PENDING_VERIFICATION, no email, one VERIFY_FLIGHT check at −7 days.
export async function routeFlightNotFound(
    tripId: string,
    segment: SegmentLike,
    now: Date,
    options: { source: 'REGISTRATION' | 'CHECKPOINT'; excludeCheckId?: string },
): Promise<'FLIGHT_NOT_FOUND' | 'PENDING_VERIFICATION' | 'UNCHANGED'> {
    const { departureUtc } = resolveTripSchedule(segment);
    if (notFoundDecision(departureUtc, now) === 'DEFER') {
        const res = await deferVerification(tripId, departureUtc, now, await defaultPendingVerificationDeps(), { excludeCheckId: options.excludeCheckId });
        return res.transitioned ? 'PENDING_VERIFICATION' : 'UNCHANGED';
    }
    const res = await handleFlightNotFound(tripId, await defaultFlightNotFoundDeps(), options);
    return res.transitioned ? 'FLIGHT_NOT_FOUND' : 'UNCHANGED';
}

// VERIFY_FLIGHT verdict "monitor it": PENDING_VERIFICATION → ACTIVE, apply the
// provider data when there is some, then the normal checkpoint plan. Without
// provider data (verification couldn't run) the plan uses approximate times.
export async function activateAfterVerification(
    tripId: string,
    segment: SegmentLike,
    flight: NormalizedFlight | null,
    now: Date,
    options: { excludeCheckId?: string } = {},
): Promise<boolean> {
    const activated = await prisma.monitoredTrip.updateMany({
        where: { id: tripId, status: 'PENDING_VERIFICATION' },
        data: { status: 'ACTIVE' },
    });
    if (activated.count !== 1) return false;
    const current = flight ? (await applyFlightDataToTrip(tripId, segment, flight)).segment : segment;
    await replanTripChecks(tripId, resolveTripSchedule(current), now, { excludeCheckId: options.excludeCheckId });
    return true;
}

export async function initializeTripMonitoring(tripId: string, now = new Date()): Promise<void> {
    const trip = await prisma.monitoredTrip.findUnique({
        where: { id: tripId },
        include: { segments: { orderBy: { segmentOrder: 'asc' } } },
    });
    if (!trip || trip.status !== 'ACTIVE') return;

    let segment: SegmentLike | undefined = trip.segments[0];
    if (!segment) {
        console.error(`[Guardian] Trip ${tripId} has no flight segment — monitoring not scheduled`);
        return;
    }

    // The form's "find my flight" step already resolved this leg (route + times are
    // stored on the segment): plan from that, no second provider call.
    if (skipRegistrationLookup(trip)) {
        await replanTripChecks(tripId, resolveTripSchedule(segment), now);
        return;
    }

    const result = await lookupWithinBudget(tripId, segment, 'REGISTRATION');
    // Flight validation at opt-in: a flight the provider doesn't know is never
    // monitored — definitive only within 7 days of departure (see routeFlightNotFound).
    if (isFlightNotFound(result)) {
        await routeFlightNotFound(tripId, segment, now, { source: 'REGISTRATION' });
        return;
    }
    if (result?.ok) {
        segment = (await applyFlightDataToTrip(tripId, segment, result.flight)).segment;
    } else {
        if (result && !result.ok) {
            console.warn(`[Guardian] Registration lookup failed for trip ${tripId}: ${result.code} ${result.message}`);
        }
        if (isUnknownIata(segment.origin) || isUnknownIata(segment.destination)) {
            await prisma.monitoredTrip.update({ where: { id: tripId }, data: { routeUnknown: true } });
        }
    }

    const schedule = resolveTripSchedule(segment);
    await replanTripChecks(tripId, schedule, now);
}

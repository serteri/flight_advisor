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
import { defaultFlightNotFoundDeps, handleFlightNotFound, isFlightNotFound } from '@/lib/guardian/flightNotFound';

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
    return lookupFlight(segmentFlightNumber(segment), segmentLookupDate(segment), kind);
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

    const result = await lookupWithinBudget(tripId, segment, 'REGISTRATION');
    // Flight validation at opt-in: a flight the provider doesn't know is never monitored.
    if (isFlightNotFound(result)) {
        await handleFlightNotFound(tripId, await defaultFlightNotFoundDeps(), { source: 'REGISTRATION' });
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

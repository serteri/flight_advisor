// workers/guardianWorker.ts
//
// Event-driven trip check. Invoked by /api/guardian/check (QStash) for ONE
// planned checkpoint of ONE trip: read the trip, make at most one provider
// call, derive events against the previous snapshot, write the result.
// There is no polling loop — see lib/guardian/checkpoints.ts for the plan.

import { createHash, randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { evaluateCompensation, type CompensationResult } from "@/lib/compensation/engine";
import { compensationInputFromFlight } from "@/lib/compensation/fromFlight";
import { notifyGuardianEvent } from "@/services/notifications/guardianNotifier";
import { sendDisruptionAlert } from "@/lib/email/sender";
import { recordGuardianMetric } from "@/services/healthMetrics";
import { MonitoringEventType, recordMonitoringEvent } from "@/lib/alertLifecycle";
import { arrivalDelayMinutes, bestArrivalEstimateUtc, type NormalizedFlight } from "@/lib/flightData/aerodatabox";
import type { CheckKind } from "@/lib/flightData/quotaPolicy";
import { planExtraCheck, resolveTripSchedule } from "@/lib/guardian/checkpoints";
import { cancelPendingChecks, scheduleTripChecks } from "@/lib/guardian/scheduler";
import {
    activateAfterVerification,
    applyFlightDataToTrip,
    lookupWithinBudget,
    replanTripChecks,
    routeFlightNotFound,
    segmentFlightNumber,
} from "@/lib/guardian/tripLifecycle";
import { isFlightNotFound } from "@/lib/guardian/flightNotFound";
import { verifyCheckOutcome } from "@/lib/guardian/flightVerification";

export type GuardianEventType = 'DELAY' | 'GATE_CHANGE' | 'CANCELLED' | 'DATA_ISSUE' | 'EQUIPMENT_CHANGE';
export type GuardianEventSeverity = 'low' | 'medium' | 'high';

export interface GuardianEvent {
    eventId?: string;
    alertEventId?: string;
    tripId: string;
    type: GuardianEventType;
    lifecycleEventType?: MonitoringEventType;
    subType?: string;
    detailHash?: string;
    severity: GuardianEventSeverity;
    previous: any;
    current: any;
    detectedAt: string;
}

export type TripCheckOutcome = {
    status: 'DONE' | 'SKIPPED' | 'FAILED' | 'RETRY';
    reason?: string;
    events?: number;
};

type ComputedStatus = 'ON_TIME' | 'DELAYED' | 'CANCELLED' | 'UNKNOWN';

const LEASE_MS = 10 * 60 * 1000;
const INACTIVE_TRIP_STATUSES = new Set(['COMPLETED', 'ARCHIVED', 'PENDING_CONFIRMATION', 'FLIGHT_NOT_FOUND']);

// Delay alert thresholds (arrival delay, minutes). 180 and 240 are the EU261/
// UK261 thresholds (3h eligibility, 4h full long-haul amount) — crossing them
// re-evaluates compensation instead of stopping at 60.
export const DELAY_BUCKETS = [15, 30, 60, 180, 240] as const;
const BUCKET_SEVERITY: Record<number, GuardianEventSeverity> = { 15: 'low', 30: 'medium', 60: 'medium', 180: 'high', 240: 'high' };

export const getDelayBucket = (minutes: number): number => {
    let bucket = 0;
    for (const threshold of DELAY_BUCKETS) {
        if (minutes >= threshold) bucket = threshold;
    }
    return bucket;
};

const normalizeCode = (value: unknown): string => String(value || '').trim().toUpperCase();

const makeDetailHash = (detail: unknown): string => {
    const payload = typeof detail === 'string' ? detail : JSON.stringify(detail || {});
    return createHash('sha1').update(payload).digest('hex').slice(0, 10);
};

const buildTransitionMarker = (snapshot: any): string => {
    const snapshotAt = snapshot?.snapshotAt ? new Date(snapshot.snapshotAt).toISOString() : 'initial';
    const status = normalizeCode(snapshot?.status || 'UNKNOWN');
    return `${status}@${snapshotAt}`;
};

const buildEventId = (tripId: string, eventType: GuardianEventType, subType: string, detailHash: string) => {
    return `${tripId}:${eventType}:${subType}:${detailHash}`;
};

const mapGuardianEventType = (eventType: GuardianEventType, subType?: string): MonitoringEventType => {
    if (eventType === 'DELAY') return 'DELAY_DETECTED';
    if (eventType === 'CANCELLED') return 'CANCELLATION_DETECTED';
    if (eventType === 'GATE_CHANGE') {
        return subType?.includes('terminal') ? 'TERMINAL_CHANGE' : 'GATE_CHANGE';
    }
    return 'STATUS_UNAVAILABLE';
};

const severityLabel = (severity: GuardianEventSeverity): 'LOW' | 'MEDIUM' | 'HIGH' => {
    if (severity === 'high') return 'HIGH';
    if (severity === 'medium') return 'MEDIUM';
    return 'LOW';
};

// ─── LEAD GENERATION — proactive "check your rights" email ─────────────────
// Sent at most once per trip, and only when the compensation engine says so:
//  - delay: LIKELY_ELIGIBLE (arrival delay ≥180 min measured after landing)
//  - cancellation: EU261/UK261 in scope and not ruled out (LIKELY_ELIGIBLE or
//    NEEDS_INFO because the notice date is unknown)
// Never below 180 minutes, never when the route is unknown.

type ClaimRuleType = 'COMPENSATION_CANCELLED' | 'COMPENSATION_DELAYED';

export function proactiveClaimRuleType(
    computedStatus: ComputedStatus,
    compensation: CompensationResult | null,
): ClaimRuleType | null {
    if (!compensation || compensation.regime === 'NONE') return null;
    if (computedStatus === 'CANCELLED') {
        return compensation.status === 'NOT_ELIGIBLE' ? null : 'COMPENSATION_CANCELLED';
    }
    return compensation.status === 'LIKELY_ELIGIBLE' ? 'COMPENSATION_DELAYED' : null;
}

const computeStatus = (flight: NormalizedFlight, delayMinutes: number | null): ComputedStatus => {
    if (flight.status === 'cancelled') return 'CANCELLED';
    if (delayMinutes === null) return 'UNKNOWN';
    return delayMinutes >= 15 ? 'DELAYED' : 'ON_TIME';
};

// Aircraft values stored before provider-model tracking were bare IATA/ICAO
// type codes ("738", "B738"); they are not comparable with AeroDataBox model
// names ("Boeing 737-800") and are replaced silently instead of alerting.
const isComparableAircraftValue = (value: string) => !/^[A-Z0-9]{3,4}$/.test(value.trim().toUpperCase());

export async function processTripCheck(
    tripId: string,
    checkId: string | null,
    now = new Date(),
): Promise<TripCheckOutcome> {
    const check = checkId ? await prisma.scheduledTripCheck.findUnique({ where: { id: checkId } }) : null;
    if (checkId && (!check || check.tripId !== tripId)) {
        return { status: 'SKIPPED', reason: 'check-not-found' };
    }
    if (check && check.status !== 'SCHEDULED') {
        return { status: 'SKIPPED', reason: `check-already-${check.status.toLowerCase()}` };
    }
    const kind = (check?.kind ?? 'DEP') as CheckKind;

    const markCheck = async (status: 'DONE' | 'SKIPPED' | 'FAILED', error?: string) => {
        if (!check) return;
        await prisma.scheduledTripCheck.update({
            where: { id: check.id },
            data: { status, error: error ? error.slice(0, 500) : null },
        });
    };

    const trip = await prisma.monitoredTrip.findUnique({
        where: { id: tripId },
        include: { segments: { orderBy: { segmentOrder: 'asc' } }, snapshot: true, user: true },
    });
    if (!trip) {
        return { status: 'SKIPPED', reason: 'trip-missing' };
    }
    if (INACTIVE_TRIP_STATUSES.has(trip.status)) {
        await markCheck('SKIPPED', `trip is ${trip.status}`);
        return { status: 'SKIPPED', reason: `trip-${trip.status.toLowerCase()}` };
    }
    // A trip waiting for flight verification only runs its VERIFY_FLIGHT check.
    if (trip.status === 'PENDING_VERIFICATION' && kind !== 'VERIFY_FLIGHT') {
        await markCheck('SKIPPED', 'trip is PENDING_VERIFICATION');
        return { status: 'SKIPPED', reason: 'trip-pending-verification' };
    }
    if (kind === 'VERIFY_FLIGHT' && trip.status !== 'PENDING_VERIFICATION') {
        await markCheck('SKIPPED', `verification not needed (trip is ${trip.status})`);
        return { status: 'SKIPPED', reason: 'verify-not-needed' };
    }

    // Lifecycle: scheduled arrival + 48h → COMPLETED, no provider call.
    if (kind === 'COMPLETE' || (trip.monitoringEndsAt && now.getTime() >= trip.monitoringEndsAt.getTime())) {
        await prisma.monitoredTrip.update({ where: { id: trip.id }, data: { status: 'COMPLETED', lastCheckedAt: now } });
        await cancelPendingChecks(trip.id, { excludeCheckId: check?.id });
        await markCheck(kind === 'COMPLETE' ? 'DONE' : 'SKIPPED', kind === 'COMPLETE' ? undefined : 'monitoring window ended');
        return { status: 'DONE', reason: 'completed' };
    }

    const segment = trip.segments[0];
    if (!segment) {
        await markCheck('SKIPPED', 'trip has no flight segment');
        return { status: 'SKIPPED', reason: 'no-segment' };
    }

    const leaseId = randomUUID();
    const leased = await prisma.monitoredTrip.updateMany({
        where: {
            id: trip.id,
            OR: [{ processingLeaseExpiresAt: null }, { processingLeaseExpiresAt: { lte: now } }],
        },
        data: { processingLeaseId: leaseId, processingLeaseExpiresAt: new Date(now.getTime() + LEASE_MS) },
    });
    if (leased.count === 0) {
        return { status: 'RETRY', reason: 'lease-held' };
    }

    try {
        return await runLeasedCheck({ trip, segment, check, kind, now, markCheck });
    } finally {
        await prisma.monitoredTrip.updateMany({
            where: { id: trip.id, processingLeaseId: leaseId },
            data: { processingLeaseId: null, processingLeaseExpiresAt: null },
        });
    }
}

type LoadedTrip = NonNullable<Awaited<ReturnType<typeof loadTripShape>>>;
// Type helper only (never called): mirrors the include used in processTripCheck.
const loadTripShape = (id: string) => prisma.monitoredTrip.findUnique({
    where: { id },
    include: { segments: { orderBy: { segmentOrder: 'asc' } }, snapshot: true, user: true },
});

async function runLeasedCheck(ctx: {
    trip: LoadedTrip;
    segment: LoadedTrip['segments'][number];
    check: { id: string } | null;
    kind: CheckKind;
    now: Date;
    markCheck: (status: 'DONE' | 'SKIPPED' | 'FAILED', error?: string) => Promise<void>;
}): Promise<TripCheckOutcome> {
    const { trip, kind, now, markCheck } = ctx;
    let segment = ctx.segment;

    const result = await lookupWithinBudget(trip.id, segment, kind);
    // VERIFY_FLIGHT (far-future flight not found at registration, now −7 days):
    // found → ACTIVE + normal plan; not found → definitive FLIGHT_NOT_FOUND flow;
    // no verdict → retry in 12 h, or monitor approximately when time/calls run out.
    if (kind === 'VERIFY_FLIGHT') {
        const outcome = verifyCheckOutcome(result, resolveTripSchedule(segment).departureUtc, now);
        if (outcome.action === 'NOT_FOUND') {
            const routed = await routeFlightNotFound(trip.id, segment, now, { source: 'CHECKPOINT', excludeCheckId: ctx.check?.id });
            await markCheck('DONE', `NOT_FOUND at verification → ${routed}`);
            return { status: 'DONE', reason: 'flight-not-found' };
        }
        if (outcome.action === 'RETRY') {
            await scheduleTripChecks(trip.id, [outcome.check]);
            await markCheck('FAILED', `${result && !result.ok ? result.code : 'no result'} — verification retry at ${outcome.check.runAt.toISOString()}`);
            return { status: 'FAILED', reason: 'verify-retry' };
        }
        await activateAfterVerification(trip.id, segment, outcome.action === 'ACTIVATE' && result?.ok ? result.flight : null, now, { excludeCheckId: ctx.check?.id });
        await markCheck('DONE', outcome.action === 'ACTIVATE' ? undefined : 'could not verify — monitoring with approximate plan');
        return { status: 'DONE', reason: outcome.action === 'ACTIVATE' ? 'flight-verified' : 'verify-gave-up' };
    }
    if (!result) {
        await markCheck('SKIPPED', 'per-trip provider call cap reached');
        return { status: 'SKIPPED', reason: 'trip-call-cap' };
    }
    // Flight validation at every checkpoint: provider says the flight doesn't
    // exist → FLIGHT_NOT_FOUND, remaining checks cancelled, no alert emails, one
    // "we couldn't find your flight" email (lib/guardian/flightNotFound.ts).
    // Definitive only ≤7 days before departure; further out → PENDING_VERIFICATION.
    if (isFlightNotFound(result)) {
        const outcome = await routeFlightNotFound(trip.id, segment, now, {
            source: 'CHECKPOINT',
            excludeCheckId: ctx.check?.id,
        });
        await markCheck('DONE', `NOT_FOUND: flight not found by provider → ${outcome}`);
        return { status: 'DONE', reason: outcome === 'FLIGHT_NOT_FOUND' ? 'flight-not-found' : outcome === 'PENDING_VERIFICATION' ? 'pending-verification' : 'flight-not-found-already-handled' };
    }
    if (!result.ok) {
        await prisma.monitoredTrip.update({ where: { id: trip.id }, data: { lastCheckedAt: now } });
        const skipped = result.code === 'QUOTA_BLOCKED';
        await markCheck(skipped ? 'SKIPPED' : 'FAILED', `${result.code}: ${result.message}`);
        return { status: skipped ? 'SKIPPED' : 'FAILED', reason: result.code };
    }

    const flight = result.flight;
    const applied = await applyFlightDataToTrip(trip.id, segment, flight);
    segment = { ...segment, ...applied.segment };

    if (applied.scheduleChanged) {
        await replanTripChecks(trip.id, resolveTripSchedule(segment), now, { excludeCheckId: ctx.check?.id });
    }

    const estimatedArrival = bestArrivalEstimateUtc(flight);
    if (flight.status !== 'landed' && flight.status !== 'cancelled') {
        const extraAlreadyPlanned = kind === 'EXTRA_ARR_PLUS_1H' || (await prisma.scheduledTripCheck.count({
            where: { tripId: trip.id, kind: 'EXTRA_ARR_PLUS_1H', status: { in: ['SCHEDULED', 'DONE'] } },
        })) > 0;
        const extraAt = planExtraCheck({
            scheduledArrivalUtc: flight.scheduledArrivalUtc ? new Date(flight.scheduledArrivalUtc) : null,
            estimatedArrivalUtc: estimatedArrival ? new Date(estimatedArrival) : null,
            now,
            extraAlreadyPlanned,
        });
        if (extraAt) {
            await scheduleTripChecks(trip.id, [{ kind: 'EXTRA_ARR_PLUS_1H', runAt: extraAt }]);
        }
    }

    const events = await deriveAndDispatchEvents({ trip, segment, flight, routeUnknown: applied.routeUnknown, now });

    // After a detected cancellation, further provider checks cannot change the
    // outcome — cancel them to save quota; COMPLETE still closes the trip.
    if (events.computedStatus === 'CANCELLED') {
        await cancelPendingChecks(trip.id, {
            kinds: ['DEP_MINUS_24H', 'DEP_MINUS_3H', 'DEP', 'ARR_PLUS_1H', 'ARR_PLUS_4H', 'EXTRA_ARR_PLUS_1H'],
            excludeCheckId: ctx.check?.id,
        });
    }

    const nextPending = await prisma.scheduledTripCheck.findFirst({
        where: { tripId: trip.id, status: 'SCHEDULED', ...(ctx.check ? { id: { not: ctx.check.id } } : {}) },
        orderBy: { runAt: 'asc' },
        select: { runAt: true },
    });

    await prisma.$transaction([
        prisma.monitoredTrip.update({
            where: { id: trip.id },
            data: { lastCheckedAt: now, nextCheckAt: nextPending?.runAt ?? trip.monitoringEndsAt ?? now },
        }),
        prisma.tripSnapshot.upsert({
            where: { tripId: trip.id },
            create: { tripId: trip.id, ...events.snapshot },
            update: events.snapshot,
        }),
    ]);

    await markCheck('DONE');
    return { status: 'DONE', events: events.count };
}

async function deriveAndDispatchEvents(ctx: {
    trip: LoadedTrip;
    segment: LoadedTrip['segments'][number];
    flight: NormalizedFlight;
    routeUnknown: boolean;
    now: Date;
}) {
    const { trip, segment, flight, routeUnknown } = ctx;

    try {
        recordGuardianMetric({ tripId: trip.id, notificationAttempted: false, timestamp: new Date() });
    } catch (err) {
        console.debug('[GuardianMetrics] Error recording check metric:', err);
    }

    const previousState = (trip.snapshot as any) ?? {
        delayMinutes: 0,
        status: 'scheduled',
        departureGate: null,
        arrivalGate: null,
        dataQuality: 'UNKNOWN',
        statusDetail: null,
        gateDetail: null,
        lastEventId: null,
        eu261Eligible: false,
        snapshotAt: null,
    };

    const newSnapshot = {
        delayMinutes: previousState.delayMinutes as number,
        status: previousState.status as string,
        departureGate: previousState.departureGate as string | null,
        arrivalGate: previousState.arrivalGate as string | null,
        dataQuality: previousState.dataQuality as string,
        statusDetail: previousState.statusDetail as string | null,
        gateDetail: previousState.gateDetail as string | null,
        lastEventId: previousState.lastEventId as string | null,
        eu261Eligible: Boolean(previousState.eu261Eligible),
    };

    const transitionMarker = buildTransitionMarker(previousState);
    const fullFlightNumber = segmentFlightNumber(segment);
    const flightContext = {
        origin: String(segment.origin || ''),
        destination: String(segment.destination || ''),
        airlineCode: String(segment.airlineCode || ''),
        flightNumber: String(segment.flightNumber || ''),
        dataSource: flight.source,
    };

    const measuredDelay = arrivalDelayMinutes(flight);
    const explicitDelayMinutes = measuredDelay ?? previousState.delayMinutes;
    let computedStatus = computeStatus(flight, measuredDelay);
    const currentDataQuality = computedStatus === 'UNKNOWN' ? 'LOW' : 'HIGH';

    // Manual or upstream cancellation flags on the trip itself must still
    // trigger cancellation handling.
    if (trip.status === 'CANCELLED') {
        computedStatus = 'CANCELLED';
    }

    // Single compensation evaluation for this check. Journey = first departure
    // to the FINAL destination of the trip. Skipped entirely when the route is
    // unknown — never guessed.
    const lastSegment = trip.segments.length > 1 ? trip.segments[trip.segments.length - 1] : segment;
    const compensation: CompensationResult | null = routeUnknown
        ? null
        : evaluateCompensation({
            ...compensationInputFromFlight(flight, {
                originIata: segment.origin,
                finalDestinationIata: lastSegment.destination,
                carrierIata: segment.airlineCode,
            }),
            ...(computedStatus === 'CANCELLED' ? { disruption: 'CANCELLATION' as const } : {}),
        });
    const compensationEligible = compensation?.status === 'LIKELY_ELIGIBLE';

    const generatedEvents: GuardianEvent[] = [];
    const notificationPromises: Promise<void>[] = [];

    const queueDispatch = async (
        event: Omit<GuardianEvent, 'tripId' | 'detectedAt' | 'eventId' | 'detailHash'>,
        details: unknown,
    ) => {
        const detailHash = makeDetailHash(details);
        const key = buildEventId(trip.id, event.type, event.subType || 'general', detailHash);
        const lifecycleEventType = event.lifecycleEventType ?? mapGuardianEventType(event.type, event.subType);
        const jsonDetails = JSON.parse(JSON.stringify(details ?? null));
        const title = lifecycleEventType === 'DELAY_DETECTED'
            ? 'Periodic monitoring detected a delay'
            : lifecycleEventType === 'CANCELLATION_DETECTED'
                ? 'Latest check identified a possible cancellation'
                : lifecycleEventType === 'GATE_CHANGE'
                    ? 'Latest check identified a gate change'
                    : lifecycleEventType === 'EQUIPMENT_CHANGE'
                        ? 'Aircraft type changed'
                        : 'Monitoring status currently unavailable';
        const message = lifecycleEventType === 'EQUIPMENT_CHANGE'
            ? `Aircraft changed from ${event.previous ?? 'Unknown'} to ${(event.current as any)?.aircraftType ?? 'Unknown'}.`
            : lifecycleEventType === 'STATUS_UNAVAILABLE'
                ? 'Monitoring is currently working with delayed or unavailable provider status data.'
                : 'A monitoring check detected a change on this booked trip.';

        const lifecycleAlert = await recordMonitoringEvent({
            userId: trip.userId,
            tripId: trip.id,
            sourceType: 'MONITORED_TRIP',
            sourceId: trip.id,
            eventType: lifecycleEventType,
            severity: severityLabel(event.severity),
            title,
            message,
            fingerprintParts: [trip.id, lifecycleEventType, event.subType || 'general', details],
            payload: { eventId: key, previous: event.previous, current: event.current, details: jsonDetails },
        });

        if (lifecycleAlert.suppressed) {
            console.log(`[GUARDIAN] Suppressed duplicate ${lifecycleEventType} for trip ${trip.id} inside cooldown window.`);
            try {
                recordGuardianMetric({
                    tripId: trip.id,
                    eventType: lifecycleEventType,
                    eventSeverity: event.severity,
                    notificationAttempted: false,
                    notificationSuppressed: true,
                    timestamp: new Date(),
                });
            } catch (err) {
                console.debug('[GuardianMetrics] Error recording suppression metric:', err);
            }
            return;
        }

        const eventPayload: GuardianEvent = {
            eventId: key,
            alertEventId: lifecycleAlert.alertId,
            detailHash,
            tripId: trip.id,
            detectedAt: new Date().toISOString(),
            lifecycleEventType,
            ...event,
        };
        generatedEvents.push(eventPayload);
        newSnapshot.lastEventId = key;

        await prisma.guardianAlert.create({
            data: {
                tripId: trip.id,
                type: lifecycleEventType,
                severity: severityLabel(event.severity),
                title,
                message,
                isRead: false,
            },
        });

        if (trip.user) {
            notificationPromises.push(dispatchNotification(eventPayload, event));
        }
    };

    const dispatchNotification = (eventPayload: GuardianEvent, event: { type: GuardianEventType; severity: GuardianEventSeverity }) =>
        notifyGuardianEvent(eventPayload, trip.user!)
            .then(() => {
                recordGuardianMetric({
                    tripId: trip.id,
                    eventType: event.type,
                    eventSeverity: event.severity,
                    notificationAttempted: true,
                    notificationSucceeded: true,
                    timestamp: new Date(),
                });
            })
            .catch((err) => {
                console.error(`[GUARDIAN] Notification dispatch failed for trip ${trip.id}:`, err);
                recordGuardianMetric({
                    tripId: trip.id,
                    eventType: event.type,
                    eventSeverity: event.severity,
                    notificationAttempted: true,
                    notificationSucceeded: false,
                    timestamp: new Date(),
                });
            });

    // Proactive "check your rights" email — decided by the compensation engine,
    // independent of which delay bucket fired (the ≥180 min result usually only
    // becomes known after landing, when no new bucket is crossed).
    const sendProactiveClaimAlertIfDue = async () => {
        const ruleType = proactiveClaimRuleType(computedStatus, compensation);
        if (!ruleType || trip.lastAlertSentAt) return;

        const recipientEmail = trip.user?.email || trip.subscriberEmail;
        console.log(`[GUARDIAN] Proactive claim alert due for trip ${trip.id}: ${ruleType} (${compensation?.regime} ${compensation?.status})`);

        {
            // ClaimRequest lead (idempotent per trip).
            try {
                const existingClaim = await prisma.claimRequest.findFirst({
                    where: { tripId: trip.id },
                    select: { id: true },
                });
                if (!existingClaim) {
                    await prisma.claimRequest.create({
                        data: {
                            tripId: trip.id,
                            userId: trip.userId,
                            fullName: trip.user?.name || '',
                            email: recipientEmail || '',
                            claimRuleType: ruleType,
                            status: 'PENDING',
                        },
                    });
                } else {
                    await prisma.claimRequest.update({ where: { id: existingClaim.id }, data: { claimRuleType: ruleType } });
                }
            } catch (claimErr) {
                console.error(`[GUARDIAN] Failed to upsert ClaimRequest for trip ${trip.id}:`, claimErr);
            }

            if (!recipientEmail) {
                console.warn(`[GUARDIAN] Missing recipient email for proactive claim alert on trip ${trip.id}`);
            } else {
                const disruptionEmailResult = await sendDisruptionAlert(recipientEmail, trip.id, fullFlightNumber, ruleType);
                if (disruptionEmailResult.success) {
                    const sentAt = new Date();
                    await prisma.monitoredTrip.update({
                        where: { id: trip.id },
                        data: { lastAlertSentAt: sentAt, lastEmailError: null, lastEmailErrorAt: null },
                    });
                    trip.lastAlertSentAt = sentAt;
                } else {
                    // lastAlertSentAt stays null so a later check can retry.
                    const emailError = disruptionEmailResult.error || 'Unknown email delivery failure';
                    console.error(`[GUARDIAN] Failed to send proactive claim alert for trip ${trip.id}: ${emailError}`);
                    await prisma.monitoredTrip.update({
                        where: { id: trip.id },
                        data: { lastEmailError: emailError, lastEmailErrorAt: new Date() },
                    });
                }
            }
        }
    };

    const buildStatusDetail = (fields: Record<string, string | number | boolean | undefined | null>) =>
        Object.entries(fields)
            .filter(([, value]) => value !== undefined && value !== null && String(value).length > 0)
            .map(([key, value]) => `${key}=${String(value)}`)
            .join('|');

    let newDepGate = previousState.departureGate;
    let newArrGate = previousState.arrivalGate;
    if (computedStatus !== 'UNKNOWN') {
        newDepGate = flight.departureGate ?? previousState.departureGate;
        newArrGate = flight.arrivalGate ?? previousState.arrivalGate;
    }

    if (computedStatus === 'UNKNOWN') {
        if (previousState.status !== 'UNKNOWN' && previousState.status !== 'scheduled' && previousState.status !== 'CANCELLED') {
            await queueDispatch({
                type: 'DATA_ISSUE',
                subType: 'status_unknown',
                severity: 'medium',
                previous: previousState.status,
                current: { status: 'UNKNOWN', ...flightContext },
            }, {
                issueKind: 'status_unreliable',
                transition: transitionMarker,
                previousStatus: previousState.status,
                currentStatus: 'UNKNOWN',
                previousDataQuality: previousState.dataQuality,
                currentDataQuality,
            });
        }
        newSnapshot.dataQuality = currentDataQuality;
        newSnapshot.status = computedStatus;
        newSnapshot.statusDetail = buildStatusDetail({
            status: computedStatus,
            raw: flight.rawStatus,
            source: flight.source,
            routeUnknown,
        });
    } else if (computedStatus === 'CANCELLED' && previousState.status !== 'CANCELLED') {
        await queueDispatch({
            type: 'CANCELLED',
            subType: 'status_cancelled',
            severity: 'high',
            previous: previousState.status,
            current: { status: 'CANCELLED', compensation, ...flightContext },
        }, {
            cancellationMarker: 'status_cancelled',
            previousStatus: previousState.status,
            currentStatus: 'CANCELLED',
            compensationStatus: compensation?.status ?? 'NOT_ASSESSED',
        });
        newSnapshot.status = 'CANCELLED';
        newSnapshot.delayMinutes = 0;
        newSnapshot.dataQuality = currentDataQuality;
        newSnapshot.statusDetail = buildStatusDetail({
            status: 'CANCELLED',
            compensation: compensation?.status ?? 'not_assessed',
            source: flight.source,
        });
    } else {
        newSnapshot.status = computedStatus;
        newSnapshot.dataQuality = currentDataQuality;
        newSnapshot.statusDetail = buildStatusDetail({
            status: computedStatus,
            delay: explicitDelayMinutes,
            schedArr: flight.scheduledArrivalUtc,
            estArr: bestArrivalEstimateUtc(flight),
            source: flight.source,
        });
    }

    if (computedStatus !== 'CANCELLED' && computedStatus !== 'UNKNOWN') {
        const prevBucket = getDelayBucket(previousState.delayMinutes);
        const currBucket = getDelayBucket(explicitDelayMinutes);

        if (currBucket > prevBucket && currBucket >= 15) {
            await queueDispatch({
                type: 'DELAY',
                subType: `delay_bucket_${currBucket}`,
                severity: BUCKET_SEVERITY[currBucket] ?? 'high',
                previous: `${previousState.delayMinutes}min`,
                current: {
                    delayMinutes: explicitDelayMinutes,
                    bucket: currBucket,
                    compensation,
                    ...flightContext,
                },
            }, {
                transition: transitionMarker,
                statusTransition: `${previousState.status}->${computedStatus}`,
                fromDelay: previousState.delayMinutes,
                toDelay: explicitDelayMinutes,
                fromBucket: prevBucket,
                bucket: currBucket,
                compensationStatus: compensation?.status ?? 'NOT_ASSESSED',
            });
        }

        newSnapshot.delayMinutes = explicitDelayMinutes;
    }

    if (computedStatus !== 'UNKNOWN') {
        const gateChanged =
            (newDepGate && newDepGate !== previousState.departureGate && previousState.departureGate !== null) ||
            (newArrGate && newArrGate !== previousState.arrivalGate && previousState.arrivalGate !== null);

        if (gateChanged) {
            const changedDeparture = newDepGate !== previousState.departureGate;
            const changedArrival = newArrGate !== previousState.arrivalGate;
            const gateSubType = changedDeparture && changedArrival
                ? 'gate_change_both'
                : changedDeparture
                    ? 'gate_change_departure'
                    : 'gate_change_arrival';

            await queueDispatch({
                type: 'GATE_CHANGE',
                subType: gateSubType,
                severity: 'high',
                previous: { departureGate: previousState.departureGate, arrivalGate: previousState.arrivalGate },
                current: { departureGate: newDepGate, arrivalGate: newArrGate, ...flightContext },
            }, {
                transition: transitionMarker,
                previousDepartureGate: previousState.departureGate,
                currentDepartureGate: newDepGate,
                previousArrivalGate: previousState.arrivalGate,
                currentArrivalGate: newArrGate,
            });
        }
        newSnapshot.departureGate = newDepGate;
        newSnapshot.arrivalGate = newArrGate;
        newSnapshot.gateDetail = `dep:${previousState.departureGate || 'N/A'}>${newDepGate || 'N/A'}|arr:${previousState.arrivalGate || 'N/A'}>${newArrGate || 'N/A'}`;
    }

    // Equipment change — from the same AeroDataBox response (no extra call).
    const incomingAircraft = flight.aircraftModel;
    const previousAircraft = segment.aircraftType?.trim() || null;
    if (incomingAircraft) {
        if (!previousAircraft || !isComparableAircraftValue(previousAircraft)) {
            await prisma.flightSegment.update({ where: { id: segment.id }, data: { aircraftType: incomingAircraft } });
        } else if (incomingAircraft !== previousAircraft) {
            await prisma.flightSegment.update({ where: { id: segment.id }, data: { aircraftType: incomingAircraft } });
            await queueDispatch({
                type: 'EQUIPMENT_CHANGE',
                lifecycleEventType: 'EQUIPMENT_CHANGE',
                subType: 'aircraft_type_change',
                severity: 'medium',
                previous: previousAircraft,
                current: { aircraftType: incomingAircraft, ...flightContext },
            }, {
                transition: transitionMarker,
                previousAircraftType: previousAircraft,
                currentAircraftType: incomingAircraft,
            });
        }
    }

    // Sticky: once the engine has said LIKELY_ELIGIBLE, keep the flag.
    newSnapshot.eu261Eligible = newSnapshot.eu261Eligible || compensationEligible;

    await sendProactiveClaimAlertIfDue();

    if (notificationPromises.length > 0) {
        await Promise.allSettled(notificationPromises);
    }

    for (const event of generatedEvents) {
        console.log(`[GUARDIAN] ${event.type} (${event.severity}) trip=${event.tripId} source=${flight.source}`);
    }

    return { snapshot: newSnapshot, computedStatus, count: generatedEvents.length };
}

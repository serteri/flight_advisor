// workers/guardianWorker.ts
//
// Event-driven trip check. Invoked by /api/guardian/check (QStash) for ONE
// planned checkpoint of ONE trip: read the trip, make at most one provider
// call, derive events against the previous snapshot, write the result.
// There is no polling loop — see lib/guardian/checkpoints.ts for the plan.

import { createHash, randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { assessEu261ForDisruption, isEu261Carrier, isEu261Country, type Eu261Assessment } from "@/services/guardian/eu261Rules";
import { notifyGuardianEvent } from "@/services/notifications/guardianNotifier";
import { sendDisruptionAlert } from "@/lib/email/sender";
import { recordGuardianMetric } from "@/services/healthMetrics";
import { MonitoringEventType, recordMonitoringEvent } from "@/lib/alertLifecycle";
import { arrivalDelayMinutes, bestArrivalEstimateUtc, type NormalizedFlight } from "@/lib/flightData/aerodatabox";
import type { CheckKind } from "@/lib/flightData/quotaPolicy";
import { planExtraCheck, resolveTripSchedule } from "@/lib/guardian/checkpoints";
import { cancelPendingChecks, scheduleTripChecks } from "@/lib/guardian/scheduler";
import {
    applyFlightDataToTrip,
    lookupWithinBudget,
    replanTripChecks,
    segmentFlightNumber,
} from "@/lib/guardian/tripLifecycle";
import airports from 'airports';

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
const INACTIVE_TRIP_STATUSES = new Set(['COMPLETED', 'ARCHIVED', 'PENDING_CONFIRMATION']);

const getDelayBucket = (minutes: number): number => {
    if (minutes >= 60) return 60;
    if (minutes >= 30) return 30;
    if (minutes >= 15) return 15;
    return 0;
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

const getAirportData = (iata: string): any | null => {
    const code = normalizeCode(iata);
    if (!code) return null;
    return (airports as any[]).find((item: any) => normalizeCode(item?.iata) === code) || null;
};

const getAirportCountryCode = (iata: string): string | null => {
    const country = normalizeCode(getAirportData(iata)?.country);
    return country || null;
};

const getDistanceKm = (originIata: string, destinationIata: string): number | null => {
    const from = getAirportData(originIata);
    const to = getAirportData(destinationIata);
    const [lat1, lon1, lat2, lon2] = [from?.lat, from?.lon, to?.lat, to?.lon].map(Number);
    if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;

    const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2));
    return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

// ─── LEAD GENERATION — ClaimRuleType ──────────────────────────────────────
// Öncelik sırası: Avustralya iç hat > İptal > 3 Saat+ Rötar

type ClaimRuleType = 'COMPENSATION_CANCELLED' | 'COMPENSATION_DELAYED' | 'REFUND_AND_EXPENSES';

const determineClaimRuleType = (
    flightStatus: ComputedStatus,
    delayMinutes: number,
    origin: string,
    destination: string,
): ClaimRuleType => {
    if (getAirportCountryCode(origin) === 'AU' && getAirportCountryCode(destination) === 'AU') {
        return 'REFUND_AND_EXPENSES';
    }
    if (flightStatus === 'CANCELLED') {
        return 'COMPENSATION_CANCELLED';
    }
    return 'COMPENSATION_DELAYED';
};

const ROUTE_UNKNOWN_ASSESSMENT: Eu261Assessment = {
    eligible: 'unknown',
    reason: 'Route could not be resolved from flight data, so EU261 was not assessed.',
    compensationRange: null,
    confidence: 'low',
};

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
    if (!result) {
        await markCheck('SKIPPED', 'per-trip provider call cap reached');
        return { status: 'SKIPPED', reason: 'trip-call-cap' };
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

    const assessEu261 = (input: { eventType: 'DELAY' | 'CANCELLED'; delayMinutes?: number }): Eu261Assessment => {
        if (routeUnknown) return ROUTE_UNKNOWN_ASSESSMENT;
        const originCountry = flight.origin.countryCode || getAirportCountryCode(segment.origin);
        return assessEu261ForDisruption({
            ...input,
            departureAirport: segment.origin,
            arrivalAirport: segment.destination,
            carrier: segment.airlineCode,
            departsFromScope: originCountry ? isEu261Country(originCountry) : undefined,
            carrierInScope: segment.airlineCode ? isEu261Carrier(segment.airlineCode) : undefined,
            distanceKm: flight.greatCircleDistanceKm ?? getDistanceKm(segment.origin, segment.destination),
        });
    };

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

        const shouldSendProactiveClaimAlert =
            !routeUnknown && (event.type === 'CANCELLED' || (event.type === 'DELAY' && event.severity === 'high'));

        if (shouldSendProactiveClaimAlert && !trip.lastAlertSentAt) {
            const recipientEmail = trip.user?.email || trip.subscriberEmail;
            const ruleType = determineClaimRuleType(computedStatus, explicitDelayMinutes, segment.origin, segment.destination);
            console.log(`[GUARDIAN] ClaimRuleType for trip ${trip.id}: ${ruleType}`);

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

        if (trip.user) {
            notificationPromises.push(
                notifyGuardianEvent(eventPayload, trip.user)
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
                    }),
            );
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
        const eu261Assessment = assessEu261({ eventType: 'CANCELLED' });
        const eligibleEU261 = eu261Assessment.eligible === true;
        await queueDispatch({
            type: 'CANCELLED',
            subType: 'status_cancelled',
            severity: 'high',
            previous: previousState.status,
            current: { status: 'CANCELLED', eligibleEU261, eu261Assessment, ...flightContext },
        }, {
            cancellationMarker: 'status_cancelled',
            previousStatus: previousState.status,
            currentStatus: 'CANCELLED',
            eligibleEU261,
            eu261Assessment,
        });
        newSnapshot.status = 'CANCELLED';
        newSnapshot.delayMinutes = 0;
        newSnapshot.dataQuality = currentDataQuality;
        newSnapshot.statusDetail = buildStatusDetail({ status: 'CANCELLED', eligibleEU261, source: flight.source });
        newSnapshot.eu261Eligible = eligibleEU261;
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
            const severityMap: Record<number, GuardianEventSeverity> = { 15: 'low', 30: 'medium', 60: 'high' };
            const eu261Assessment = assessEu261({ eventType: 'DELAY', delayMinutes: explicitDelayMinutes });
            const eligibleEU261 = eu261Assessment.eligible === true;

            await queueDispatch({
                type: 'DELAY',
                subType: `delay_bucket_${currBucket}`,
                severity: severityMap[currBucket] || 'high',
                previous: `${previousState.delayMinutes}min`,
                current: {
                    delayMinutes: explicitDelayMinutes,
                    bucket: currBucket,
                    eligibleEU261,
                    eu261Assessment,
                    ...flightContext,
                },
            }, {
                transition: transitionMarker,
                statusTransition: `${previousState.status}->${computedStatus}`,
                fromDelay: previousState.delayMinutes,
                toDelay: explicitDelayMinutes,
                fromBucket: prevBucket,
                bucket: currBucket,
                eligibleEU261,
                eu261Assessment,
            });

            if (eligibleEU261) {
                newSnapshot.eu261Eligible = true;
            }
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

    if (notificationPromises.length > 0) {
        await Promise.allSettled(notificationPromises);
    }

    for (const event of generatedEvents) {
        console.log(`[GUARDIAN] ${event.type} (${event.severity}) trip=${event.tripId} source=${flight.source}`);
    }

    return { snapshot: newSnapshot, computedStatus, count: generatedEvents.length };
}

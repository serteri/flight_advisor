// workers/guardianWorker.ts
import { createHash, randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { getFlightStatus } from "@/services/flightStatusService";
import { getAircraftEquipment } from "@/lib/api/aviationstack";
import { assessEu261ForDisruption, isEu261Carrier, isEu261Country } from "@/services/guardian/eu261Rules";
import { notifyGuardianEvent } from "@/services/notifications/guardianNotifier";
import { sendDisruptionAlert } from "@/lib/email/sender";
import { recordGuardianMetric } from "@/services/healthMetrics";
import type { GuardianMetricEvent } from "@/types/operatorHealth";
import { MonitoringEventType, recordMonitoringEvent } from "@/lib/alertLifecycle";
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

const normalizeFlightStatus = (rawStatus: string, delayMins: number, missingData: boolean): 'ON_TIME' | 'DELAYED' | 'CANCELLED' | 'UNKNOWN' => {
    if (missingData || rawStatus === 'unknown') return 'UNKNOWN';
    if (rawStatus === 'cancelled') return 'CANCELLED';
    if (delayMins >= 15) return 'DELAYED';
    return 'ON_TIME';
};

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

    const airport = (airports as any[]).find((item: any) => normalizeCode(item?.iata) === code);
    return airport || null;
};

const getAirportCountryCode = (iata: string): string | null => {
    const airport = getAirportData(iata);
    const country = normalizeCode(airport?.country);
    return country || null;
};

// ─── LEAD GENERATION — ClaimRuleType Belirleme ─────────────────────────────
// API yanıtına göre hangi hukuki senaryoya düştüğünü tespit eder.
// Öncelik sırası: Avustralya iç hat > İptal > 3 Saat+ Rötar

const AUSTRALIA_COUNTRY_CODE = 'AU';

const isAustralianAirport = (iata: string): boolean => {
    const countryCode = getAirportCountryCode(iata);
    return countryCode === AUSTRALIA_COUNTRY_CODE;
};

type ClaimRuleType = 'COMPENSATION_CANCELLED' | 'COMPENSATION_DELAYED' | 'REFUND_AND_EXPENSES';

const determineClaimRuleType = (
    flightStatus: 'ON_TIME' | 'DELAYED' | 'CANCELLED' | 'UNKNOWN',
    delayMinutes: number,
    origin: string,
    destination: string,
): ClaimRuleType => {
    // 1. ÖNCE: Avustralya iç hat kontrolü (her iki taraf da AU ise EU261 işlemez)
    if (isAustralianAirport(origin) && isAustralianAirport(destination)) {
        return 'REFUND_AND_EXPENSES';
    }
    // 2. İptal tespiti
    if (flightStatus === 'CANCELLED') {
        return 'COMPENSATION_CANCELLED';
    }
    // 3. 3 Saat (180 dakika) ve üzeri varış rötarı
    if (delayMinutes >= 180) {
        return 'COMPENSATION_DELAYED';
    }
    // Varsayılan (daha az rötar — henüz kural eşiği yok)
    return 'COMPENSATION_DELAYED';
};


const getAirportCoordinates = (iata: string): { lat: number; lon: number } | null => {
    const airport = getAirportData(iata);
    const lat = Number(airport?.lat);
    const lon = Number(airport?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const getDistanceKm = (originIata: string, destinationIata: string): number | null => {
    const from = getAirportCoordinates(originIata);
    const to = getAirportCoordinates(destinationIata);
    if (!from || !to) return null;

    const earthRadiusKm = 6371;
    const dLat = toRadians(to.lat - from.lat);
    const dLon = toRadians(to.lon - from.lon);
    const fromLat = toRadians(from.lat);
    const toLat = toRadians(to.lat);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(fromLat) * Math.cos(toLat);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(earthRadiusKm * c);
};

const TRIP_LEASE_MS = 10 * 60 * 1000;

async function claimTripsForMonitoring(now: Date) {
    const leaseExpiresAt = new Date(now.getTime() + TRIP_LEASE_MS);
    const candidateTrips = await prisma.monitoredTrip.findMany({
        where: {
            status: { in: ['ACTIVE', 'CANCELLED'] },
            nextCheckAt: { lte: now },
            OR: [
                { processingLeaseExpiresAt: null },
                { processingLeaseExpiresAt: { lte: now } }
            ]
        },
        select: { id: true },
        orderBy: { nextCheckAt: 'asc' }
    });

    const claimedTripIds: string[] = [];

    for (const candidate of candidateTrips) {
        const leaseId = randomUUID();
        const claim = await prisma.monitoredTrip.updateMany({
            where: {
                id: candidate.id,
                status: { in: ['ACTIVE', 'CANCELLED'] },
                nextCheckAt: { lte: now },
                OR: [
                    { processingLeaseExpiresAt: null },
                    { processingLeaseExpiresAt: { lte: now } }
                ]
            },
            data: {
                processingLeaseId: leaseId,
                processingLeaseExpiresAt: leaseExpiresAt
            }
        });

        if (claim.count === 0) {
            continue;
        }

        const leasedTrip = await prisma.monitoredTrip.findFirst({
            where: { id: candidate.id, processingLeaseId: leaseId },
            include: { segments: true, snapshot: true, user: true }
        });

        if (leasedTrip) {
            claimedTripIds.push(leasedTrip.id);
        }
    }

    if (claimedTripIds.length === 0) {
        return [];
    }

    return prisma.monitoredTrip.findMany({
        where: { id: { in: claimedTripIds } },
        include: { segments: true, snapshot: true, user: true }
    });
}

async function finalizeTripCycle(tripId: string, leaseId: string, checkedAt: Date, nextCheckAt: Date, snapshot: {
    delayMinutes: number;
    status: string;
    dataQuality: string;
    departureGate: string | null;
    arrivalGate: string | null;
    statusDetail: string | null;
    gateDetail: string | null;
    lastEventId: string | null;
    eu261Eligible: boolean;
}) {
    return prisma.$transaction(async (tx) => {
        const releasedLease = await tx.monitoredTrip.updateMany({
            where: { id: tripId, processingLeaseId: leaseId },
            data: {
                lastCheckedAt: checkedAt,
                nextCheckAt,
                processingLeaseId: null,
                processingLeaseExpiresAt: null
            }
        });

        if (releasedLease.count === 0) {
            return false;
        }

        await tx.tripSnapshot.upsert({
            where: { tripId },
            create: {
                tripId,
                delayMinutes: snapshot.delayMinutes,
                status: snapshot.status,
                dataQuality: snapshot.dataQuality,
                departureGate: snapshot.departureGate,
                arrivalGate: snapshot.arrivalGate,
                statusDetail: snapshot.statusDetail,
                gateDetail: snapshot.gateDetail,
                lastEventId: snapshot.lastEventId,
                eu261Eligible: snapshot.eu261Eligible
            },
            update: {
                delayMinutes: snapshot.delayMinutes,
                status: snapshot.status,
                dataQuality: snapshot.dataQuality,
                departureGate: snapshot.departureGate,
                arrivalGate: snapshot.arrivalGate,
                statusDetail: snapshot.statusDetail,
                gateDetail: snapshot.gateDetail,
                lastEventId: snapshot.lastEventId,
                eu261Eligible: snapshot.eu261Eligible
            }
        });

        return true;
    });
}

export async function processFlightMonitoring() {
    console.log("🛡️ [GUARDIAN WORKER] Starting monitoring cycle...");

    try {
        const now = new Date();
        const activeTrips = await claimTripsForMonitoring(now);

        console.log(`🔎 Found ${activeTrips.length} active trips to check.`);

        const generatedEvents: GuardianEvent[] = [];
        const notificationPromises: Promise<void>[] = [];

        for (const trip of activeTrips) {
            try {
                // Record Guardian check metric
                try {
                    recordGuardianMetric({
                        tripId: trip.id,
                        notificationAttempted: false,
                        timestamp: new Date(),
                    });
                } catch (err) {
                    console.debug('[GuardianMetrics] Error recording check metric:', err);
                }

                const segment = trip.segments[0];
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
                    delayMinutes: previousState.delayMinutes,
                    status: previousState.status,
                    departureGate: previousState.departureGate,
                    arrivalGate: previousState.arrivalGate,
                    dataQuality: previousState.dataQuality,
                    statusDetail: previousState.statusDetail,
                    gateDetail: previousState.gateDetail,
                    lastEventId: previousState.lastEventId,
                    eu261Eligible: Boolean(previousState.eu261Eligible)
                };

                const transitionMarker = buildTransitionMarker(previousState);
                const flightContext = {
                    origin: String(segment?.origin || ''),
                    destination: String(segment?.destination || ''),
                    airlineCode: String(segment?.airlineCode || ''),
                    flightNumber: String(segment?.flightNumber || ''),
                };

                if (!segment) {
                    const nextCheck = new Date(now.getTime() + trip.checkFrequency * 60000);
                    await finalizeTripCycle(trip.id, trip.processingLeaseId!, now, nextCheck, newSnapshot);
                    continue;
                }

                const flightDate = new Date(segment.departureDate);
                if (Number.isNaN(flightDate.getTime())) {
                    console.warn(`   ⚠️ Invalid segment departureDate for trip ${trip.id}; skipping status fetch.`);
                    const nextCheck = new Date(now.getTime() + trip.checkFrequency * 60000);
                    await finalizeTripCycle(trip.id, trip.processingLeaseId!, now, nextCheck, newSnapshot);
                    continue;
                }
                const dateStr = flightDate.toISOString().split('T')[0];
                console.log('Checking flight for date:', dateStr);
                // Build full IATA flight number (e.g. "QF" + "51" -> "QF51")
                const fullFlightNumber = `${String(segment.airlineCode || '').toUpperCase()}${String(segment.flightNumber || '').toUpperCase()}`;
                let currentStatus = null;
                
                try {
                    const result = await getFlightStatus(fullFlightNumber, dateStr);
                    if ('error' in result) {
                        console.warn(`   ⚠️ Could not fetch status: ${result.message}`);
                    } else {
                        currentStatus = result;
                    }
                } catch (err: any) {
                    console.warn(`   ⚠️ Exception during status fetch: ${err.message}`);
                }

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
                                    : lifecycleEventType === 'MONITORING_STALE'
                                        ? 'Monitoring currently delayed'
                                        : lifecycleEventType === 'MONITORING_RECOVERED'
                                            ? 'Monitoring recovered'
                                            : 'Monitoring status currently unavailable';
                    const message = lifecycleEventType === 'MONITORING_STALE'
                        ? 'The latest scheduled monitoring check was delayed. Notification delivery will resume when checks recover.'
                        : lifecycleEventType === 'MONITORING_RECOVERED'
                            ? 'Monitoring recovered after a delayed check window.'
                            : lifecycleEventType === 'EQUIPMENT_CHANGE'
                                ? `Aircraft changed from ${event.previous ?? 'Unknown'} to ${(event.current as any)?.aircraftType ?? 'Unknown'}.`
                                : lifecycleEventType === 'STATUS_UNAVAILABLE'
                        ? 'Monitoring is currently working with delayed or unavailable provider status data.'
                        : 'A periodic monitoring check detected a change on this booked trip.';
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
                        payload: {
                            eventId: key,
                            previous: event.previous,
                            current: event.current,
                            details: jsonDetails,
                        },
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

                    const eventPayload = {
                        eventId: key,
                        alertEventId: lifecycleAlert.alertId,
                        detailHash,
                        tripId: trip.id,
                        detectedAt: new Date().toISOString(),
                        lifecycleEventType,
                        ...event
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
                        event.type === 'CANCELLED' || (event.type === 'DELAY' && event.severity === 'high');

                    if (shouldSendProactiveClaimAlert && !trip.lastAlertSentAt) {
                        const recipientEmail = trip.user?.email || trip.subscriberEmail;

                        // ── ClaimRuleType belirleme (Lead Generation iş mantığı) ──────────────
                        const ruleType = determineClaimRuleType(
                            computedStatus,
                            explicitDelayMinutes,
                            String(segment.origin || ''),
                            String(segment.destination || ''),
                        );
                        console.log(`[GUARDIAN] ClaimRuleType for trip ${trip.id}: ${ruleType}`);

                        // ── ClaimRequest kaydını upsert et (idempotent) ───────────────────────
                        // Aynı trip için birden fazla tetikleyici gelirse, var olan kaydı güncelle
                        try {
                            const existingClaim = await prisma.claimRequest.findFirst({
                                where: { tripId: trip.id },
                                select: { id: true },
                            });
                            if (!existingClaim) {
                                await prisma.claimRequest.create({
                                    data: {
                                        tripId:        trip.id,
                                        userId:        trip.userId,
                                        fullName:      trip.user?.name || '',
                                        email:         recipientEmail || '',
                                        claimRuleType: ruleType,
                                        status:        'PENDING',
                                    },
                                });
                                console.log(`[GUARDIAN] ClaimRequest created for trip ${trip.id} (${ruleType})`);
                            } else {
                                await prisma.claimRequest.update({
                                    where: { id: existingClaim.id },
                                    data:  { claimRuleType: ruleType },
                                });
                                console.log(`[GUARDIAN] ClaimRequest updated for trip ${trip.id} (${ruleType})`);
                            }
                        } catch (claimErr) {
                            console.error(`[GUARDIAN] Failed to upsert ClaimRequest for trip ${trip.id}:`, claimErr);
                        }
                        // ────────────────────────────────────────────────────────────────────────

                        if (!recipientEmail) {
                            console.warn(`[GUARDIAN] Missing recipient email for proactive claim alert on trip ${trip.id}`);
                        } else {
                            const alertFlightNumber = fullFlightNumber || `${String(segment.airlineCode || '').toUpperCase()}${String(segment.flightNumber || '').toUpperCase()}`;
                            const disruptionEmailResult = await sendDisruptionAlert(
                                recipientEmail,
                                trip.id,
                                alertFlightNumber,
                                ruleType,
                            );

                            if (disruptionEmailResult.success) {
                                const sentAt = new Date();
                                await prisma.monitoredTrip.update({
                                    where: { id: trip.id },
                                    data: { lastAlertSentAt: sentAt },
                                });
                                trip.lastAlertSentAt = sentAt;
                                console.log(
                                    `[GUARDIAN] Proactive claim alert sent for trip ${trip.id} to ${recipientEmail}. Link: ${disruptionEmailResult.previewUrl || 'n/a'}`,
                                );
                            } else {
                                console.warn(
                                    `[GUARDIAN] Failed to send proactive claim alert for trip ${trip.id}: ${disruptionEmailResult.error}`,
                                );
                            }
                        }
                    }

                    
                    if (trip.user) {
                        notificationPromises.push(
                            notifyGuardianEvent(eventPayload, trip.user)
                                .then(() => {
                                    // Record successful notification metric
                                    try {
                                        recordGuardianMetric({
                                            tripId: trip.id,
                                            eventType: event.type,
                                            eventSeverity: event.severity,
                                            notificationAttempted: true,
                                            notificationSucceeded: true,
                                            timestamp: new Date(),
                                        });
                                    } catch (err) {
                                        console.debug('[GuardianMetrics] Error recording notification success:', err);
                                    }
                                })
                                .catch((err) => {
                                    // Record failed notification metric
                                    try {
                                        recordGuardianMetric({
                                            tripId: trip.id,
                                            eventType: event.type,
                                            eventSeverity: event.severity,
                                            notificationAttempted: true,
                                            notificationSucceeded: false,
                                            timestamp: new Date(),
                                        });
                                    } catch (metricsErr) {
                                        console.debug('[GuardianMetrics] Error recording notification failure:', metricsErr);
                                    }
                                    throw err;
                                })
                        );
                    }
                };

                const staleThresholdMs = Math.max(trip.checkFrequency * 3, 180) * 60 * 1000;
                const lastCheckedAt = trip.lastCheckedAt ? new Date(trip.lastCheckedAt) : null;
                const wasMonitoringStale = !lastCheckedAt || now.getTime() - lastCheckedAt.getTime() > staleThresholdMs;

                if (wasMonitoringStale) {
                    await queueDispatch({
                        type: 'DATA_ISSUE',
                        lifecycleEventType: 'MONITORING_STALE',
                        subType: 'monitoring_stale',
                        severity: 'medium',
                        previous: lastCheckedAt ? lastCheckedAt.toISOString() : 'never_checked',
                        current: {
                            status: 'CHECK_DELAYED',
                            lastCheckedAt: lastCheckedAt?.toISOString() ?? null,
                            ...flightContext,
                        },
                    }, {
                        staleKind: 'monitoring_check_delayed',
                        lastCheckedAt: lastCheckedAt?.toISOString() ?? null,
                        thresholdMinutes: Math.round(staleThresholdMs / 60000),
                    });

                    try {
                        recordGuardianMetric({
                            tripId: trip.id,
                            eventType: 'MONITORING_STALE',
                            eventSeverity: 'medium',
                            notificationAttempted: false,
                            staleMonitoringDetected: true,
                            timestamp: new Date(),
                        });
                    } catch (err) {
                        console.debug('[GuardianMetrics] Error recording stale metric:', err);
                    }
                }

                let explicitDelayMinutes = previousState.delayMinutes;
                let computedStatus: 'ON_TIME' | 'DELAYED' | 'CANCELLED' | 'UNKNOWN' = 'UNKNOWN';
                let currentDataQuality = 'UNKNOWN';
                let newDepGate = previousState.departureGate;
                let newArrGate = previousState.arrivalGate;

                const buildStatusDetail = (fields: Record<string, string | number | boolean | undefined | null>) => {
                    return Object.entries(fields)
                        .filter(([, value]) => value !== undefined && value !== null && String(value).length > 0)
                        .map(([key, value]) => `${key}=${String(value)}`)
                        .join('|');
                };

                if (currentStatus) {
                    const safeParseMs = (isoStr: string | undefined): number => {
                        if (!isoStr) return 0;
                        const ms = new Date(isoStr).getTime();
                        return isNaN(ms) ? 0 : ms;
                    };

                    const reqScheduled = safeParseMs(currentStatus.scheduledArrival) || safeParseMs(currentStatus.scheduledDeparture);
                    const reqActual = safeParseMs(currentStatus.actualArrival || currentStatus.estimatedArrival) || safeParseMs(currentStatus.actualDeparture);

                    if (currentStatus.status === 'cancelled') {
                        computedStatus = 'CANCELLED';
                        currentDataQuality = 'HIGH';
                    } else if (reqScheduled === 0 || (reqActual === 0 && currentStatus.status !== 'scheduled')) {
                        computedStatus = 'UNKNOWN';
                        currentDataQuality = 'LOW';
                    } else {
                        currentDataQuality = 'HIGH';
                        explicitDelayMinutes = 0;
                        if (reqActual > reqScheduled) {
                            explicitDelayMinutes = Math.round((reqActual - reqScheduled) / 60000);
                        }
                        computedStatus = normalizeFlightStatus(currentStatus.status, explicitDelayMinutes, false);
                    }

                    if (computedStatus !== 'UNKNOWN') {
                        newDepGate = currentStatus.departureGate ?? previousState.departureGate;
                        newArrGate = currentStatus.arrivalGate ?? previousState.arrivalGate;
                    }
                } else {
                    computedStatus = 'UNKNOWN';
                    currentDataQuality = 'UNKNOWN';
                }

                // Manual or upstream cancellation flags on the trip itself must
                // still trigger cancellation handling even if provider data is
                // temporarily unavailable.
                if (trip.status === 'CANCELLED') {
                    computedStatus = 'CANCELLED';
                }

                if (computedStatus === 'UNKNOWN') {
                    if (previousState.status !== 'UNKNOWN' && previousState.status !== 'scheduled' && previousState.status !== 'CANCELLED') {
                        await queueDispatch({
                            type: 'DATA_ISSUE',
                            subType: 'status_unknown',
                            severity: 'medium',
                            previous: previousState.status,
                            current: {
                                status: 'UNKNOWN',
                                ...flightContext,
                            }
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
                        raw: 'unreliable',
                        schedDep: currentStatus?.scheduledDeparture,
                        schedArr: currentStatus?.scheduledArrival,
                    });
                } else if (computedStatus === 'CANCELLED' && previousState.status !== 'CANCELLED') {
                    const departureCountryCode = getAirportCountryCode(String(segment.origin || ''));
                    const departsFromScope = departureCountryCode ? isEu261Country(departureCountryCode) : undefined;
                    const carrierInScope = segment.airlineCode ? isEu261Carrier(String(segment.airlineCode)) : undefined;
                    const distanceKm = getDistanceKm(String(segment.origin || ''), String(segment.destination || ''));
                    const eu261Assessment = assessEu261ForDisruption({
                        eventType: 'CANCELLED',
                        departureAirport: String(segment.origin || ''),
                        arrivalAirport: String(segment.destination || ''),
                        carrier: String(segment.airlineCode || ''),
                        departsFromScope,
                        carrierInScope,
                        distanceKm,
                    });
                    const eligibleEU261 = eu261Assessment.eligible === true;
                    await queueDispatch({
                        type: 'CANCELLED',
                        subType: 'status_cancelled',
                        severity: 'high',
                        previous: previousState.status,
                        current: {
                            status: 'CANCELLED',
                            eligibleEU261,
                            eu261Assessment,
                            ...flightContext,
                        }
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
                    newSnapshot.statusDetail = buildStatusDetail({
                        status: 'CANCELLED',
                        eligibleEU261,
                        schedDep: currentStatus?.scheduledDeparture,
                        schedArr: currentStatus?.scheduledArrival,
                    });
                    newSnapshot.eu261Eligible = eligibleEU261;
                } else {
                    newSnapshot.status = computedStatus;
                    newSnapshot.dataQuality = currentDataQuality;
                    newSnapshot.statusDetail = buildStatusDetail({
                        status: computedStatus,
                        delay: explicitDelayMinutes,
                        schedDep: currentStatus?.scheduledDeparture,
                        schedArr: currentStatus?.scheduledArrival,
                    });
                }

                if (computedStatus !== 'CANCELLED' && computedStatus !== 'UNKNOWN') {
                    const prevBucket = getDelayBucket(previousState.delayMinutes);
                    const currBucket = getDelayBucket(explicitDelayMinutes);

                    if (currBucket > prevBucket && currBucket >= 15) {
                        const severityMap: Record<number, GuardianEventSeverity> = { 15: 'low', 30: 'medium', 60: 'high' };
                        const departureCountryCode = getAirportCountryCode(String(segment.origin || ''));
                        const departsFromScope = departureCountryCode ? isEu261Country(departureCountryCode) : undefined;
                        const carrierInScope = segment.airlineCode ? isEu261Carrier(String(segment.airlineCode)) : undefined;
                        const distanceKm = getDistanceKm(String(segment.origin || ''), String(segment.destination || ''));
                        const eu261Assessment = assessEu261ForDisruption({
                            eventType: 'DELAY',
                            delayMinutes: explicitDelayMinutes,
                            departureAirport: String(segment.origin || ''),
                            arrivalAirport: String(segment.destination || ''),
                            carrier: String(segment.airlineCode || ''),
                            departsFromScope,
                            carrierInScope,
                            distanceKm,
                        });
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
                            }
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
                            previous: {
                                departureGate: previousState.departureGate,
                                arrivalGate: previousState.arrivalGate
                            },
                            current: {
                                departureGate: newDepGate,
                                arrivalGate: newArrGate,
                                ...flightContext,
                            }
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

                const aircraftEquipment = await getAircraftEquipment(fullFlightNumber, dateStr);
                const incomingAircraftType = 'error' in aircraftEquipment
                    ? null
                    : aircraftEquipment.aircraftType?.trim() || null;
                const previousAircraftType = segment.aircraftType?.trim() || null;

                if (incomingAircraftType && !previousAircraftType) {
                    // First-ever check for this segment: record the baseline, no alert.
                    await prisma.flightSegment.update({
                        where: { id: segment.id },
                        data: { aircraftType: incomingAircraftType },
                    });
                } else if (incomingAircraftType && previousAircraftType && incomingAircraftType !== previousAircraftType) {
                    await prisma.flightSegment.update({
                        where: { id: segment.id },
                        data: { aircraftType: incomingAircraftType },
                    });

                    await queueDispatch({
                        type: 'EQUIPMENT_CHANGE',
                        lifecycleEventType: 'EQUIPMENT_CHANGE',
                        subType: 'aircraft_type_change',
                        severity: 'medium',
                        previous: previousAircraftType,
                        current: {
                            aircraftType: incomingAircraftType,
                            ...flightContext,
                        },
                    }, {
                        transition: transitionMarker,
                        previousAircraftType,
                        currentAircraftType: incomingAircraftType,
                    });
                }

                if (wasMonitoringStale && currentStatus) {
                    await queueDispatch({
                        type: 'DATA_ISSUE',
                        lifecycleEventType: 'MONITORING_RECOVERED',
                        subType: 'monitoring_recovered',
                        severity: 'low',
                        previous: 'CHECK_DELAYED',
                        current: {
                            status: computedStatus,
                            dataQuality: currentDataQuality,
                            ...flightContext,
                        },
                    }, {
                        recoveredKind: 'monitoring_check_completed',
                        status: computedStatus,
                        dataQuality: currentDataQuality,
                    });

                    try {
                        recordGuardianMetric({
                            tripId: trip.id,
                            eventType: 'MONITORING_RECOVERED',
                            eventSeverity: 'low',
                            notificationAttempted: false,
                            monitoringRecovered: true,
                            timestamp: new Date(),
                        });
                    } catch (err) {
                        console.debug('[GuardianMetrics] Error recording recovery metric:', err);
                    }
                }

                const nextCheck = new Date(now.getTime() + trip.checkFrequency * 60000);
                const finalized = await finalizeTripCycle(trip.id, trip.processingLeaseId!, now, nextCheck, newSnapshot);
                if (!finalized) {
                    console.warn(`[GUARDIAN] Lease lost before finalizing trip ${trip.id}. Skipping state write.`);
                }
            } catch (error) {
                console.error(`[GUARDIAN] Failed processing trip ${trip.id}:`, error);
                const fallbackNow = new Date();
                const fallbackNextCheck = new Date(fallbackNow.getTime() + trip.checkFrequency * 60 * 1000);
                await prisma.monitoredTrip.updateMany({
                    where: { id: trip.id, processingLeaseId: trip.processingLeaseId },
                    data: {
                        lastCheckedAt: fallbackNow,
                        nextCheckAt: fallbackNextCheck,
                        processingLeaseId: null,
                        processingLeaseExpiresAt: null,
                    },
                });
            }
        }

        // 6. Log Generated Events
        if (generatedEvents.length > 0) {
            console.log(`\n🎉 [GUARDIAN] ${generatedEvents.length} distinct events detected:\n`);
            generatedEvents.forEach(event => {
                const messageMap = {
                    'DELAY': `Delay detected: Escalated severity mapped`,
                    'CANCELLED': `Flight cancelled!`,
                    'GATE_CHANGE': `Gate change detected.`,
                    'EQUIPMENT_CHANGE': `Aircraft type change detected.`,
                    'DATA_ISSUE': `Unreliable data stream detected.`
                };
                
                console.log(`[GUARDIAN] ${messageMap[event.type] || event.type} (tripId=${event.tripId})`);
                console.log(`   └ Severity: ${event.severity} | DetectedAt: ${event.detectedAt}`);
                console.log(`   └ Prev: ${JSON.stringify(event.previous)} -> Curr: ${JSON.stringify(event.current)}`);
            });
            console.log("\n");
        } else {
            console.log("✈️ [GUARDIAN] No critical changes detected on active trips.");
        }

        // Resolving parallel delivery queues ensuring complete isolation from loop crashes
        if (notificationPromises.length > 0) {
            console.log(`📬 [GUARDIAN] Releasing ${notificationPromises.length} integrated notification dispatches...`);
            await Promise.allSettled(notificationPromises);
        }

        console.log("✅ [GUARDIAN WORKER] Cycle complete.");
        return { success: true, processed: activeTrips.length, events: generatedEvents };

    } catch (error) {
        console.error("❌ [GUARDIAN WORKER] Error:", error);
        return { success: false, error };
    } finally {
        await prisma.$disconnect();
    }
}

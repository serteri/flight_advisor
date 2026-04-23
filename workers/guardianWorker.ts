// workers/guardianWorker.ts
import { createHash, randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { getFlightStatus } from "@/services/flightStatusService";
import { assessEu261ForDisruption, isEu261Carrier, isEu261Country } from "@/services/guardian/eu261Rules";
import { notifyGuardianEvent } from "@/services/notifications/guardianNotifier";
import { recordGuardianMetric } from "@/services/healthMetrics";
import type { GuardianMetricEvent } from "@/types/operatorHealth";
import airports from 'airports';

export type GuardianEventType = 'DELAY' | 'GATE_CHANGE' | 'CANCELLED' | 'DATA_ISSUE';
export type GuardianEventSeverity = 'low' | 'medium' | 'high';

export interface GuardianEvent {
    eventId?: string;
    tripId: string;
    type: GuardianEventType;
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
            status: 'ACTIVE',
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
                status: 'ACTIVE',
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

                const dateStr = new Date(segment.departureDate).toISOString().split('T')[0];
                let currentStatus = null;
                
                try {
                    const result = await getFlightStatus(segment.flightNumber, dateStr);
                    if ('error' in result) {
                        console.warn(`   ⚠️ Could not fetch status: ${result.message}`);
                    } else {
                        currentStatus = result;
                    }
                } catch (err: any) {
                    console.warn(`   ⚠️ Exception during status fetch: ${err.message}`);
                }

                const queueDispatch = (
                    event: Omit<GuardianEvent, 'tripId' | 'detectedAt' | 'eventId' | 'detailHash'>,
                    details: unknown,
                ) => {
                    const detailHash = makeDetailHash(details);
                    const key = buildEventId(trip.id, event.type, event.subType || 'general', detailHash);
                    const eventPayload = {
                        eventId: key,
                        detailHash,
                        tripId: trip.id,
                        detectedAt: new Date().toISOString(),
                        ...event
                    };
                    generatedEvents.push(eventPayload);
                    newSnapshot.lastEventId = key;
                    
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

                let explicitDelayMinutes = previousState.delayMinutes;
                let computedStatus: 'ON_TIME' | 'DELAYED' | 'CANCELLED' | 'UNKNOWN' = 'UNKNOWN';
                let currentDataQuality = 'UNKNOWN';
                let newDepGate = previousState.departureGate;
                let newArrGate = previousState.arrivalGate;

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

                if (computedStatus === 'UNKNOWN') {
                    if (previousState.status !== 'UNKNOWN' && previousState.status !== 'scheduled' && previousState.status !== 'CANCELLED') {
                        queueDispatch({
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
                    newSnapshot.statusDetail = `status=${computedStatus}|raw=unreliable`;
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
                    queueDispatch({
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
                    newSnapshot.statusDetail = `status=CANCELLED|eligibleEU261=${eligibleEU261}`;
                    newSnapshot.eu261Eligible = eligibleEU261;
                } else {
                    newSnapshot.status = computedStatus;
                    newSnapshot.dataQuality = currentDataQuality;
                    newSnapshot.statusDetail = `status=${computedStatus}|delay=${explicitDelayMinutes}`;
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
                        
                        queueDispatch({
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

                        queueDispatch({
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

                const nextCheck = new Date(now.getTime() + trip.checkFrequency * 60000);
                const finalized = await finalizeTripCycle(trip.id, trip.processingLeaseId!, now, nextCheck, newSnapshot);
                if (!finalized) {
                    console.warn(`[GUARDIAN] Lease lost before finalizing trip ${trip.id}. Skipping state write.`);
                }
            } catch (error) {
                console.error(`[GUARDIAN] Failed processing trip ${trip.id}:`, error);
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
    }
}

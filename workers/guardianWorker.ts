// workers/guardianWorker.ts
import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { getFlightStatus } from "@/services/flightStatusService";
import { notifyGuardianEvent } from "@/services/notifications/guardianNotifier";

export type GuardianEventType = 'DELAY' | 'GATE_CHANGE' | 'CANCELLED' | 'DATA_ISSUE';
export type GuardianEventSeverity = 'low' | 'medium' | 'high';

export interface GuardianEvent {
    eventId?: string;
    tripId: string;
    type: GuardianEventType;
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

const generateEventKey = (tripId: string, eventType: string, bucket?: number) => {
    return bucket ? `${tripId}:${eventType}:${bucket}` : `${tripId}:${eventType}`;
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
                arrivalGate: snapshot.arrivalGate
            },
            update: {
                delayMinutes: snapshot.delayMinutes,
                status: snapshot.status,
                dataQuality: snapshot.dataQuality,
                departureGate: snapshot.departureGate,
                arrivalGate: snapshot.arrivalGate
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
                const segment = trip.segments[0];
                const previousState = (trip.snapshot as any) ?? {
                    delayMinutes: 0,
                    status: 'scheduled',
                    departureGate: null,
                    arrivalGate: null,
                    dataQuality: 'UNKNOWN'
                };

                const newSnapshot = {
                    delayMinutes: previousState.delayMinutes,
                    status: previousState.status,
                    departureGate: previousState.departureGate,
                    arrivalGate: previousState.arrivalGate,
                    dataQuality: previousState.dataQuality
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

                const queueDispatch = (event: Omit<GuardianEvent, 'tripId' | 'detectedAt'>, bucket?: number) => {
                    const key = generateEventKey(trip.id, event.type, bucket);
                    const eventPayload = {
                        eventId: key,
                        tripId: trip.id,
                        detectedAt: new Date().toISOString(),
                        ...event
                    };
                    generatedEvents.push(eventPayload);
                    
                    if (trip.user) {
                        notificationPromises.push(notifyGuardianEvent(eventPayload, trip.user));
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
                            severity: 'medium',
                            previous: previousState.status,
                            current: 'UNKNOWN'
                        });
                    }
                    newSnapshot.dataQuality = currentDataQuality;
                    newSnapshot.status = computedStatus;
                } else if (computedStatus === 'CANCELLED' && previousState.status !== 'CANCELLED') {
                    queueDispatch({
                        type: 'CANCELLED',
                        severity: 'high',
                        previous: previousState.status,
                        current: 'CANCELLED'
                    });
                    newSnapshot.status = 'CANCELLED';
                    newSnapshot.delayMinutes = 0;
                    newSnapshot.dataQuality = currentDataQuality;
                } else {
                    newSnapshot.status = computedStatus;
                    newSnapshot.dataQuality = currentDataQuality;
                }

                if (computedStatus !== 'CANCELLED' && computedStatus !== 'UNKNOWN') {
                    const prevBucket = getDelayBucket(previousState.delayMinutes);
                    const currBucket = getDelayBucket(explicitDelayMinutes);

                    if (currBucket > prevBucket && currBucket >= 15) {
                        const severityMap: Record<number, GuardianEventSeverity> = { 15: 'low', 30: 'medium', 60: 'high' };
                        
                        queueDispatch({
                            type: 'DELAY',
                            severity: severityMap[currBucket] || 'high',
                            previous: `${previousState.delayMinutes}min`,
                            current: `${explicitDelayMinutes}min (Bucket ${currBucket})`
                        }, currBucket);
                    }
                    
                    newSnapshot.delayMinutes = explicitDelayMinutes;
                }

                if (computedStatus !== 'UNKNOWN') {
                    const gateChanged =
                        (newDepGate && newDepGate !== previousState.departureGate && previousState.departureGate !== null) ||
                        (newArrGate && newArrGate !== previousState.arrivalGate && previousState.arrivalGate !== null);

                    if (gateChanged) {
                        queueDispatch({
                            type: 'GATE_CHANGE',
                            severity: 'low',
                            previous: {
                                departureGate: previousState.departureGate,
                                arrivalGate: previousState.arrivalGate
                            },
                            current: {
                                departureGate: newDepGate,
                                arrivalGate: newArrGate
                            }
                        });
                    }
                    newSnapshot.departureGate = newDepGate;
                    newSnapshot.arrivalGate = newArrGate;
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

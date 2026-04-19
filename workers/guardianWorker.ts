// workers/guardianWorker.ts
import { prisma } from "@/lib/prisma";
import { getFlightStatus } from "@/services/flightStatusService";
import { TripStatus } from "@prisma/client";

export type GuardianEventType = 'DELAY' | 'GATE_CHANGE' | 'CANCELLED';
export type GuardianEventSeverity = 'low' | 'medium' | 'high';

export interface GuardianEvent {
    tripId: string;
    type: GuardianEventType;
    severity: GuardianEventSeverity;
    previous: any;
    current: any;
    detectedAt: string;
}

const normalizeFlightStatus = (rawStatus: string, delayMins: number): 'ON_TIME' | 'DELAYED' | 'CANCELLED' => {
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

export async function processFlightMonitoring() {
    console.log("🛡️ [GUARDIAN WORKER] Starting monitoring cycle...");

    try {
        const now = new Date();
        const activeTrips = await prisma.monitoredTrip.findMany({
            where: {
                status: 'ACTIVE',
                nextCheckAt: { lte: now }
            },
            include: {
                segments: true,
                snapshot: true,
            }
        });

        console.log(`🔎 Found ${activeTrips.length} active trips to check.`);

        const generatedEvents: GuardianEvent[] = [];

        for (const trip of activeTrips) {
            const segment = trip.segments[0];
            if (!segment) continue;

            const previousState = trip.snapshot ?? {
                delayMinutes: 0,
                status: 'scheduled',
                departureGate: null,
                arrivalGate: null,
            };

            const dateStr = new Date(segment.departureDate).toISOString().split('T')[0];
            
            let statusResult;
            try {
                statusResult = await getFlightStatus(segment.flightNumber, dateStr);
            } catch (err: any) {
                console.warn(`   ⚠️ Exception during status fetch: ${err.message}`);
                continue;
            }

            if ('error' in statusResult) {
                console.warn(`   ⚠️ Could not fetch status: ${statusResult.message}`);
                continue;
            }

            const currentStatus = statusResult;
            const newSnapshot = {
                delayMinutes: previousState.delayMinutes,
                status: previousState.status,
                departureGate: previousState.departureGate,
                arrivalGate: previousState.arrivalGate,
            };

            // ── Normalization & Explicit Time Computation ──
            const safeParseMs = (isoStr: string | undefined): number => {
                if (!isoStr) return 0;
                const ms = new Date(isoStr).getTime();
                return isNaN(ms) ? 0 : ms;
            };
            
            const reqScheduled = safeParseMs(currentStatus.scheduledArrival) || safeParseMs(currentStatus.scheduledDeparture);
            const reqActual = safeParseMs(currentStatus.actualArrival || currentStatus.estimatedArrival) || safeParseMs(currentStatus.actualDeparture);

            let explicitDelayMinutes = 0;
            if (reqScheduled > 0 && reqActual > 0 && reqActual > reqScheduled) {
                explicitDelayMinutes = Math.round((reqActual - reqScheduled) / 60000);
            }
            
            const computedStatus = normalizeFlightStatus(currentStatus.status, explicitDelayMinutes);

            // A) CANCELLATION & STATUS CHANGE
            if (computedStatus === 'CANCELLED' && previousState.status !== 'CANCELLED') {
                generatedEvents.push({
                    tripId: trip.id,
                    type: 'CANCELLED',
                    severity: 'high',
                    previous: previousState.status,
                    current: 'CANCELLED',
                    detectedAt: new Date().toISOString()
                });
                newSnapshot.status = 'CANCELLED';
                newSnapshot.delayMinutes = 0;
            } else if (computedStatus !== previousState.status && computedStatus !== 'CANCELLED') {
                newSnapshot.status = computedStatus;
            }

            // B) DELAY (Milestone Bucketing)
            if (computedStatus !== 'CANCELLED') {
                const prevBucket = getDelayBucket(previousState.delayMinutes);
                const currBucket = getDelayBucket(explicitDelayMinutes);

                if (currBucket > prevBucket) {
                    const severity = currBucket >= 60 ? 'high' : 'medium';
                    
                    generatedEvents.push({
                        tripId: trip.id,
                        type: 'DELAY',
                        severity,
                        previous: `${previousState.delayMinutes}min (Bucket ${prevBucket})`,
                        current: `${explicitDelayMinutes}min (Bucket ${currBucket})`,
                        detectedAt: new Date().toISOString()
                    });
                }
                
                // Always sync the absolute latency to allow progressive resolution
                newSnapshot.delayMinutes = explicitDelayMinutes;
            }

            // C) GATE CHANGE
            const newDepGate = currentStatus.departureGate ?? null;
            const newArrGate = currentStatus.arrivalGate ?? null;
            
            const gateChanged =
                (newDepGate && newDepGate !== previousState.departureGate && previousState.departureGate !== null) ||
                (newArrGate && newArrGate !== previousState.arrivalGate && previousState.arrivalGate !== null);

            if (gateChanged) {
                generatedEvents.push({
                    tripId: trip.id,
                    type: 'GATE_CHANGE',
                    severity: 'low',
                    previous: {
                        departureGate: previousState.departureGate,
                        arrivalGate: previousState.arrivalGate
                    },
                    current: {
                        departureGate: newDepGate,
                        arrivalGate: newArrGate
                    },
                    detectedAt: new Date().toISOString()
                });

                newSnapshot.departureGate = newDepGate;
                newSnapshot.arrivalGate = newArrGate;
            }

            // 4. Update Snapshot Identity (upsert ensures idempotency)
            const { tripId: _tid, id: _sid, snapshotAt: _sa, ...updatePayload } = { ...newSnapshot } as any;

            await prisma.tripSnapshot.upsert({
                where: { tripId: trip.id },
                create: { 
                    tripId: trip.id, 
                    delayMinutes: newSnapshot.delayMinutes,
                    status: newSnapshot.status,
                    departureGate: newSnapshot.departureGate,
                    arrivalGate: newSnapshot.arrivalGate
                },
                update: {
                    delayMinutes: newSnapshot.delayMinutes,
                    status: newSnapshot.status,
                    departureGate: newSnapshot.departureGate,
                    arrivalGate: newSnapshot.arrivalGate
                },
            });

            // 5. Advance next check window
            const nextCheck = new Date(now.getTime() + trip.checkFrequency * 60000);
            await prisma.monitoredTrip.update({
                where: { id: trip.id },
                data: { lastCheckedAt: now, nextCheckAt: nextCheck }
            });
        }

        // 6. Log Generated Events
        if (generatedEvents.length > 0) {
            console.log(`\n🎉 [GUARDIAN] ${generatedEvents.length} distinct events detected:\n`);
            generatedEvents.forEach(event => {
                const messageMap = {
                    'DELAY': `Delay detected: +${Number(event.current) - Number(event.previous)}min`,
                    'CANCELLED': `Flight cancelled!`,
                    'GATE_CHANGE': `Gate change detected.`
                };
                
                console.log(`[GUARDIAN] ${messageMap[event.type]} (tripId=${event.tripId})`);
                console.log(`   └ Severity: ${event.severity} | DetectedAt: ${event.detectedAt}`);
                console.log(`   └ Prev: ${JSON.stringify(event.previous)} -> Curr: ${JSON.stringify(event.current)}`);
            });
            console.log("\n");
        } else {
            console.log("✈️ [GUARDIAN] No critical changes detected on active trips.");
        }

        console.log("✅ [GUARDIAN WORKER] Cycle complete.");
        return { success: true, processed: activeTrips.length, events: generatedEvents };

    } catch (error) {
        console.error("❌ [GUARDIAN WORKER] Error:", error);
        return { success: false, error };
    }
}

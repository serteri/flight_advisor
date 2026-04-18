// workers/guardianWorker.ts
import { prisma } from "@/lib/prisma";
import { getFlightStatus } from "@/services/flightStatusService";
import { NotificationDispatcher } from "@/services/notifications/dispatcher";
import { UserPreferences, UserTier, ToneOfVoice } from "@/services/notifications/types";
import { TripStatus } from "@prisma/client";

export async function processFlightMonitoring() {
    console.log("🛡️ [GUARDIAN WORKER] Starting monitoring cycle...");
    const dispatcher = NotificationDispatcher.getInstance();

    try {
        const now = new Date();
        const activeTrips = await prisma.monitoredTrip.findMany({
            where: {
                status: 'ACTIVE',
                nextCheckAt: { lte: now }
            },
            include: {
                segments: true,
                user: true,
                snapshot: true,
            }
        });

        console.log(`🔎 Found ${activeTrips.length} trips to check.`);

        for (const trip of activeTrips) {
            console.log(`   Processing Trip: ${trip.pnr} (${trip.routeLabel})`);
            const segment = trip.segments[0];
            if (!segment) continue;

            // Load persisted snapshot or use safe defaults.
            // This replaces the in-memory lastAlertState which reset on every cold start.
            const previousState = trip.snapshot ?? {
                delayMinutes: 0,
                status: 'scheduled',
                departureGate: null,
                arrivalGate: null,
            };

            const dateStr = new Date(segment.departureDate).toISOString().split('T')[0];
            console.log(`   🔍 Checking ${segment.flightNumber} on ${dateStr}...`);

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

            // A) CANCELLATION
            if (currentStatus.status === 'cancelled' && previousState.status !== 'cancelled') {
                console.log(`🚨 FLIGHT CANCELLED: ${segment.flightNumber}`);

                await dispatcher.dispatch(getUserPrefs(trip.user), {
                    userId: trip.userId,
                    tripId: trip.id,
                    type: 'DISRUPTION',
                    title: '🚨 Flight Cancelled - EU261 Compensation!',
                    message: `Flight ${segment.flightNumber} is CANCELLED. You may be eligible for €${currentStatus.compensationAmount || 600} compensation under EU261.`,
                    priority: 'CRITICAL',
                    data: {
                        flightNumber: segment.flightNumber,
                        amount: `€${currentStatus.compensationAmount || 600}`,
                        destination: segment.destination,
                        isEU261: true,
                        reason: 'Flight cancelled',
                    }
                });

                newSnapshot.status = 'cancelled';
            }

            // B) DELAY
            const totalDelay = currentStatus.arrivalDelayMinutes || currentStatus.departureDelayMinutes || 0;

            if (trip.watchDelay && totalDelay > 0) {
                const delayDiff = totalDelay - previousState.delayMinutes;

                if (delayDiff >= 15) {
                    const isEU261 = totalDelay >= 180;
                    const priority = isEU261 ? 'CRITICAL' : 'WARNING';

                    console.log(`⚠️ DELAY: ${totalDelay} mins (EU261: ${isEU261})`);

                    const message = isEU261
                        ? `Flight ${segment.flightNumber} delayed ${totalDelay}min! EU261 compensation of €${currentStatus.compensationAmount || 400} may apply.`
                        : `Flight ${segment.flightNumber} delayed ${totalDelay} minutes.`;

                    await dispatcher.dispatch(getUserPrefs(trip.user), {
                        userId: trip.userId,
                        tripId: trip.id,
                        type: 'DISRUPTION',
                        title: isEU261 ? '💰 Major Delay - EU261!' : `⏱️ Flight Delayed (${totalDelay}m)`,
                        message,
                        priority,
                        data: {
                            flightNumber: segment.flightNumber,
                            amount: isEU261 ? `€${currentStatus.compensationAmount || 400}` : '€0',
                            destination: segment.destination,
                            isEU261,
                            delayMinutes: totalDelay,
                        }
                    });

                    newSnapshot.delayMinutes = totalDelay;
                }
            }

            // C) GATE CHANGE
            const newDepGate = currentStatus.departureGate ?? null;
            const newArrGate = currentStatus.arrivalGate ?? null;
            const gateChanged =
                (newDepGate && newDepGate !== previousState.departureGate && previousState.departureGate !== null) ||
                (newArrGate && newArrGate !== previousState.arrivalGate && previousState.arrivalGate !== null);

            if (gateChanged) {
                console.log(`🚪 GATE CHANGE detected for ${segment.flightNumber}`);

                await dispatcher.dispatch(getUserPrefs(trip.user), {
                    userId: trip.userId,
                    tripId: trip.id,
                    type: 'GATE_CHANGE',
                    title: 'Gate Changed',
                    message: `Flight ${segment.flightNumber} gate changed. Departure: ${newDepGate ?? 'TBD'}`,
                    priority: 'OPPORTUNITY',
                    data: {
                        flightNumber: segment.flightNumber,
                        oldDepartureGate: previousState.departureGate,
                        newDepartureGate: newDepGate,
                        oldArrivalGate: previousState.arrivalGate,
                        newArrivalGate: newArrGate,
                    }
                });

                newSnapshot.departureGate = newDepGate;
                newSnapshot.arrivalGate = newArrGate;
            }

            // Persist new snapshot (upsert — idempotent on cold start)
            await prisma.tripSnapshot.upsert({
                where: { tripId: trip.id },
                create: { tripId: trip.id, ...newSnapshot },
                update: newSnapshot,
            });

            // Advance next check window
            const nextCheck = new Date(now.getTime() + trip.checkFrequency * 60000);
            await prisma.monitoredTrip.update({
                where: { id: trip.id },
                data: { lastCheckedAt: now, nextCheckAt: nextCheck }
            });
        }

        console.log("✅ [GUARDIAN WORKER] Cycle complete.");
        return { success: true, processed: activeTrips.length };

    } catch (error) {
        console.error("❌ [GUARDIAN WORKER] Error:", error);
        return { success: false, error };
    }
}

function getUserPrefs(user: any): UserPreferences {
    const userPlan = (user.subscriptionPlan || 'FREE') as UserTier;
    const isPro = userPlan === 'PRO' || userPlan === 'ELITE';

    return {
        tier: userPlan,
        tone: (user.notificationTone || 'STANDARD') as ToneOfVoice,
        channels: {
            email: true,
            push: isPro,
            sms: userPlan === 'ELITE',
            telegram: !!user.telegramId
        },
        contact: {
            email: user.email,
            phone: user.phoneNumber || '',
            telegramId: user.telegramId
        }
    };
}

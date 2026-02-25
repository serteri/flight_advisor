// workers/guardianWorker.ts
import { prisma } from "@/lib/prisma";
import { getFlightStatus } from "@/services/flightStatusService"; // ✅ REAL DATA
import { NotificationDispatcher } from "@/services/notifications/dispatcher";
import { NotificationPayload, UserPreferences, UserTier, ToneOfVoice } from "@/services/notifications/types";
import { TripStatus } from "@prisma/client";

// MOCK: In a real app, we track last alert state in DB to prevent spam
const lastAlertState: Record<string, any> = {};

export async function processFlightMonitoring() {
    console.log("🛡️ [GUARDIAN WORKER] Starting monitoring cycle...");
    const dispatcher = NotificationDispatcher.getInstance();

    try {
        // 1. Fetch Active Trips due for check
        const now = new Date();
        const activeTrips = await prisma.monitoredTrip.findMany({
            where: {
                status: 'ACTIVE',
                nextCheckAt: { lte: now }
            },
            include: {
                segments: true,
                user: true // User info for notification preferences
            }
        });

        console.log(`🔎 Found ${activeTrips.length} trips to check.`);

        for (const trip of activeTrips) {
            console.log(`   Processing Trip: ${trip.pnr} (${trip.routeLabel})`);
            const segment = trip.segments[0];
            if (!segment) continue;

            const tripKey = trip.id;
            
            // 2. ✅ REAL DATA: Ask AeroDataBox for Live Status
            const departureDate = new Date(segment.departureDate);
            const dateStr = departureDate.toISOString().split('T')[0]; // YYYY-MM-DD
            
            console.log(`   🔍 Checking ${segment.flightNumber} on ${dateStr}...`);
            
            let statusResult;
            try {
                statusResult = await getFlightStatus(segment.flightNumber, dateStr);
            } catch (err: any) {
                console.warn(`   ⚠️ Exception during status fetch: ${err.message}`);
                continue; // Skip this trip if status fetch throws
            }
            
            // Handle API errors gracefully
            if ('error' in statusResult) {
                console.warn(`   ⚠️ Could not fetch status: ${statusResult.message}`);
                // Continue to next trip instead of crashing
                continue;
            }
            
            const currentStatus = statusResult;
            
            // Get previous state or initialize
            const previousState = lastAlertState[tripKey] || { 
                delay: 0, 
                status: 'scheduled', 
                gate: null 
            };

            // 3. ANALYZE & DISPATCH (Real AeroDataBox Data)

            // A) CANCELLATION (CRITICAL) - EU261 Trigger!
            if (currentStatus.status === 'cancelled' && previousState.status !== 'cancelled') {
                console.log(`🚨 FLIGHT CANCELLED: ${segment.flightNumber}`);
                console.log(`💰 EU261 ELIGIBLE: €${currentStatus.compensationAmount || 600}`);
                
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
                        reason: 'Flight cancelled'
                    }
                });

                lastAlertState[tripKey] = { ...previousState, status: 'cancelled' };
            }

            // B) DELAY (WARNING / CRITICAL) - EU261 at 180+ mins
            const totalDelay = currentStatus.arrivalDelayMinutes || currentStatus.departureDelayMinutes || 0;
            
            if (trip.watchDelay && totalDelay > 0) {
                // Anti-Spam: Only alert if delay increased by 15+ mins
                const delayDiff = totalDelay - (previousState.delay || 0);

                if (delayDiff >= 15) {
                    const isEU261 = totalDelay >= 180; // 3+ hours = Compensation!
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
                        priority: priority,
                        data: {
                            flightNumber: segment.flightNumber,
                            amount: isEU261 ? `€${currentStatus.compensationAmount || 400}` : '€0',
                            destination: segment.destination,
                            isEU261,
                            delayMinutes: totalDelay
                        }
                    });

                    lastAlertState[tripKey] = { ...previousState, delay: totalDelay };
                }
            }

            // C) GATE CHANGE (INFO) - Real data from AeroDataBox
            const newGate = currentStatus.departureGate || currentStatus.arrivalGate;
            if (newGate && newGate !== previousState.gate && previousState.gate !== null) {
                console.log(`🚪 GATE CHANGE: ${previousState.gate} → ${newGate}`);
                
                await dispatcher.dispatch(getUserPrefs(trip.user), {
                    userId: trip.userId,
                    tripId: trip.id,
                    type: 'GATE_CHANGE',
                    title: 'Gate Changed',
                    message: `Flight ${segment.flightNumber} gate changed from ${previousState.gate} to ${newGate}`,
                    priority: 'OPPORTUNITY', // Low priority notification
                    data: {
                        flightNumber: segment.flightNumber,
                        oldGate: previousState.gate,
                        newGate
                    }
                });

                lastAlertState[tripKey] = { ...previousState, gate: newGate };
            }

            // 4. Update Next Check Time
            // Frequency is in minutes (e.g., 15, 60, 1440)
            const nextCheck = new Date(now.getTime() + trip.checkFrequency * 60000);

            await prisma.monitoredTrip.update({
                where: { id: trip.id },
                data: {
                    lastCheckedAt: now,
                    nextCheckAt: nextCheck
                }
            });
        }

        console.log("✅ [GUARDIAN WORKER] Cycle complete.");
        return { success: true, processed: activeTrips.length };

    } catch (error) {
        console.error("❌ [GUARDIAN WORKER] Error:", error);
        return { success: false, error };
    }
}

// Helper: Convert Database User to Notification Preferences
function getUserPrefs(user: any): UserPreferences {
    // In a real app, these fields would exist in DB or be joined relations
    // For now, we mock based on user plan or random logic to support the feature
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
            phone: user.phoneNumber || '', // Updated field name
            telegramId: user.telegramId
        }
    };
}

// NOTE:
// This module must be side-effect free.
// Monitoring is triggered only by cron routes or explicit worker runners.

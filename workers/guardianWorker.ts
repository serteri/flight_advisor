// workers/guardianWorker.ts
import { prisma } from "@/lib/prisma";
import { checkAmadeusFlightStatus } from "@/services/amadeus/status";
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
            // 2. Ask Amadeus for Live Status
            const departureDate = new Date(segment.departureDate);
            const currentStatus = await checkAmadeusFlightStatus(segment.flightNumber, departureDate);
            
            // Get previous state or initialize
            const previousState = lastAlertState[tripKey] || { delay: 0, status: 'SCHEDULED', gate: null };

            // 3. ANALYZE & DISPATCH

            // A) CANCELLATION (CRITICAL)
            if (currentStatus.status === 'CANCELLED' && previousState.status !== 'CANCELLED') {
                console.log(`🚨 FLIGHT CANCELLED: ${segment.flightNumber}`);
                
                await dispatcher.dispatch(getUserPrefs(trip.user), {
                    userId: trip.userId,
                    tripId: trip.id,
                    type: 'DISRUPTION',
                    title: 'Flight Cancelled!',
                    message: `Flight ${segment.flightNumber} is cancelled. Activate Plan B immediately.`,
                    priority: 'CRITICAL',
                    data: { 
                        flightNumber: segment.flightNumber, 
                        amount: '600€', // Potential compensation
                        destination: segment.destination
                    }
                });

                lastAlertState[tripKey] = { ...previousState, status: 'CANCELLED' };
            }

            // B) DELAY (WARNING / CRITICAL)
            if (trip.watchDelay && currentStatus.delayMinutes > 0) {
                // Anti-Spam: Only alert if delay increased by 15+ mins compared to last KNOWN delay
                const delayDiff = currentStatus.delayMinutes - (previousState.delay || 0);

                if (delayDiff >= 15) {
                    const isCritical = currentStatus.delayMinutes > 180; // >3 hours = Money!
                    const priority = isCritical ? 'CRITICAL' : 'WARNING';
                    
                    console.log(`⚠️ DELAY DETECTED: ${currentStatus.delayMinutes} mins (Priority: ${priority})`);

                    await dispatcher.dispatch(getUserPrefs(trip.user), {
                        userId: trip.userId,
                        tripId: trip.id,
                        type: 'DISRUPTION',
                        title: `Flight Delayed (${currentStatus.delayMinutes}m)`,
                        message: `New delay detected. Total delay: ${currentStatus.delayMinutes} minutes.`,
                        priority: priority,
                        data: {
                            flightNumber: segment.flightNumber,
                            amount: isCritical ? '600€' : '0€',
                            destination: segment.destination
                        }
                    });

                    lastAlertState[tripKey] = { ...previousState, delay: currentStatus.delayMinutes };
                }
            }

            // C) GATE CHANGE (WARNING) - Disabled: Mock API doesn't provide gate info
            // if (currentStatus.gate && currentStatus.gate !== previousState.gate) { ... }

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

// ====== MAIN EXECUTION ======
processFlightMonitoring()
    .then(() => {
        console.log("✅ [GUARDIAN WORKER] Cycle complete!");
        process.exit(0);
    })
    .catch((err) => {
        console.error("❌ [GUARDIAN WORKER] Fatal error:", err);
        process.exit(1);
    });

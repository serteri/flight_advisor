// workers/guardianWorker.ts
import { prisma } from "@/lib/db";
import { checkAmadeusFlightStatus } from "@/services/amadeus/status";
import { notifyUser } from "@/lib/notifications";
import { TripStatus } from "@prisma/client";

export async function processFlightMonitoring() {
    console.log("🛡️ [GUARDIAN WORKER] Starting monitoring cycle...");

    try {
        // 1. Fetch Active Trips due for check
        // We look for trips where nextCheckAt is in the past (or now)
        const now = new Date();
        const activeTrips = await prisma.monitoredTrip.findMany({
            where: {
                status: 'ACTIVE',
                nextCheckAt: {
                    lte: now
                }
            },
            include: {
                segments: true,
                user: true // To get plan details if needed (though freq is already in trip)
            }
        });

        console.log(`🔎 Found ${activeTrips.length} trips to check.`);

        for (const trip of activeTrips) {
            console.log(`   Processing Trip: ${trip.pnr} (${trip.routeLabel})`);

            // For simplicity, we check the FIRST segment's flight number/date
            // In a real app, we might check all segments.
            const segment = trip.segments[0];
            if (!segment) continue;

            // 2. Ask Amadeus for Live Status
            const currentStatus = await checkAmadeusFlightStatus(segment.flightNumber, segment.departureDate);

            // 3. ANALYZE & ALERT

            // A) Disruption Hunter (Delay > 180 min or Cancelled)
            if (trip.watchDelay) {
                if (currentStatus.delayMinutes > 180 || currentStatus.status === 'CANCELLED') {
                    const message = currentStatus.status === 'CANCELLED'
                        ? `Flight ${segment.flightNumber} is CANCELLED! Claim your €600 compensation now.`
                        : `Flight ${segment.flightNumber} has a ${currentStatus.delayMinutes} min delay. You are eligible for €600!`;

                    await notifyUser(
                        trip.userId,
                        "💰 Tazminat Radarı (Disruption Hunter)",
                        message,
                        'DISRUPTION',
                        trip.id,
                        { potentialValue: '€600', actionLabel: 'Tazminat Al' }
                    );
                }
            }

            // B) Schedule Guardian (Time Change)
            if (trip.watchSchedule && currentStatus.hasScheduleChange) {
                await notifyUser(
                    trip.userId,
                    "⏰ Zaman Muhafızı (Schedule Guardian)",
                    `Flight ${segment.flightNumber} schedule has changed. You may be entitled to a refund.`,
                    'SCHEDULE_CHANGE',
                    trip.id,
                    { actionLabel: 'İade Hakkını Gör' }
                );
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

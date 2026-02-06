import { prisma } from "@/lib/db";

export type NotificationType = 'SCHEDULE_CHANGE' | 'DISRUPTION' | 'PRICE_ALERT' | 'SEAT_ALERT' | 'UPGRADE_ALERT' | 'INFO';

/**
 * Sends a notification to the user (DB Alert + Push/Email Mock)
 */
export async function notifyUser(
    userId: string,
    title: string,
    message: string,
    type: NotificationType,
    tripId: string,
    metadata?: any
) {
    console.log(`\n🔔 [NOTIFICATION] To User ${userId}: "${title}" - ${message}`);

    try {
        // 1. Create DB Alert (Dashboard Notification)
        // We need to link it to a Trip if possible.
        // The schema has GuardianAlert linked to MonitoredTrip.
        if (tripId) {
            await prisma.guardianAlert.create({
                data: {
                    tripId: tripId,
                    type: type,
                    title: title,
                    message: message,
                    severity: type === 'DISRUPTION' || type === 'SCHEDULE_CHANGE' ? 'CRITICAL' : 'INFO',
                    potentialValue: metadata?.potentialValue,
                    actionLabel: metadata?.actionLabel,
                    isRead: false,
                }
            });
            console.log("✅ Alert saved to DB");
        }

        // 2. Mock Push Notification (would use OneSignal/FCM here)
        // ...

        // 3. Mock Email (would use Resend/SendGrid)
        // ...

    } catch (error) {
        console.error("❌ Failed to send notification:", error);
    }
}

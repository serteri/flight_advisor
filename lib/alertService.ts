import { prisma } from "@/lib/prisma";
import { sendTelegramAlertToDefault } from "@/lib/telegram";
import type { Route, User } from "@prisma/client";
import type { AnalysisResult } from "./anomalyDetector";

export async function createAlertAndNotify(
    route: Route & { user: User },
    analysis: AnalysisResult
): Promise<void> {
    try {
        // 1. Create AlertLog in database
        const alert = await prisma.alertLog.create({
            data: {
                routeId: route.id,
                message: analysis.explanation || 'Price anomaly detected',
                score: Math.round(analysis.dealScore),
                oldPrice: analysis.mean,
                newPrice: analysis.currentPrice,
                dropPercent: analysis.dropPercent,
                isRead: false,
            },
        });

        console.log(`[AlertService] Alert created: ${alert.id} for route ${route.originCode}→${route.destinationCode}`);

        // 2. Send Telegram notification
        const telegramSent = await sendTelegramAlertToDefault(route, analysis);

        if (telegramSent) {
            console.log(`[AlertService] Telegram notification sent for alert ${alert.id}`);
        } else {
            console.log(`[AlertService] Telegram notification failed for alert ${alert.id}`);
        }

        // Future: Send email, SMS, push notification, etc.

    } catch (error) {
        console.error('[AlertService] Failed to create alert and notify:', error);
        throw error;
    }
}

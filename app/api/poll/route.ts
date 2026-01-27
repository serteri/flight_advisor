import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { collectPriceSnapshot } from "@/lib/priceCollector";
import { analyzeRoute } from "@/lib/anomalyDetector";
import { createAlertAndNotify } from "@/lib/alertService";

// Rate limiting: track last poll time
let lastPollTime = 0;
const POLL_COOLDOWN_MS = 60 * 1000; // 1 minute

export async function POST(request: Request) {
    // 1. Check authentication with polling secret
    const secret = request.headers.get('X-Polling-Secret');

    if (!process.env.POLLING_SECRET || secret !== process.env.POLLING_SECRET) {
        return NextResponse.json(
            { error: 'Unauthorized - Invalid polling secret' },
            { status: 401 }
        );
    }

    // 2. Rate limiting
    const now = Date.now();
    if (now - lastPollTime < POLL_COOLDOWN_MS) {
        return NextResponse.json(
            {
                error: 'Rate limited',
                message: 'Please wait at least 1 minute between polls',
                nextPollAvailableIn: POLL_COOLDOWN_MS - (now - lastPollTime),
            },
            { status: 429 }
        );
    }

    lastPollTime = now;

    console.log('[Polling] Starting manual poll...');

    // 3. Fetch all active routes
    const routes = await prisma.route.findMany({
        where: { active: true },
        include: { user: true },
        orderBy: { createdAt: 'desc' },
    });

    console.log(`[Polling] Found ${routes.length} active routes`);

    const results = {
        checked: 0,
        anomalies: 0,
        errors: [] as Array<{ routeId: string; error: string }>,
    };

    // 4. Process each route
    for (const route of routes) {
        try {
            console.log(`[Polling] Processing route: ${route.originCode} → ${route.destinationCode}`);

            // Collect latest price snapshot
            const snapshot = await collectPriceSnapshot(route.id);

            if (!snapshot) {
                console.log(`[Polling] No price available for route ${route.id}, skipping`);
                continue;
            }

            results.checked++;

            // Analyze for anomalies
            const analysis = await analyzeRoute(route.id);

            if (!analysis.hasEnoughData) {
                console.log(`[Polling] Route ${route.id} doesn't have enough data yet (need 5+ snapshots)`);
                continue;
            }

            // If anomaly detected, create alert and notify
            if (analysis.isAnomaly) {
                console.log(`[Polling] 🚨 ANOMALY DETECTED for route ${route.id}!`);
                await createAlertAndNotify(route, analysis);
                results.anomalies++;
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[Polling] Error processing route ${route.id}:`, error);
            results.errors.push({
                routeId: route.id,
                error: errorMessage,
            });
        }
    }

    console.log('[Polling] Poll complete');
    console.log(`  Checked: ${results.checked}`);
    console.log(`  Anomalies: ${results.anomalies}`);
    console.log(`  Errors: ${results.errors.length}`);

    return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        totalRoutes: routes.length,
        ...results,
    });
}

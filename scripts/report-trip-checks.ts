// scripts/report-trip-checks.ts
//
// READ-ONLY. Lists a trip's ScheduledTripCheck rows: which were published to
// QStash (messageId), which failed and why, which are waiting beyond the QStash
// delay window.
//
//   npx tsx scripts/report-trip-checks.ts <tripId>                      # .env.local branch
//   npx tsx scripts/report-trip-checks.ts <tripId> \
//     --database-url '<PROD_URL>' --i-understand-this-is-prod           # production
//
// Database rules: lib/ops/dbTarget.ts (production needs both flags; host is
// printed and the script waits 5 s). Never writes.

import { readFileSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import { PROD_CONFIRM_DELAY_MS, parseDbArgs, resolveDbTarget } from '@/lib/ops/dbTarget';
import { PUBLISH_HORIZON_MS, STALE_AFTER_MS } from '@/lib/guardian/publishWindow';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

const readEnvLocal = (): string | null => {
    try { return readFileSync('.env.local', 'utf8'); } catch { return null; }
};

async function main() {
    const { cliUrl, prodConfirmed, rest } = parseDbArgs(process.argv.slice(2));
    const [tripId, ...extra] = rest;
    if (!tripId || extra.length) {
        console.error('Usage: npx tsx scripts/report-trip-checks.ts <tripId> [--database-url <url> --i-understand-this-is-prod]');
        process.exit(1);
    }

    const target = resolveDbTarget({ cliUrl, prodConfirmed, envLocalText: readEnvLocal() });
    if (!target.ok) {
        console.error(`REFUSED: ${target.reason}`);
        process.exit(3);
    }
    process.env.DATABASE_URL = target.url;
    console.log(`DATABASE_URL host: ${target.host}  (source: ${target.source}${target.isProd ? ', PRODUCTION' : ''})  — read-only`);
    if (target.isProd) {
        console.log(`PRODUCTION database. Continuing in ${PROD_CONFIRM_DELAY_MS / 1000}s — Ctrl+C to abort.`);
        await new Promise((resolve) => setTimeout(resolve, PROD_CONFIRM_DELAY_MS));
    }

    const { prisma } = await import('@/lib/prisma');
    const trip = await prisma.monitoredTrip.findUnique({
        where: { id: tripId },
        select: {
            id: true, status: true, routeLabel: true, apiCallsUsed: true, monitoringEndsAt: true,
            segments: { orderBy: { segmentOrder: 'asc' }, take: 1, select: { airlineCode: true, flightNumber: true, departureDate: true, scheduledDepartureUtc: true, scheduledArrivalUtc: true } },
            scheduledChecks: { orderBy: { runAt: 'asc' } },
        },
    });
    if (!trip) {
        console.error(`Trip ${tripId} not found`);
        process.exit(1);
    }

    const now = Date.now();
    const seg = trip.segments[0];
    console.log(`\nTrip ${trip.id}  status=${trip.status}  ${seg ? `${seg.airlineCode}${seg.flightNumber}` : '-'}  ${trip.routeLabel}`);
    if (seg) console.log(`  departureDate ${seg.departureDate.toISOString()}  scheduledDep ${seg.scheduledDepartureUtc?.toISOString() ?? '-'}  scheduledArr ${seg.scheduledArrivalUtc?.toISOString() ?? '-'}`);
    console.log(`  providerCallsUsed ${trip.apiCallsUsed}  monitoringEndsAt ${trip.monitoringEndsAt?.toISOString() ?? '-'}\n`);

    const tally: Record<string, number> = {};
    for (const c of trip.scheduledChecks) {
        let note: string;
        if (c.messageId) note = 'PUBLISHED';
        else if (c.status === 'FAILED') note = `FAILED: ${c.error ?? '-'}`;
        else if (c.status === 'SCHEDULED') {
            const ahead = c.runAt.getTime() - now;
            note = ahead > PUBLISH_HORIZON_MS ? 'WAITING (beyond 6-day window; daily run will publish)'
                : ahead < -STALE_AFTER_MS ? 'STALE (unpublished, >24h overdue)'
                : 'UNPUBLISHED (inside window; next publish-due run publishes)';
        } else note = c.status;
        const key = c.messageId ? 'published' : c.status === 'FAILED' ? 'failed' : c.status === 'SCHEDULED' ? 'unpublished' : c.status.toLowerCase();
        tally[key] = (tally[key] ?? 0) + 1;
        console.log(`${c.kind.padEnd(14)} runAt ${c.runAt.toISOString()}  status=${c.status.padEnd(9)} ${note}`);
    }
    console.log(`\nTotals: ${JSON.stringify(tally)}`);
    await prisma.$disconnect();
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

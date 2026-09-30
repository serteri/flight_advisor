// scripts/backfill-checkpoints.ts
//
// One-off after the QStash migration: ACTIVE trips created while monitoring
// ran on the Vercel cron have no ScheduledTripCheck rows, so nothing would
// ever check them again. Run right after the schema is applied and the new
// code is deployed.
//
// Two separate modes (never both in one run):
//
//   SCHEDULE (default) — plan checkpoints for ACTIVE trips that are still ahead.
//     npx tsx scripts/backfill-checkpoints.ts [--dry-run]     # list only
//     VERCEL_ENV=production npx tsx scripts/backfill-checkpoints.ts --apply
//     --apply calls initializeTripMonitoring (ONE provider lookup per trip) and
//     must publish to QStash, so it refuses unless publishing is allowed
//     (lib/guardian/qstashPolicy.ts) and QSTASH_TOKEN is set.
//
//   COMPLETE_PAST — only mark ACTIVE trips whose scheduled arrival has passed
//     as COMPLETED. No scheduling, no provider lookups, no QStash, no QStash env.
//     npx tsx scripts/backfill-checkpoints.ts --complete-past [--dry-run]
//     npx tsx scripts/backfill-checkpoints.ts --complete-past --apply
//
// Idempotent: a trip that already has a ScheduledTripCheck with a QStash
// message id, or a SCHEDULED/DONE check row, is skipped. Past checkpoints are
// never scheduled.
//
// Database (lib/ops/dbTarget.ts): DATABASE_URL comes from .env.local only —
// never from .env — and a production host is refused. Production needs BOTH
//   --database-url '<url>' --i-understand-this-is-prod
// on the command line; the host is printed and the script waits 5 seconds.

import { readFileSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import {
    PROD_CONFIRM_DELAY_MS,
    parseDbArgs,
    resolveDbTarget,
} from '@/lib/ops/dbTarget';

// Non-DB settings (QStash, RapidAPI, …) may come from the env files.
// DATABASE_URL is overwritten below from the resolved target, never from .env.
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

const readEnvLocal = (): string | null => {
    try {
        return readFileSync('.env.local', 'utf8');
    } catch {
        return null;
    }
};

async function main() {
    const { cliUrl, prodConfirmed, rest } = parseDbArgs(process.argv.slice(2));
    const { parseBackfillArgs, backfillNeedsQStash, classifyForBackfill } = await import('@/lib/guardian/backfill');

    const parsed = parseBackfillArgs(rest);
    if (!parsed.ok) {
        console.error(parsed.reason);
        process.exit(1);
    }
    const { mode, apply } = parsed;

    const target = resolveDbTarget({ cliUrl, prodConfirmed, envLocalText: readEnvLocal() });
    if (!target.ok) {
        console.error(`REFUSED: ${target.reason}`);
        process.exit(3);
    }
    process.env.DATABASE_URL = target.url;

    console.log(`DATABASE_URL host: ${target.host}  (source: ${target.source}${target.isProd ? ', PRODUCTION' : ''})`);
    console.log(`Mode: ${mode}${apply ? ' — APPLY (writes)' : ' — DRY RUN'}\n`);
    if (target.isProd) {
        console.log(`PRODUCTION database. Continuing in ${PROD_CONFIRM_DELAY_MS / 1000}s — Ctrl+C to abort.`);
        await new Promise((resolve) => setTimeout(resolve, PROD_CONFIRM_DELAY_MS));
    }

    // --apply in SCHEDULE mode must really publish, or trips end up with rows
    // nothing will ever call (and each run spends a provider lookup). Only local
    // development stores unpublished SCHEDULED rows on purpose.
    if (backfillNeedsQStash(mode, apply) && process.env.NODE_ENV !== 'development') {
        const { isQStashPublishAllowed } = await import('@/lib/guardian/qstashPolicy');
        if (!isQStashPublishAllowed() || !process.env.QSTASH_TOKEN) {
            console.error(
                'REFUSED: --apply must publish to QStash. Run with the production env: '
                + 'VERCEL_ENV=production and QSTASH_TOKEN set (or QSTASH_FORCE_LIVE=true). Dry run works without it.',
            );
            process.exit(2);
        }
    }

    // Imported only now, after DATABASE_URL is set.
    const { prisma } = await import('@/lib/prisma');

    const now = new Date();
    const trips = await prisma.monitoredTrip.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
        select: {
            id: true,
            routeLabel: true,
            createdAt: true,
            segments: {
                orderBy: { segmentOrder: 'asc' },
                take: 1,
                select: {
                    airlineCode: true,
                    flightNumber: true,
                    departureDate: true,
                    arrivalDate: true,
                    scheduledDepartureUtc: true,
                    scheduledArrivalUtc: true,
                },
            },
            // Already planned: a QStash message id exists, or a live SCHEDULED/DONE row
            // (dev never gets message ids; a failed publish is FAILED and is retried).
            scheduledChecks: {
                where: { OR: [{ messageId: { not: null } }, { status: { in: ['SCHEDULED', 'DONE'] } }] },
                select: { id: true },
                take: 1,
            },
        },
    });

    const counts = { SKIP_ALREADY_SCHEDULED: 0, SKIP_NO_SEGMENT: 0, PAST_ARRIVAL: 0, SCHEDULE: 0 };
    const toSchedule: string[] = [];
    const past: string[] = [];

    for (const trip of trips) {
        const segment = trip.segments[0] ?? null;
        const decision = classifyForBackfill({ hasScheduledMessage: trip.scheduledChecks.length > 0, segment }, now);
        counts[decision.action]++;
        const flight = segment ? `${segment.airlineCode}${segment.flightNumber}` : '-';

        if (decision.action === 'SCHEDULE') {
            toSchedule.push(trip.id);
            if (mode === 'SCHEDULE') {
                const plan = decision.checks.map((c) => `${c.kind}@${c.runAt.toISOString()}`).join(', ');
                console.log(`SCHEDULE  ${trip.id}  ${flight}  ${trip.routeLabel}  → ${plan}`);
            }
        } else if (decision.action === 'PAST_ARRIVAL') {
            past.push(trip.id);
            if (mode === 'COMPLETE_PAST') {
                console.log(`COMPLETE  ${trip.id}  ${flight}  ${trip.routeLabel}  arrival ${decision.arrivalUtc!.toISOString()}  created ${trip.createdAt.toISOString()}`);
            }
        }
    }

    console.log(`\nACTIVE trips: ${trips.length}`);
    console.log(`  future, to schedule:    ${counts.SCHEDULE}${mode === 'SCHEDULE' ? ` (≈${counts.SCHEDULE} provider lookups on --apply)` : ' (not touched in this mode)'}`);
    console.log(`  arrival already passed: ${counts.PAST_ARRIVAL}${mode === 'COMPLETE_PAST' ? '' : ' (not touched in this mode; use --complete-past)'}`);
    console.log(`  already scheduled:      ${counts.SKIP_ALREADY_SCHEDULED}`);
    console.log(`  no segment:             ${counts.SKIP_NO_SEGMENT}`);

    if (mode === 'SCHEDULE' && apply) {
        const { initializeTripMonitoring } = await import('@/lib/guardian/tripLifecycle');
        const totals = { published: 0, failed: 0, storedUnpublished: 0 };
        for (const id of toSchedule) {
            const startedAt = new Date();
            try {
                await initializeTripMonitoring(id, startedAt);
            } catch (error) {
                console.error(`ERROR     ${id}:`, error);
            }
            // Report what actually happened, not just that the call returned.
            const rows = await prisma.scheduledTripCheck.findMany({
                where: { tripId: id, createdAt: { gte: startedAt } },
                select: { messageId: true, status: true },
            });
            const published = rows.filter((r) => r.messageId).length;
            const failed = rows.filter((r) => r.status === 'FAILED').length;
            const storedUnpublished = rows.length - published - failed;
            totals.published += published;
            totals.failed += failed;
            totals.storedUnpublished += storedUnpublished;
            console.log(`APPLIED   ${id}: ${published} published to QStash, ${failed} failed, ${storedUnpublished} stored unpublished (dev)`);
        }
        console.log(`\nTrips: ${toSchedule.length}. QStash messages: ${totals.published} published, ${totals.failed} failed, ${totals.storedUnpublished} stored unpublished.`);
    }

    if (mode === 'COMPLETE_PAST' && apply && past.length > 0) {
        const res = await prisma.monitoredTrip.updateMany({
            where: { id: { in: past }, status: 'ACTIVE' },
            data: { status: 'COMPLETED' },
        });
        console.log(`\nMarked ${res.count} past trips COMPLETED.`);
    } else if (mode === 'COMPLETE_PAST' && !apply) {
        console.log(`\nDry run: would mark ${past.length} past trips COMPLETED (add --apply).`);
    }

    if (!apply) console.log('\nDry run — nothing was written.');
    await prisma.$disconnect();
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

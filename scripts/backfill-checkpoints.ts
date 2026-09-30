// scripts/backfill-checkpoints.ts
//
// One-off after the QStash migration: ACTIVE trips created while monitoring
// ran on the Vercel cron have no ScheduledTripCheck rows, so nothing would
// ever check them again. Run once, right after the schema is applied and the
// new code is deployed.
//
// Usage:
//   npx tsx scripts/backfill-checkpoints.ts                 # dry run (default): list only, writes nothing
//   npx tsx scripts/backfill-checkpoints.ts --apply         # schedule checkpoints for future trips
//   npx tsx scripts/backfill-checkpoints.ts --apply --complete-past
//                                    # also mark ACTIVE trips whose scheduled arrival has passed as
//                                    # COMPLETED (without --apply it only reports how many)
//
// Idempotent: a trip that already has a ScheduledTripCheck with a QStash
// message id, or a SCHEDULED/DONE check row, is skipped. Past checkpoints are
// never scheduled.
// --apply calls initializeTripMonitoring, which spends ONE provider lookup per
// trip (registration, within the per-trip budget). Publishing and live flight
// data both require VERCEL_ENV=production (lib/guardian/qstashPolicy.ts,
// lib/flightData/client.ts), so run --apply with the production env and
// VERCEL_ENV=production set explicitly; otherwise it refuses.
//
// Reads DATABASE_URL from .env.local / .env (in that order) and prints its host
// before doing anything.

import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

async function main() {
    const args = new Set(process.argv.slice(2));
    const apply = args.has('--apply');
    const completePast = args.has('--complete-past');
    const unknown = [...args].filter((a) => !['--apply', '--complete-past'].includes(a));
    if (unknown.length) {
        console.error(`Unknown argument(s): ${unknown.join(', ')}`);
        process.exit(1);
    }

    // --apply must really publish, or trips end up with unpublished rows that
    // nothing will ever call (and each run spends a provider lookup). Only local
    // development stores unpublished SCHEDULED rows on purpose.
    if (apply && process.env.NODE_ENV !== 'development') {
        const { isQStashPublishAllowed } = await import('@/lib/guardian/qstashPolicy');
        if (!isQStashPublishAllowed() || !process.env.QSTASH_TOKEN) {
            console.error(
                'REFUSED: --apply must publish to QStash. Run with the production env: '
                + 'VERCEL_ENV=production and QSTASH_TOKEN set (or QSTASH_FORCE_LIVE=true). Dry run works without it.',
            );
            process.exit(2);
        }
    }

    let host = '(unparseable)';
    try { host = new URL(process.env.DATABASE_URL ?? '').hostname; } catch { /* keep placeholder */ }
    console.log(`DATABASE_URL host: ${host}`);
    console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN'}${completePast ? ' + complete-past' : ''}\n`);

    // Imported after env is loaded.
    const { prisma } = await import('@/lib/prisma');
    const { initializeTripMonitoring } = await import('@/lib/guardian/tripLifecycle');
    const { classifyForBackfill } = await import('@/lib/guardian/backfill');

    const now = new Date();
    const trips = await prisma.monitoredTrip.findMany({
        where: { status: 'ACTIVE' },
        select: {
            id: true,
            routeLabel: true,
            segments: {
                orderBy: { segmentOrder: 'asc' },
                take: 1,
                select: { departureDate: true, arrivalDate: true, scheduledDepartureUtc: true, scheduledArrivalUtc: true },
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
        const decision = classifyForBackfill({
            hasScheduledMessage: trip.scheduledChecks.length > 0,
            segment: trip.segments[0] ?? null,
        }, now);
        counts[decision.action]++;

        if (decision.action === 'SCHEDULE') {
            toSchedule.push(trip.id);
            const plan = decision.checks.map((c) => `${c.kind}@${c.runAt.toISOString()}`).join(', ');
            console.log(`SCHEDULE  ${trip.id}  ${trip.routeLabel}  → ${plan}`);
        } else if (decision.action === 'PAST_ARRIVAL') {
            past.push(trip.id);
            console.log(`PAST      ${trip.id}  ${trip.routeLabel}  arrival ${decision.arrivalUtc!.toISOString()}${completePast ? '' : '  (skipped; use --complete-past)'}`);
        }
    }

    console.log(`\nACTIVE trips: ${trips.length}`);
    console.log(`  to schedule:            ${counts.SCHEDULE} (≈${counts.SCHEDULE} provider lookups on --apply)`);
    console.log(`  arrival already passed: ${counts.PAST_ARRIVAL}`);
    console.log(`  already scheduled:      ${counts.SKIP_ALREADY_SCHEDULED}`);
    console.log(`  no segment:             ${counts.SKIP_NO_SEGMENT}`);

    if (apply) {
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

    if (completePast && past.length > 0) {
        if (apply) {
            const res = await prisma.monitoredTrip.updateMany({
                where: { id: { in: past }, status: 'ACTIVE' },
                data: { status: 'COMPLETED' },
            });
            console.log(`Marked ${res.count} past trips COMPLETED.`);
        } else {
            console.log(`\nDry run: would mark ${past.length} past trips COMPLETED (add --apply).`);
        }
    }

    if (!apply) console.log('\nDry run — nothing was written. Re-run with --apply.');
    await prisma.$disconnect();
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

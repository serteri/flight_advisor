// scripts/publish-due-checks.ts
//
// One-off / manual run of the daily publish-due catch-up (the same logic the
// QStash schedule triggers): publishes unpublished SCHEDULED checkpoints that
// are inside the 6-day QStash window, and resets checks that only FAILED on
// QStash's max delay. Use it right after deploying the fix to complete trips
// whose COMPLETE/ARR checks failed ("quota maxDelay exceeded").
//
//   npx tsx scripts/publish-due-checks.ts                       # dry run: list only
//   VERCEL_ENV=production npx tsx scripts/publish-due-checks.ts --apply \
//     --database-url '<PROD_URL>' --i-understand-this-is-prod
//
// Database rules: lib/ops/dbTarget.ts. --apply publishes to QStash, so it needs
// the production env (VERCEL_ENV=production, QSTASH_TOKEN, QSTASH_URL).

import { readFileSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import { PROD_CONFIRM_DELAY_MS, parseDbArgs, resolveDbTarget } from '@/lib/ops/dbTarget';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

const readEnvLocal = (): string | null => {
    try { return readFileSync('.env.local', 'utf8'); } catch { return null; }
};

async function main() {
    const { cliUrl, prodConfirmed, rest } = parseDbArgs(process.argv.slice(2));
    const unknown = rest.filter((a) => a !== '--apply');
    if (unknown.length) {
        console.error(`Unknown argument(s): ${unknown.join(', ')}`);
        process.exit(1);
    }
    const apply = rest.includes('--apply');

    const target = resolveDbTarget({ cliUrl, prodConfirmed, envLocalText: readEnvLocal() });
    if (!target.ok) {
        console.error(`REFUSED: ${target.reason}`);
        process.exit(3);
    }
    process.env.DATABASE_URL = target.url;
    console.log(`DATABASE_URL host: ${target.host}  (source: ${target.source}${target.isProd ? ', PRODUCTION' : ''})`);
    console.log(apply ? 'Mode: APPLY (publishes to QStash)\n' : 'Mode: DRY RUN\n');

    if (apply) {
        const { isQStashPublishAllowed } = await import('@/lib/guardian/qstashPolicy');
        if (!isQStashPublishAllowed() || !process.env.QSTASH_TOKEN) {
            console.error('REFUSED: --apply must publish. Needs VERCEL_ENV=production and QSTASH_TOKEN (or QSTASH_FORCE_LIVE=true).');
            process.exit(2);
        }
    }
    if (target.isProd) {
        console.log(`PRODUCTION database. Continuing in ${PROD_CONFIRM_DELAY_MS / 1000}s — Ctrl+C to abort.`);
        await new Promise((resolve) => setTimeout(resolve, PROD_CONFIRM_DELAY_MS));
    }

    const { prisma } = await import('@/lib/prisma');
    const { planPublication, MAX_DELAY_ERROR_MARKER } = await import('@/lib/guardian/publishWindow');
    const now = new Date();

    if (!apply) {
        const maxDelayFailed = await prisma.scheduledTripCheck.findMany({
            where: { status: 'FAILED', messageId: null, error: { contains: MAX_DELAY_ERROR_MARKER, mode: 'insensitive' }, trip: { status: 'ACTIVE' } },
            select: { id: true, tripId: true, kind: true, runAt: true },
        });
        const pending = await prisma.scheduledTripCheck.findMany({
            where: { status: 'SCHEDULED', messageId: null, trip: { status: 'ACTIVE' } },
            select: { id: true, tripId: true, kind: true, runAt: true },
        });
        const plan = planPublication([...pending, ...maxDelayFailed], now);
        for (const r of plan.publish) console.log(`PUBLISH   ${r.tripId}  ${r.kind}  ${r.runAt.toISOString()}`);
        console.log(`\nWould reset ${maxDelayFailed.length} maxDelay-failed check(s) to SCHEDULED.`);
        console.log(`Would publish ${plan.publish.length}; ${plan.deferred.length} wait beyond the 6-day window; ${plan.stale.length} stale (>24h overdue, never auto-published).`);
        console.log('\nDry run — nothing was written.');
    } else {
        const { publishDueScheduledChecks } = await import('@/lib/guardian/scheduler');
        console.log(await publishDueScheduledChecks(now));
    }
    await prisma.$disconnect();
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

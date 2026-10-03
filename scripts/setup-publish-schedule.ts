// scripts/setup-publish-schedule.ts
//
// Creates (or updates in place — fixed scheduleId) the daily QStash schedule
// that calls POST /api/guardian/publish-due, which publishes checkpoints that
// have entered the 6-day QStash delay window.
//
//   npx tsx scripts/setup-publish-schedule.ts            # prints what it would do
//   VERCEL_ENV=production npx tsx scripts/setup-publish-schedule.ts --apply
//
// Needs QSTASH_TOKEN, QSTASH_URL and APP_BASE_URL (from the environment or
// .env.local / .env). Idempotent: re-running updates the same schedule.

import { config as loadEnv } from 'dotenv';
import { Client } from '@upstash/qstash';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

export const PUBLISH_SCHEDULE_ID = 'flightagent-publish-due';
export const PUBLISH_SCHEDULE_CRON = '0 3 * * *'; // 03:00 UTC daily

async function main() {
    const apply = process.argv.includes('--apply');
    const missing = ['QSTASH_TOKEN', 'QSTASH_URL', 'APP_BASE_URL'].filter((k) => !process.env[k]?.trim());
    if (missing.length) {
        console.error(`Missing env vars: ${missing.join(', ')}`);
        process.exit(1);
    }
    const destination = `${process.env.APP_BASE_URL!.trim().replace(/\/+$/, '')}/api/guardian/publish-due`;

    console.log(`Schedule: ${PUBLISH_SCHEDULE_ID}`);
    console.log(`Cron:     ${PUBLISH_SCHEDULE_CRON} (UTC)`);
    console.log(`Target:   POST ${destination}`);

    if (!apply) {
        console.log('\nDry run — nothing created. Add --apply (with the production env) to create it.');
        return;
    }
    if (process.env.VERCEL_ENV !== 'production' && process.env.QSTASH_FORCE_LIVE !== 'true') {
        console.error('REFUSED: --apply needs VERCEL_ENV=production (or QSTASH_FORCE_LIVE=true).');
        process.exit(2);
    }

    const client = new Client({ token: process.env.QSTASH_TOKEN!, baseUrl: process.env.QSTASH_URL });
    const res = await client.schedules.create({
        destination,
        cron: PUBLISH_SCHEDULE_CRON,
        scheduleId: PUBLISH_SCHEDULE_ID,
        method: 'POST',
        retries: 3,
    });
    console.log(`\nSchedule ready: ${res.scheduleId}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

// scripts/send-pending-confirmations.ts
//
// One-time: after EMAIL_DELIVERY_READY is switched on, email every waitlist
// sign-up (PENDING_CONFIRMATION trip saved while delivery was off) the normal
// double opt-in link. Selection rules: lib/guardian/pendingConfirmations.ts
// (one email per address; addresses that already have a LoginToken are skipped,
// which makes a second run send nothing).
//
//   npx tsx scripts/send-pending-confirmations.ts [--dry-run]     # default: list only
//   VERCEL_ENV=production EMAIL_DELIVERY_READY=true \
//     npx tsx scripts/send-pending-confirmations.ts --apply \
//     --database-url '<PROD_URL>' --i-understand-this-is-prod
//
// --apply refuses unless real delivery is allowed (lib/email/deliveryPolicy.ts:
// VERCEL_ENV=production AND EMAIL_DELIVERY_READY=true) and the selected
// EMAIL_PROVIDER's keys (RESEND_API_KEY or MAILJET_API_KEY + MAILJET_SECRET_KEY),
// NOTIFICATION_FROM_EMAIL and APP_BASE_URL are set — otherwise it would create
// tokens (blocking a later real run) while the emails were only mocked.
//
// Database: lib/ops/dbTarget.ts — .env.local only by default, production only
// with --database-url + --i-understand-this-is-prod (host printed, 5 s wait).

import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import { PROD_CONFIRM_DELAY_MS, parseDbArgs, resolveDbTarget } from '@/lib/ops/dbTarget';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

const OPT_IN_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // same as /api/trips/track
const SEND_INTERVAL_MS = 600; // stay under Resend's default rate limit

const readEnvLocal = (): string | null => {
    try { return readFileSync('.env.local', 'utf8'); } catch { return null; }
};

async function main() {
    const { cliUrl, prodConfirmed, rest } = parseDbArgs(process.argv.slice(2));
    const unknown = rest.filter((a) => a !== '--apply' && a !== '--dry-run');
    if (unknown.length) {
        console.error(`Unknown argument(s): ${unknown.join(', ')}`);
        process.exit(1);
    }
    const apply = rest.includes('--apply');
    if (apply && rest.includes('--dry-run')) {
        console.error('--apply and --dry-run are mutually exclusive');
        process.exit(1);
    }

    const target = resolveDbTarget({ cliUrl, prodConfirmed, envLocalText: readEnvLocal() });
    if (!target.ok) {
        console.error(`REFUSED: ${target.reason}`);
        process.exit(3);
    }
    process.env.DATABASE_URL = target.url;

    if (apply) {
        const { isRealEmailDeliveryAllowed } = await import('@/lib/email/deliveryPolicy');
        const { getEmailProvider, requiredEnvForProvider } = await import('@/lib/email/provider');
        let providerEnv: string[];
        try {
            providerEnv = requiredEnvForProvider(getEmailProvider());
        } catch (err: any) {
            providerEnv = [`EMAIL_PROVIDER (${err.message})`];
        }
        const missing = [...providerEnv, 'NOTIFICATION_FROM_EMAIL', 'APP_BASE_URL'].filter((k) => !process.env[k]?.trim());
        if (!isRealEmailDeliveryAllowed() || missing.length) {
            console.error(
                'REFUSED: --apply must send real email. Needs VERCEL_ENV=production and EMAIL_DELIVERY_READY=true'
                + (missing.length ? `; missing: ${missing.join(', ')}` : '')
                + '. Otherwise tokens would be created for mocked emails and a later real run would skip those addresses.',
            );
            process.exit(2);
        }
    }

    console.log(`DATABASE_URL host: ${target.host}  (source: ${target.source}${target.isProd ? ', PRODUCTION' : ''})`);
    console.log(`Mode: ${apply ? 'APPLY — sends email' : 'DRY RUN'}\n`);
    if (target.isProd) {
        console.log(`PRODUCTION database. Continuing in ${PROD_CONFIRM_DELAY_MS / 1000}s — Ctrl+C to abort.`);
        await new Promise((resolve) => setTimeout(resolve, PROD_CONFIRM_DELAY_MS));
    }

    const { prisma } = await import('@/lib/prisma');
    const { planPendingConfirmations, maskEmail } = await import('@/lib/guardian/pendingConfirmations');

    const trips = await prisma.monitoredTrip.findMany({
        where: { status: 'PENDING_CONFIRMATION' },
        select: {
            id: true,
            subscriberEmail: true,
            consentGiven: true,
            createdAt: true,
            segments: {
                orderBy: { segmentOrder: 'asc' },
                take: 1,
                select: { airlineCode: true, flightNumber: true, departureDate: true },
            },
        },
    });
    const emails = [...new Set(trips.map((t) => t.subscriberEmail?.trim().toLowerCase()).filter((e): e is string => Boolean(e)))];
    const tokens = emails.length
        ? await prisma.loginToken.findMany({ where: { identifier: { in: emails } }, select: { identifier: true } })
        : [];
    const plan = planPendingConfirmations(
        trips.map((t) => ({ ...t, segment: t.segments[0] ?? null })),
        new Set(tokens.map((t) => t.identifier.toLowerCase())),
        new Date(),
    );

    for (const g of plan.send) {
        console.log(`SEND   ${maskEmail(g.email)}  ${g.flightNumber}  trips: ${g.tripIds.join(', ')}`);
    }
    for (const s of plan.skipped) {
        console.log(`SKIP   ${s.email ? maskEmail(s.email) : '(no email)'}  trip ${s.tripId}  ${s.reason}`);
    }
    console.log(`\nPENDING_CONFIRMATION trips: ${trips.length}`);
    console.log(`  emails to send: ${plan.send.length} (covering ${plan.send.reduce((n, g) => n + g.tripIds.length, 0)} trips)`);
    console.log(`  skipped trips:  ${plan.skipped.length}`);

    if (!apply) {
        console.log('\nDry run — nothing was written, nothing was sent.');
        await prisma.$disconnect();
        return;
    }

    const { sendWelcomeEmail } = await import('@/lib/email/sender');
    let sent = 0;
    let failed = 0;
    for (const g of plan.send) {
        const token = randomBytes(32).toString('hex');
        // Token first: it is the one-time marker even if the send fails.
        await prisma.loginToken.create({
            data: { identifier: g.email, token, expiresAt: new Date(Date.now() + OPT_IN_TOKEN_TTL_MS) },
        });
        const result = await sendWelcomeEmail(g.email, token, g.flightNumber, `/dashboard/guardian/${g.firstTripId}`);
        if (result.success && !result.mocked) {
            sent++;
            console.log(`SENT   ${maskEmail(g.email)}  provider id ${result.messageId ?? '-'}`);
        } else {
            failed++;
            const error = result.error || (result.mocked ? 'mocked — not sent' : 'unknown error');
            console.error(`FAILED ${maskEmail(g.email)}: ${error}`);
            await prisma.loginToken.update({ where: { token }, data: { emailError: error } });
            await prisma.monitoredTrip.updateMany({
                where: { id: { in: g.tripIds } },
                data: { lastEmailError: error, lastEmailErrorAt: new Date() },
            });
        }
        await new Promise((resolve) => setTimeout(resolve, SEND_INTERVAL_MS));
    }
    console.log(`\nSent ${sent}, failed ${failed}. Failed addresses keep their token (marked emailError) and are not retried automatically.`);
    await prisma.$disconnect();
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

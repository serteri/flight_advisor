import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { isEmailDeliveryReady } from '@/lib/featureFlags';
import { maskEmail, planPendingConfirmations, type PendingTripRow } from '@/lib/guardian/pendingConfirmations';

const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;
const NOW = new Date('2026-10-01T12:00:00Z');

const trip = (id: string, email: string | null, opts: Partial<PendingTripRow> & { dep?: string; created?: string } = {}): PendingTripRow => ({
    id,
    subscriberEmail: email,
    consentGiven: opts.consentGiven ?? true,
    createdAt: new Date(opts.created ?? '2026-09-30T10:00:00Z'),
    segment: opts.segment === null ? null : { airlineCode: 'XX', flightNumber: '1180', departureDate: new Date(opts.dep ?? '2026-10-10T00:00:00Z') },
});

test('EMAIL_DELIVERY_READY defaults to off; only "true" turns it on', () => {
    assert.equal(isEmailDeliveryReady(env({})), false);
    assert.equal(isEmailDeliveryReady(env({ EMAIL_DELIVERY_READY: '1' })), false);
    assert.equal(isEmailDeliveryReady(env({ EMAIL_DELIVERY_READY: 'true' })), true);
});

test('one email per address covering all its pending trips; first trip leads', () => {
    const plan = planPendingConfirmations([
        trip('t2', 'A@x.io', { created: '2026-09-30T11:00:00Z' }),
        trip('t1', 'a@x.io', { created: '2026-09-30T10:00:00Z' }),
        trip('t3', 'b@x.io'),
    ], new Set(), NOW);
    assert.equal(plan.send.length, 2);
    const a = plan.send.find((g) => g.email === 'a@x.io')!;
    assert.deepEqual(a.tripIds, ['t1', 't2']);
    assert.equal(a.firstTripId, 't1');
    assert.equal(a.flightNumber, 'XX1180');
});

test('one-time: an address that already has a login token is skipped', () => {
    const plan = planPendingConfirmations([trip('t1', 'a@x.io')], new Set(['a@x.io']), NOW);
    assert.equal(plan.send.length, 0);
    assert.equal(plan.skipped[0].reason, 'ALREADY_HAS_TOKEN');
});

test('no email, no consent, flight already over, or no segment are skipped', () => {
    const plan = planPendingConfirmations([
        trip('n1', null),
        trip('n2', 'c@x.io', { consentGiven: false }),
        trip('n3', 'd@x.io', { dep: '2026-09-20T00:00:00Z' }),
        trip('n4', 'e@x.io', { segment: null }),
        trip('ok', 'f@x.io', { dep: '2026-09-30T20:00:00Z' }), // yesterday evening: inside the 1-day slack
    ], new Set(), NOW);
    assert.deepEqual(plan.skipped.map((s) => s.reason), ['NO_EMAIL', 'NO_CONSENT', 'FLIGHT_PASSED', 'FLIGHT_PASSED']);
    assert.deepEqual(plan.send.map((g) => g.email), ['f@x.io']);
});

test('emails are masked in script output', () => {
    assert.equal(maskEmail('serter@example.com'), 's***@example.com');
});

test('waitlist wiring: track route and request-link send nothing while the flag is off', () => {
    const track = readFileSync('app/api/trips/track/route.ts', 'utf8');
    const early = track.indexOf('if (!isEmailDeliveryReady())');
    assert.ok(early > 0 && early < track.indexOf('prisma.loginToken.create'), 'return before any token is created');
    assert.ok(early < track.indexOf('sendWelcomeEmail('), 'return before any email attempt');
    const link = readFileSync('app/api/auth/request-link/route.ts', 'utf8');
    assert.ok(link.indexOf('if (!isEmailDeliveryReady())') < link.indexOf('prisma.loginToken.create'));
});

test('send script refuses --apply unless real delivery is allowed', () => {
    const src = readFileSync('scripts/send-pending-confirmations.ts', 'utf8');
    assert.match(src, /if \(!isRealEmailDeliveryAllowed\(\) \|\| missing\.length\)/);
    assert.match(src, /resolveDbTarget\(/);
    assert.ok(src.indexOf("await import('@/lib/prisma')") > src.indexOf('process.env.DATABASE_URL = target.url'));
});

test('waitlist copy exists in en/de/tr (tr text as specified)', () => {
    for (const l of ['en', 'de', 'tr']) {
        const w = JSON.parse(readFileSync(`messages/${l}.json`, 'utf8')).Waitlist;
        assert.ok(w?.message && w?.loginNotice && w?.confirmationTitle, l);
    }
    const tr = JSON.parse(readFileSync('messages/tr.json', 'utf8')).Waitlist;
    assert.equal(tr.message, 'E-posta uyarıları çok yakında aktif olacak; aktif olduğunda seni bilgilendireceğiz.');
});

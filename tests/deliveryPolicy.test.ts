import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { isRealEmailDeliveryAllowed } from '@/lib/email/deliveryPolicy';

const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;

test('real email only from Vercel production AND once EMAIL_DELIVERY_READY=true', () => {
    assert.equal(isRealEmailDeliveryAllowed(env({ VERCEL_ENV: 'production', NODE_ENV: 'production', EMAIL_DELIVERY_READY: 'true' })), true);
    assert.equal(isRealEmailDeliveryAllowed(env({ VERCEL_ENV: 'production', NODE_ENV: 'production' })), false, 'waitlist mode');
    assert.equal(isRealEmailDeliveryAllowed(env({ VERCEL_ENV: 'production', EMAIL_DELIVERY_READY: 'false' })), false);
    assert.equal(isRealEmailDeliveryAllowed(env({ VERCEL_ENV: 'preview', EMAIL_DELIVERY_READY: 'true' })), false);
});

test('Vercel preview is mocked even though NODE_ENV=production there', () => {
    assert.equal(isRealEmailDeliveryAllowed(env({ VERCEL_ENV: 'preview', NODE_ENV: 'production' })), false);
});

test('local dev and local `next start` (NODE_ENV=production, no VERCEL_ENV) are mocked', () => {
    assert.equal(isRealEmailDeliveryAllowed(env({ NODE_ENV: 'development' })), false);
    assert.equal(isRealEmailDeliveryAllowed(env({ NODE_ENV: 'production' })), false);
    assert.equal(isRealEmailDeliveryAllowed(env({ VERCEL_ENV: 'development', NODE_ENV: 'development' })), false);
});

test('EMAIL_FORCE_LIVE=true (exactly) forces real delivery', () => {
    assert.equal(isRealEmailDeliveryAllowed(env({ NODE_ENV: 'development', EMAIL_FORCE_LIVE: 'true' })), true);
    assert.equal(isRealEmailDeliveryAllowed(env({ NODE_ENV: 'development', EMAIL_FORCE_LIVE: '1' })), false);
});

// Regression guard: there is exactly one real send point (deliverEmail), it
// consults the policy before touching any provider, and everything else
// (templates, notification provider, claim attachment) goes through it.
test('deliverEmail checks the policy before any provider call; only the test script bypasses it', () => {
    const src = readFileSync('lib/email/deliver.ts', 'utf8');
    const fn = src.slice(src.indexOf('export async function deliverEmail'));
    const policy = fn.indexOf('isRealEmailDeliveryAllowed()');
    assert.ok(policy > 0);
    assert.ok(policy < fn.indexOf('sendViaResend('));
    assert.ok(policy < fn.indexOf('sendViaMailjet('));
    assert.match(readFileSync('scripts/send-test-alert.ts', 'utf8'), /bypassDeliveryPolicy: true/);
    for (const caller of ['lib/flightData/quotaStore.ts', 'lib/email/sender.ts', 'services/notifications/sender.ts', 'services/notifications/providers/emailProvider.ts']) {
        assert.doesNotMatch(readFileSync(caller, 'utf8'), /bypassDeliveryPolicy/, `${caller} must not bypass`);
    }
});

for (const file of ['lib/email/sender.ts', 'services/notifications/providers/emailProvider.ts', 'services/notifications/sender.ts', 'lib/flightData/quotaStore.ts']) {
    test(`${file} sends only through deliverEmail (no direct provider SDK/API)`, () => {
        const src = readFileSync(file, 'utf8');
        assert.match(src, /deliverEmail/);
        assert.doesNotMatch(src, /from 'resend'|api\.mailjet\.com/);
    });
}

test('the policy does not look at NODE_ENV', () => {
    const src = readFileSync('lib/email/deliveryPolicy.ts', 'utf8').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(src, /NODE_ENV/);
});

test('mocked login links are never printed into Vercel logs', async () => {
    const { loggableLink } = await import('@/lib/email/sender');
    const link = 'https://x/api/auth/verify?token=abc';
    assert.equal(loggableLink(link, env({ VERCEL_ENV: 'preview' })), '[link hidden on Vercel]');
    assert.equal(loggableLink(link, env({ VERCEL_ENV: 'production' })), '[link hidden on Vercel]');
    assert.equal(loggableLink(link, env({ NODE_ENV: 'development' })), link);
});

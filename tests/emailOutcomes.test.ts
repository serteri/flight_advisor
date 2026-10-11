import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { deliverEmail } from '@/lib/email/deliver';
import { getEmailConfigIssues, getEmailReadiness, isValidAppUrl } from '@/lib/email/status';

const KEYS = [
    'VERCEL_ENV', 'EMAIL_DELIVERY_READY', 'EMAIL_FORCE_LIVE', 'EMAIL_PROVIDER', 'MAILJET_API_KEY',
    'MAILJET_SECRET_KEY', 'RESEND_API_KEY', 'NOTIFICATION_FROM_EMAIL', 'APP_BASE_URL',
];
const saved: Record<string, string | undefined> = {};
const realFetch = globalThis.fetch;
const realError = console.error;
const realLog = console.log;
let errors: string[] = [];

beforeEach(() => {
    for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
    errors = [];
    console.error = (...a: unknown[]) => { errors.push(a.join(' ')); };
    console.log = () => {};
});
afterEach(() => {
    for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    globalThis.fetch = realFetch;
    console.error = realError;
    console.log = realLog;
});

const prodEnv = () => {
    Object.assign(process.env, {
        VERCEL_ENV: 'production', EMAIL_DELIVERY_READY: 'true', EMAIL_PROVIDER: 'mailjet',
        MAILJET_API_KEY: 'k', MAILJET_SECRET_KEY: 's', NOTIFICATION_FROM_EMAIL: 'FlightAgent <a@flightagent.io>',
        APP_BASE_URL: 'https://www.flightagent.io',
    });
};
const msg = { to: 'x@example.com', subject: 'Hi', text: 'body' };

test('non-production: DELIVERY_DISABLED is a quiet mock (success, nothing sent)', async () => {
    let called = false;
    globalThis.fetch = (async () => { called = true; return new Response('{}'); }) as typeof fetch;
    const r = await deliverEmail('t', msg);
    assert.equal(r.outcome, 'DELIVERY_DISABLED');
    assert.equal(r.success, true);
    assert.equal(r.mocked, true);
    assert.equal(called, false);
    assert.equal(errors.length, 0);
});

test('production with EMAIL_DELIVERY_READY off: DELIVERY_DISABLED fails loudly, not a fake success', async () => {
    prodEnv();
    process.env.EMAIL_DELIVERY_READY = 'false';
    const r = await deliverEmail('t', msg);
    assert.equal(r.outcome, 'DELIVERY_DISABLED');
    assert.equal(r.success, false);
    assert.equal(r.mocked, false);
    assert.ok(errors.some((e) => e.includes('DELIVERY_DISABLED')));
});

test('production, delivery on, config missing: CONFIGURATION_ERROR naming the variables', async () => {
    prodEnv();
    delete process.env.MAILJET_SECRET_KEY;
    delete process.env.NOTIFICATION_FROM_EMAIL;
    const r = await deliverEmail('t', msg);
    assert.equal(r.outcome, 'CONFIGURATION_ERROR');
    assert.equal(r.success, false);
    assert.match(r.error!, /MAILJET_SECRET_KEY/);
    assert.match(r.error!, /NOTIFICATION_FROM_EMAIL/);
    assert.ok(errors.some((e) => e.includes('CONFIGURATION_ERROR')));
});

test('production: a localhost / http APP_BASE_URL is a configuration error', async () => {
    prodEnv();
    process.env.APP_BASE_URL = 'http://localhost:3000';
    assert.equal((await deliverEmail('t', msg)).outcome, 'CONFIGURATION_ERROR');
    assert.equal(isValidAppUrl('https://www.flightagent.io', true), true);
    assert.equal(isValidAppUrl('http://www.flightagent.io', true), false);
    assert.equal(isValidAppUrl('not a url', false), false);
});

test('provider rejection: PROVIDER_ERROR', async () => {
    prodEnv();
    globalThis.fetch = (async () => new Response(JSON.stringify({ ErrorMessage: 'Sender not allowed' }), { status: 401 })) as typeof fetch;
    const r = await deliverEmail('t', msg);
    assert.equal(r.outcome, 'PROVIDER_ERROR');
    assert.equal(r.success, false);
    assert.ok(errors.some((e) => e.includes('PROVIDER_ERROR')));
});

test('provider network failure: PROVIDER_ERROR', async () => {
    prodEnv();
    globalThis.fetch = (async () => { throw new Error('socket hang up'); }) as typeof fetch;
    const r = await deliverEmail('t', msg);
    assert.equal(r.outcome, 'PROVIDER_ERROR');
    assert.match(r.error!, /socket hang up/);
});

test('provider acceptance: DELIVERED with a message id', async () => {
    prodEnv();
    globalThis.fetch = (async () =>
        new Response(JSON.stringify({ Messages: [{ Status: 'success', To: [{ MessageID: 42 }] }] }), { status: 200 })) as typeof fetch;
    const r = await deliverEmail('t', msg);
    assert.equal(r.outcome, 'DELIVERED');
    assert.equal(r.success, true);
    assert.equal(r.mocked, false);
    assert.equal(r.messageId, '42');
});

test('readiness report: names only, state reflects the blocking reason', () => {
    const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;
    assert.equal(getEmailReadiness(env({})).state, 'DELIVERY_DISABLED');

    const ready = getEmailReadiness(env({
        VERCEL_ENV: 'production', EMAIL_DELIVERY_READY: 'true', RESEND_API_KEY: 'x',
        NOTIFICATION_FROM_EMAIL: 'a@b.io', APP_BASE_URL: 'https://www.flightagent.io',
    }));
    assert.equal(ready.state, 'READY');
    assert.equal(ready.provider, 'resend');
    assert.deepEqual(ready.configIssues, []);

    const broken = getEmailReadiness(env({ VERCEL_ENV: 'production', EMAIL_DELIVERY_READY: 'true', EMAIL_PROVIDER: 'sendgrid' }));
    assert.equal(broken.state, 'CONFIGURATION_ERROR');
    assert.equal(broken.provider, 'INVALID');
    assert.ok(broken.configIssues.some((i) => i.startsWith('EMAIL_PROVIDER')));
    assert.ok(!JSON.stringify(broken).includes('sendgrid'));
    assert.deepEqual(getEmailConfigIssues(env({})).sort(), ['APP_BASE_URL', 'NOTIFICATION_FROM_EMAIL', 'RESEND_API_KEY']);
});

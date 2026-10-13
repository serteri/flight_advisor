import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    GUARDIAN_EVENTS,
    buildGuardianEventBody,
    isGuardianAnalyticsEnabled,
    sanitizeGuardianParams,
    trackGuardianEvent,
} from '@/lib/analytics/guardianEvents';

const realFetch = globalThis.fetch;
const saved = { VERCEL_ENV: process.env.VERCEL_ENV, GA4_API_SECRET: process.env.GA4_API_SECRET };
afterEach(() => {
    globalThis.fetch = realFetch;
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
});

test('the nine funnel events exist with the requested names', () => {
    assert.deepEqual([...GUARDIAN_EVENTS], [
        'guardian_form_submitted', 'guardian_confirmation_sent', 'guardian_confirmed', 'guardian_monitoring_started',
        'guardian_check_completed', 'guardian_disruption_detected', 'guardian_alert_sent',
        'guardian_compensation_evaluated', 'guardian_claim_letter_generated',
    ]);
});

test('personal data is stripped: email, names, booking reference, passport, address-like values', () => {
    const clean = sanitizeGuardianParams({
        email: 'a@b.com',
        passenger_name: 'Jane Doe',
        passport_number: 'X123',
        booking_reference: 'ABC123',
        pnr: 'ABC123',
        user_ip: '1.2.3.4',
        note: 'contact me at jane@example.com',
        regime: 'EU261',
        status: 'LIKELY_ELIGIBLE',
        trips: 1,
        waitlist: false,
        'Bad Key': 'x',
        nested: { a: 1 } as unknown as string,
    });
    assert.deepEqual(clean, { regime: 'EU261', status: 'LIKELY_ELIGIBLE', trips: 1, waitlist: false });
});

test('long strings are truncated and non-finite numbers dropped', () => {
    const clean = sanitizeGuardianParams({ detail: 'x'.repeat(500), ratio: Number.NaN, count: 3 });
    assert.equal((clean.detail as string).length, 60);
    assert.equal('ratio' in clean, false);
    assert.equal(clean.count, 3);
});

test('an unknown event name is rejected; the body carries a random client id', () => {
    assert.throws(() => buildGuardianEventBody('guardian_made_up' as never));
    const a = buildGuardianEventBody('guardian_confirmed', { trips: 1 });
    const b = buildGuardianEventBody('guardian_confirmed', { trips: 1 });
    assert.notEqual(a.client_id, b.client_id);
    assert.equal(a.events[0].name, 'guardian_confirmed');
});

test('nothing is sent outside Vercel production or without GA4_API_SECRET', async () => {
    let calls = 0;
    globalThis.fetch = (async () => { calls++; return new Response('{}'); }) as typeof fetch;
    process.env.GA4_API_SECRET = 'secret';
    process.env.VERCEL_ENV = 'preview';
    await trackGuardianEvent('guardian_confirmed', { trips: 1 });
    process.env.VERCEL_ENV = 'production';
    delete process.env.GA4_API_SECRET;
    await trackGuardianEvent('guardian_confirmed', { trips: 1 });
    assert.equal(calls, 0);
    assert.equal(isGuardianAnalyticsEnabled({ VERCEL_ENV: 'production', GA4_API_SECRET: 's' } as unknown as NodeJS.ProcessEnv), true);
});

test('in production a sanitized event is posted to GA4; a failing request never throws', async () => {
    process.env.VERCEL_ENV = 'production';
    process.env.GA4_API_SECRET = 'secret';
    const sent: { url: string; body: string }[] = [];
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => { sent.push({ url: String(url), body: String(init?.body) }); return new Response('{}'); }) as typeof fetch;
    await trackGuardianEvent('guardian_alert_sent', { email: 'a@b.com', event_type: 'DELAY' });
    assert.equal(sent.length, 1);
    assert.match(sent[0].url, /google-analytics\.com\/mp\/collect/);
    assert.doesNotMatch(sent[0].body, /a@b\.com/);
    assert.match(sent[0].body, /"event_type":"DELAY"/);

    globalThis.fetch = (async () => { throw new Error('offline'); }) as typeof fetch;
    const realWarn = console.warn;
    console.warn = () => {};
    await assert.doesNotReject(trackGuardianEvent('guardian_alert_sent', {}));
    console.warn = realWarn;
});

test('wiring: each funnel step fires from its place in the loop', () => {
    const at = (file: string, event: string) => assert.match(readFileSync(file, 'utf8'), new RegExp(`trackGuardianEvent\\('${event}'`), `${file} -> ${event}`);
    at('app/api/trips/track/route.ts', 'guardian_form_submitted');
    at('app/api/trips/track/route.ts', 'guardian_confirmation_sent');
    at('lib/guardian/tripConfirmation.ts', 'guardian_confirmed');
    at('lib/guardian/tripLifecycle.ts', 'guardian_monitoring_started');
    at('workers/guardianWorker.ts', 'guardian_check_completed');
    at('workers/guardianWorker.ts', 'guardian_disruption_detected');
    at('workers/guardianWorker.ts', 'guardian_alert_sent');
    at('workers/guardianWorker.ts', 'guardian_compensation_evaluated');
    at('app/api/compensation/generate-letter/route.ts', 'guardian_claim_letter_generated');
});

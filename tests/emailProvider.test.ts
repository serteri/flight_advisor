import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { getEmailProvider, requiredEnvForProvider } from '@/lib/email/provider';
import { deliverEmail, parseFromAddress } from '@/lib/email/deliver';
import { EmailDeliveryProvider } from '@/services/notifications/providers/emailProvider';
import { getMissingRequiredEnv } from '@/lib/config/runtimeEnv';

const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;
const KEYS = [
    'EMAIL_PROVIDER', 'EMAIL_DELIVERY_READY', 'EMAIL_FORCE_LIVE', 'VERCEL_ENV', 'RESEND_API_KEY',
    'MAILJET_API_KEY', 'MAILJET_SECRET_KEY', 'NOTIFICATION_FROM_EMAIL', 'APP_BASE_URL', 'NEXTAUTH_SECRET',
] as const;
const saved: Record<string, string | undefined> = {};
for (const k of KEYS) saved[k] = process.env[k];
const realFetch = globalThis.fetch;
const realError = console.error;
const realLog = console.log;

function setEnv(vars: Partial<Record<(typeof KEYS)[number], string>>) {
    for (const k of KEYS) delete process.env[k];
    Object.assign(process.env, vars);
}
afterEach(() => {
    for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    globalThis.fetch = realFetch;
    console.error = realError;
    console.log = realLog;
});

const live = { VERCEL_ENV: 'production', EMAIL_DELIVERY_READY: 'true', NOTIFICATION_FROM_EMAIL: 'FlightAgent <alerts@example.com>' };
const msg = { to: 'u@example.com', subject: 'Hi', html: '<p>x</p>', text: 'x' };

function stubFetch(status: number, body: unknown) {
    const calls: { url: string; init: RequestInit }[] = [];
    globalThis.fetch = (async (url: any, init: any) => {
        calls.push({ url: String(url), init });
        return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
    }) as typeof fetch;
    return calls;
}

test('provider selection: default resend, explicit values, invalid throws', () => {
    assert.equal(getEmailProvider(env({})), 'resend');
    assert.equal(getEmailProvider(env({ EMAIL_PROVIDER: '' })), 'resend');
    assert.equal(getEmailProvider(env({ EMAIL_PROVIDER: 'resend' })), 'resend');
    assert.equal(getEmailProvider(env({ EMAIL_PROVIDER: 'mailjet' })), 'mailjet');
    assert.throws(() => getEmailProvider(env({ EMAIL_PROVIDER: 'Mailjet' })), /EMAIL_PROVIDER "Mailjet" is invalid/);
    assert.deepEqual(requiredEnvForProvider('mailjet'), ['MAILJET_API_KEY', 'MAILJET_SECRET_KEY']);
    assert.deepEqual(requiredEnvForProvider('resend'), ['RESEND_API_KEY']);
});

test('fail-fast follows the provider: mailjet does not require RESEND_API_KEY', () => {
    setEnv({ ...live, EMAIL_PROVIDER: 'mailjet', APP_BASE_URL: 'https://x', NEXTAUTH_SECRET: 's' });
    const missing = getMissingRequiredEnv().filter((n) => /RESEND|MAILJET/.test(n));
    assert.deepEqual(missing, ['MAILJET_API_KEY', 'MAILJET_SECRET_KEY']);

    setEnv({ ...live, EMAIL_PROVIDER: 'resend', APP_BASE_URL: 'https://x', NEXTAUTH_SECRET: 's', MAILJET_API_KEY: 'a' });
    assert.deepEqual(getMissingRequiredEnv().filter((n) => /RESEND|MAILJET/.test(n)), ['RESEND_API_KEY']);

    setEnv({ ...live, EMAIL_PROVIDER: 'mailjet', MAILJET_API_KEY: 'a', MAILJET_SECRET_KEY: 'b', APP_BASE_URL: 'https://x', NEXTAUTH_SECRET: 's' });
    assert.deepEqual(getMissingRequiredEnv().filter((n) => /RESEND|MAILJET|EMAIL|NOTIFICATION/.test(n)), []);
});

test('fail-fast names a misspelled provider value', () => {
    setEnv({ ...live, EMAIL_PROVIDER: 'mailjett', APP_BASE_URL: 'https://x', NEXTAUTH_SECRET: 's' });
    assert.ok(getMissingRequiredEnv().some((n) => n.startsWith('EMAIL_PROVIDER') && n.includes('mailjett')));
});

for (const provider of ['resend', 'mailjet']) {
    test(`policy applies to ${provider}: preview/local/waitlist never reach the provider`, async () => {
        const calls = stubFetch(200, {});
        console.log = () => {};
        for (const vars of [
            { VERCEL_ENV: 'preview', EMAIL_DELIVERY_READY: 'true' },
            { VERCEL_ENV: 'production' },
            {},
        ]) {
            setEnv({ ...vars, EMAIL_PROVIDER: provider, RESEND_API_KEY: 'k', MAILJET_API_KEY: 'a', MAILJET_SECRET_KEY: 'b', NOTIFICATION_FROM_EMAIL: 'a@b.c' });
            const r = await deliverEmail('t', msg);
            assert.deepEqual(r, { success: true, mocked: true });
        }
        assert.equal(calls.length, 0);
    });
}

test('mailjet: sends v3.1 request with basic auth, parsed From, legal footer', async () => {
    setEnv({ ...live, EMAIL_PROVIDER: 'mailjet', MAILJET_API_KEY: 'key', MAILJET_SECRET_KEY: 'sec' });
    const calls = stubFetch(200, { Messages: [{ Status: 'success', To: [{ Email: 'u@example.com', MessageID: 123456 }] }] });
    const r = await deliverEmail('t', { ...msg, attachments: [{ filename: 'a.pdf', contentType: 'application/pdf', base64: 'QUJD' }] });
    assert.equal(r.success, true);
    assert.equal(r.mocked, false);
    assert.equal(r.messageId, '123456');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.mailjet.com/v3.1/send');
    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers.Authorization, `Basic ${Buffer.from('key:sec').toString('base64')}`);
    const m = JSON.parse(String(calls[0].init.body)).Messages[0];
    assert.deepEqual(m.From, { Email: 'alerts@example.com', Name: 'FlightAgent' });
    assert.deepEqual(m.To, [{ Email: 'u@example.com' }]);
    assert.equal(m.Subject, 'Hi');
    assert.match(m.HTMLPart, /data-legal-disclaimer/);
    assert.match(m.TextPart, /not legal advice/);
    assert.deepEqual(m.Attachments, [{ ContentType: 'application/pdf', Filename: 'a.pdf', Base64Content: 'QUJD' }]);
});

test('mailjet: rejection (HTTP 400 with Errors) is logged and returned as failure', async () => {
    setEnv({ ...live, EMAIL_PROVIDER: 'mailjet', MAILJET_API_KEY: 'key', MAILJET_SECRET_KEY: 'sec' });
    stubFetch(400, { Messages: [{ Status: 'error', Errors: [{ ErrorCode: 'mj-0013', ErrorMessage: 'Sender not validated' }] }] });
    const logged: string[] = [];
    console.error = (...a: unknown[]) => { logged.push(a.join(' ')); };
    const r = await deliverEmail('alert', msg);
    assert.equal(r.success, false);
    assert.equal(r.mocked, false);
    assert.match(r.error!, /Mailjet HTTP 400: mj-0013: Sender not validated/);
    assert.ok(logged.some((l) => l.includes('[Email:alert]') && l.includes('Sender not validated') && l.includes('u@example.com')));
});

test('mailjet: auth failure, 200-with-error status, non-JSON body, network error all fail', async () => {
    setEnv({ ...live, EMAIL_PROVIDER: 'mailjet', MAILJET_API_KEY: 'key', MAILJET_SECRET_KEY: 'sec' });
    console.error = () => {};

    stubFetch(401, { ErrorMessage: 'API key authentication/authorization failure', StatusCode: 401 });
    let r = await deliverEmail('t', msg);
    assert.equal(r.success, false);
    assert.match(r.error!, /HTTP 401: API key authentication/);

    stubFetch(200, { Messages: [{ Status: 'error', Errors: [{ ErrorMessage: 'bad recipient' }] }] });
    r = await deliverEmail('t', msg);
    assert.equal(r.success, false);
    assert.match(r.error!, /bad recipient/);

    stubFetch(502, '<html>Bad gateway</html>');
    r = await deliverEmail('t', msg);
    assert.equal(r.success, false);
    assert.match(r.error!, /HTTP 502: <html>Bad gateway/);

    globalThis.fetch = (async () => { throw new Error('socket hang up'); }) as typeof fetch;
    r = await deliverEmail('t', msg);
    assert.equal(r.success, false);
    assert.match(r.error!, /socket hang up/);
});

test('mailjet: missing credentials name the exact env vars; Resend key not needed', async () => {
    setEnv({ ...live, EMAIL_PROVIDER: 'mailjet', MAILJET_API_KEY: 'key' });
    const calls = stubFetch(200, {});
    const logged: string[] = [];
    console.error = (...a: unknown[]) => { logged.push(a.join(' ')); };
    const r = await deliverEmail('t', msg);
    assert.equal(r.success, false);
    assert.match(r.error!, /MAILJET_SECRET_KEY is not set/);
    assert.doesNotMatch(r.error!, /RESEND/);
    assert.equal(calls.length, 0);
    assert.ok(logged.length > 0);
});

test('resend selected without RESEND_API_KEY fails with its name (and never calls Mailjet)', async () => {
    setEnv({ ...live, EMAIL_PROVIDER: 'resend', MAILJET_API_KEY: 'a', MAILJET_SECRET_KEY: 'b' });
    const calls = stubFetch(200, {});
    console.error = () => {};
    const r = await deliverEmail('t', msg);
    assert.equal(r.success, false);
    assert.equal(r.error, 'RESEND_API_KEY is not set');
    assert.equal(calls.length, 0);
});

test('invalid EMAIL_PROVIDER at send time is a logged failure, not a silent fallback', async () => {
    setEnv({ ...live, EMAIL_PROVIDER: 'sendgrid', RESEND_API_KEY: 'k' });
    console.error = () => {};
    const r = await deliverEmail('t', msg);
    assert.equal(r.success, false);
    assert.match(r.error!, /EMAIL_PROVIDER "sendgrid" is invalid/);
});

test('notification provider surfaces a Mailjet rejection as a failed ChannelResponse (persisted by callers)', async () => {
    setEnv({ ...live, EMAIL_PROVIDER: 'mailjet', MAILJET_API_KEY: 'key', MAILJET_SECRET_KEY: 'sec' });
    stubFetch(400, { Messages: [{ Status: 'error', Errors: [{ ErrorMessage: 'Sender not validated' }] }] });
    console.error = () => {};
    const r = await new EmailDeliveryProvider().sendEmail({ to: 'u@example.com', subject: 's', text: 't' });
    assert.equal(r.success, false);
    assert.equal(r.channel, 'EMAIL');
    assert.match(r.error!, /Sender not validated/);
});

test('parseFromAddress handles bare, named and quoted senders', () => {
    assert.deepEqual(parseFromAddress('a@b.c'), { Email: 'a@b.c' });
    assert.deepEqual(parseFromAddress('Flight Agent <a@b.c>'), { Email: 'a@b.c', Name: 'Flight Agent' });
    assert.deepEqual(parseFromAddress('"Flight Agent" <a@b.c>'), { Email: 'a@b.c', Name: 'Flight Agent' });
    assert.deepEqual(parseFromAddress('<a@b.c>'), { Email: 'a@b.c' });
});

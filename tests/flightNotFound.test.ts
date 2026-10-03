import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { handleFlightNotFound, isFlightNotFound, type FlightNotFoundDeps } from '@/lib/guardian/flightNotFound';
import type { FlightLookupResult } from '@/lib/flightData/client';

// In-memory stand-in for the DB + email, mirroring the Prisma-backed deps.
function fakeWorld(initialStatus: string) {
    const state = {
        status: initialStatus,
        checks: [
            { id: 'c-dep', status: 'SCHEDULED' },
            { id: 'c-arr1', status: 'SCHEDULED' },
            { id: 'c-arr4', status: 'SCHEDULED' },
            { id: 'c-complete', status: 'SCHEDULED' },
            { id: 'c-current', status: 'SCHEDULED' }, // the checkpoint being processed
        ],
        alerts: [{ status: 'QUEUED' }, { status: 'RETRYING' }, { status: 'SENT' }],
        emails: [] as Array<{ email: string; flightNumber: string }>,
        emailError: null as string | null,
    };
    const deps: FlightNotFoundDeps = {
        async transitionToNotFound() {
            if (state.status !== 'ACTIVE') return false;
            state.status = 'FLIGHT_NOT_FOUND';
            return true;
        },
        async cancelRemainingChecks(_tripId, excludeCheckId) {
            let n = 0;
            for (const c of state.checks) if (c.status === 'SCHEDULED' && c.id !== excludeCheckId) { c.status = 'CANCELLED'; n++; }
            return n;
        },
        async suppressQueuedAlerts() {
            let n = 0;
            for (const a of state.alerts) if (a.status === 'QUEUED' || a.status === 'RETRYING') { a.status = 'SUPPRESSED'; n++; }
            return n;
        },
        async loadRecipient() {
            return { email: 'pax@example.test', flightNumber: 'XX404', flightDate: new Date('2026-10-07T00:00:00Z') };
        },
        async sendNotFoundEmail({ email, flightNumber }) {
            state.emails.push({ email, flightNumber });
            return { success: true };
        },
        async recordEmailError(_tripId, error) { state.emailError = error; },
    };
    return { state, deps };
}

test('isFlightNotFound: only a provider NOT_FOUND counts — not quota, HTTP or network errors', () => {
    const fail = (code: any): FlightLookupResult => ({ ok: false, code, message: 'x' });
    assert.equal(isFlightNotFound(fail('NOT_FOUND')), true);
    for (const code of ['QUOTA_BLOCKED', 'HTTP_ERROR', 'EXCEPTION', 'MISSING_CREDENTIALS', 'INVALID_FLIGHT_NUMBER']) {
        assert.equal(isFlightNotFound(fail(code)), false, code);
    }
    assert.equal(isFlightNotFound(null), false, 'per-trip cap reached (no lookup)');
    assert.equal(isFlightNotFound({ ok: true, flight: {} as any }), false);
});

test('scenario: ACTIVE trip whose flight does not exist, found at a checkpoint', async () => {
    const { state, deps } = fakeWorld('ACTIVE');
    const out = await handleFlightNotFound('trip-1', deps, { source: 'CHECKPOINT', excludeCheckId: 'c-current' });

    assert.equal(state.status, 'FLIGHT_NOT_FOUND');
    assert.equal(out.transitioned, true);
    // Every remaining checkpoint cancelled; the one being processed is left to the caller.
    assert.deepEqual(state.checks.map((c) => c.status), ['CANCELLED', 'CANCELLED', 'CANCELLED', 'CANCELLED', 'SCHEDULED']);
    assert.equal(out.cancelledChecks, 4);
    // No alert email goes out: queued/retrying deliveries are suppressed; sent history untouched.
    assert.deepEqual(state.alerts.map((a) => a.status), ['SUPPRESSED', 'SUPPRESSED', 'SENT']);
    // Exactly one "we couldn't find your flight" email.
    assert.deepEqual(state.emails, [{ email: 'pax@example.test', flightNumber: 'XX404' }]);
    assert.equal(out.emailSent, true);
});

test('only one not-found email even if a later checkpoint (or a retried delivery) hits it again', async () => {
    const { state, deps } = fakeWorld('ACTIVE');
    await handleFlightNotFound('trip-1', deps, { source: 'CHECKPOINT', excludeCheckId: 'c-current' });
    const second = await handleFlightNotFound('trip-1', deps, { source: 'CHECKPOINT' });
    assert.equal(second.transitioned, false);
    assert.equal(second.emailSent, false);
    assert.equal(state.emails.length, 1);
});

test('concurrent checks: the conditional transition lets only one of them send', async () => {
    const { state, deps } = fakeWorld('ACTIVE');
    const results = await Promise.all([
        handleFlightNotFound('trip-1', deps, { source: 'CHECKPOINT' }),
        handleFlightNotFound('trip-1', deps, { source: 'CHECKPOINT' }),
    ]);
    assert.equal(results.filter((r) => r.transitioned).length, 1);
    assert.equal(state.emails.length, 1);
});

test('same rule at opt-in (registration lookup)', async () => {
    const { state, deps } = fakeWorld('ACTIVE');
    const out = await handleFlightNotFound('trip-1', deps, { source: 'REGISTRATION' });
    assert.equal(state.status, 'FLIGHT_NOT_FOUND');
    assert.equal(out.cancelledChecks, 5, 'nothing is being processed at registration');
    assert.equal(state.emails.length, 1);
});

test('non-ACTIVE trips are left alone (no transition, no email)', async () => {
    for (const status of ['PENDING_CONFIRMATION', 'COMPLETED', 'CANCELLED', 'FLIGHT_NOT_FOUND']) {
        const { state, deps } = fakeWorld(status);
        const out = await handleFlightNotFound('trip-1', deps, { source: 'CHECKPOINT' });
        assert.equal(out.transitioned, false, status);
        assert.equal(state.status, status);
        assert.equal(state.emails.length, 0);
        assert.ok(state.checks.every((c) => c.status === 'SCHEDULED'));
    }
});

test('an email exception does not escape the handler; it is recorded on the trip', async () => {
    const { state, deps } = fakeWorld('ACTIVE');
    deps.sendNotFoundEmail = async () => { throw new Error('APP_BASE_URL is not set'); };
    const out = await handleFlightNotFound('trip-1', deps, { source: 'CHECKPOINT' });
    assert.equal(state.status, 'FLIGHT_NOT_FOUND');
    assert.equal(out.emailSent, false);
    assert.equal(state.emailError, 'APP_BASE_URL is not set');
});

test('a failed not-found email is recorded on the trip (status still changes, no retry spam)', async () => {
    const { state, deps } = fakeWorld('ACTIVE');
    deps.sendNotFoundEmail = async () => ({ success: false, error: 'provider down' });
    const out = await handleFlightNotFound('trip-1', deps, { source: 'CHECKPOINT' });
    assert.equal(state.status, 'FLIGHT_NOT_FOUND');
    assert.equal(out.emailSent, false);
    assert.equal(state.emailError, 'provider down');
});

test('mock provider: XX404 is a flight that does not exist → NOT_FOUND', async () => {
    const prev = { v: process.env.VERCEL_ENV, f: process.env.AERODATABOX_FORCE_LIVE };
    delete process.env.VERCEL_ENV;
    delete process.env.AERODATABOX_FORCE_LIVE;
    try {
        const { lookupFlight } = await import('@/lib/flightData/client');
        const missing = await lookupFlight('XX404', '2026-10-07', 'DEP');
        assert.equal(isFlightNotFound(missing), true);
        const existing = await lookupFlight('XX1180', '2026-10-07', 'DEP');
        assert.equal(existing.ok, true, 'other mock flights still resolve');
    } finally {
        if (prev.v !== undefined) process.env.VERCEL_ENV = prev.v;
        if (prev.f !== undefined) process.env.AERODATABOX_FORCE_LIVE = prev.f;
    }
});

test('wiring: checkpoint and registration paths handle NOT_FOUND before any alert logic', () => {
    const worker = readFileSync('workers/guardianWorker.ts', 'utf8');
    const fn = worker.slice(worker.indexOf('async function runLeasedCheck'));
    const nf = fn.indexOf('if (isFlightNotFound(result))');
    assert.ok(nf > 0, 'checkpoint path checks NOT_FOUND');
    assert.ok(nf < fn.indexOf('if (!result.ok)'), 'before the generic failure branch');
    assert.ok(nf < fn.indexOf('deriveAndDispatchEvents('), 'before any alert dispatch');
    assert.match(worker, /INACTIVE_TRIP_STATUSES = new Set\(\[[^\]]*'FLIGHT_NOT_FOUND'/);

    const lifecycle = readFileSync('lib/guardian/tripLifecycle.ts', 'utf8');
    const init = lifecycle.slice(lifecycle.indexOf('export async function initializeTripMonitoring'));
    const reg = init.indexOf('if (isFlightNotFound(result))');
    assert.ok(reg > 0 && reg < init.indexOf('replanTripChecks('), 'no checkpoints are planned for a missing flight');
});

test('not-found email: month-name date, mocked outside production', async () => {
    const { sendFlightNotFoundEmail } = await import('@/lib/email/sender');
    const res = await sendFlightNotFoundEmail('pax@example.test', 'XX404', new Date('2026-10-07T00:00:00Z'), 'trip-1');
    assert.equal(res.mocked, true);
    const src = readFileSync('lib/email/sender.ts', 'utf8');
    assert.match(src, /month: 'short'/);
    assert.equal(new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date('2026-10-07T00:00:00Z')), '7 Oct 2026');
});

test('UI explains FLIGHT_NOT_FOUND (en/de/tr) instead of showing the raw status', () => {
    for (const l of ['en', 'de', 'tr']) {
        const m = JSON.parse(readFileSync(`messages/${l}.json`, 'utf8'));
        assert.ok(m.TripDisplay?.status?.FLIGHT_NOT_FOUND, `${l} status label`);
        assert.ok(m.GuardianTripDetails.flightNotFound?.title && m.GuardianTripDetails.flightNotFound?.text, `${l} trip notice`);
    }
    assert.match(readFileSync('components/dashboard/DashboardClient.tsx', 'utf8'), /tripStatusLabelKey\(trip\.status\)/);
    assert.match(readFileSync('app/[locale]/dashboard/guardian/[id]/TripDetailsClient.tsx', 'utf8'), /trip\.status === 'FLIGHT_NOT_FOUND'/);
});

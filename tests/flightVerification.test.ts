import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    VERIFY_DAYS_BEFORE,
    deferVerification,
    notFoundDecision,
    verificationCheck,
    verificationRetry,
    verifyCheckOutcome,
    type PendingVerificationDeps,
} from '@/lib/guardian/flightVerification';
import { MAX_DAYS_AHEAD, validateFlightDate } from '@/lib/flights/flightDateRule';
import { routeText, tripStatusLabelKey, TRIP_STATUS_LABEL_KEYS } from '@/lib/guardian/tripDisplay';
import { isCheckAllowed, MAX_CALLS_PER_TRIP } from '@/lib/flightData/quotaPolicy';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-04T12:00:00Z');
const at = (days: number) => new Date(NOW.getTime() + days * DAY);

// ── 7-day rule ──────────────────────────────────────────────────────────────

test('NOT_FOUND is definitive only ≤ 7 days before departure', () => {
    assert.equal(VERIFY_DAYS_BEFORE, 7);
    assert.equal(notFoundDecision(at(1), NOW), 'DEFINITE');
    assert.equal(notFoundDecision(at(7), NOW), 'DEFINITE', 'exactly 7 days is definitive');
    assert.equal(notFoundDecision(new Date(at(7).getTime() + 60_000), NOW), 'DEFER', '7 days + 1 minute defers');
    assert.equal(notFoundDecision(at(60), NOW), 'DEFER');
    assert.equal(notFoundDecision(at(-1), NOW), 'DEFINITE', 'departure already passed');
});

test('verification checkpoint is at departure −7 days (never in the past)', () => {
    const c = verificationCheck(at(30), NOW);
    assert.equal(c.kind, 'VERIFY_FLIGHT');
    assert.equal(c.runAt.toISOString(), at(23).toISOString());
    assert.equal(verificationCheck(at(5), NOW).runAt.toISOString(), NOW.toISOString());
});

function fakeWorld(status: string) {
    const state = {
        status,
        checks: [{ id: 'reg-plan-1', status: 'SCHEDULED', kind: 'DEP' }] as Array<{ id: string; status: string; kind: string; runAt?: Date }>,
        emails: 0,
    };
    const deps: PendingVerificationDeps = {
        async transitionToPending() {
            if (state.status !== 'ACTIVE') return false;
            state.status = 'PENDING_VERIFICATION';
            return true;
        },
        async cancelRemainingChecks(_t, exclude) {
            let n = 0;
            for (const c of state.checks) if (c.status === 'SCHEDULED' && c.id !== exclude) { c.status = 'CANCELLED'; n++; }
            return n;
        },
        async scheduleChecks(_t, checks) {
            for (const c of checks) state.checks.push({ id: `new-${state.checks.length}`, status: 'SCHEDULED', kind: c.kind, runAt: c.runAt });
        },
    };
    return { state, deps };
}

test('far date + NOT_FOUND (e.g. at verify): PENDING_VERIFICATION, one −7 day check, NO email', async () => {
    const { state, deps } = fakeWorld('ACTIVE');
    const departure = at(45);
    assert.equal(notFoundDecision(departure, NOW), 'DEFER');
    const res = await deferVerification('trip-1', departure, NOW, deps);

    assert.equal(res.transitioned, true);
    assert.equal(state.status, 'PENDING_VERIFICATION');
    const scheduled = state.checks.filter((c) => c.status === 'SCHEDULED');
    assert.equal(scheduled.length, 1, 'exactly one checkpoint left');
    assert.equal(scheduled[0].kind, 'VERIFY_FLIGHT');
    assert.equal(scheduled[0].runAt!.toISOString(), at(38).toISOString());
    // The deps have no email capability at all: deferring can't send anything.
    assert.ok(!('sendNotFoundEmail' in deps));
    assert.equal(state.emails, 0);
});

test('deferring again does nothing (no duplicate verification check)', async () => {
    const { state, deps } = fakeWorld('ACTIVE');
    await deferVerification('trip-1', at(45), NOW, deps);
    const again = await deferVerification('trip-1', at(45), NOW, deps);
    assert.equal(again.transitioned, false);
    assert.equal(state.checks.filter((c) => c.kind === 'VERIFY_FLIGHT').length, 1);
});

// ── −7 day checkpoint ───────────────────────────────────────────────────────

test('−7 day checkpoint, flight found → ACTIVE with the normal plan', () => {
    assert.deepEqual(verifyCheckOutcome({ ok: true }, at(7), NOW), { action: 'ACTIVATE' });
});

test('−7 day checkpoint, still not found → definitive FLIGHT_NOT_FOUND flow', () => {
    assert.deepEqual(verifyCheckOutcome({ ok: false, code: 'NOT_FOUND' }, at(7), NOW), { action: 'NOT_FOUND' });
    // …and that is definitive under the 7-day rule (one email in the not-found flow).
    assert.equal(notFoundDecision(at(7), NOW), 'DEFINITE');
});

test('−7 day checkpoint without a verdict retries in 12 h, then monitors approximately', () => {
    const quota = verifyCheckOutcome({ ok: false, code: 'QUOTA_BLOCKED' }, at(7), NOW);
    assert.equal(quota.action, 'RETRY');
    if (quota.action === 'RETRY') assert.equal(quota.check.runAt.getTime() - NOW.getTime(), 12 * 60 * 60 * 1000);
    assert.equal(verifyCheckOutcome({ ok: false, code: 'HTTP_ERROR' }, new Date(NOW.getTime() + 6 * 3600_000), NOW).action, 'ACTIVATE_APPROXIMATE');
    assert.equal(verifyCheckOutcome(null, at(7), NOW).action, 'ACTIVATE_APPROXIMATE', 'call cap reached');
    assert.equal(verificationRetry(new Date(NOW.getTime() + 3600_000), NOW), null);
});

test('VERIFY_FLIGHT runs even at CRITICAL quota; per-trip cap fits registration + verify + plan + extra', () => {
    assert.equal(isCheckAllowed('VERIFY_FLIGHT', 'CRITICAL'), true);
    assert.equal(isCheckAllowed('VERIFY_FLIGHT', 'EXHAUSTED'), false);
    assert.equal(MAX_CALLS_PER_TRIP, 1 + 1 + 5 + 1);
});

test('wiring: registration and checkpoints route NOT_FOUND through the 7-day rule', () => {
    const lifecycle = readFileSync('lib/guardian/tripLifecycle.ts', 'utf8');
    const route = lifecycle.slice(lifecycle.indexOf('export async function routeFlightNotFound'));
    assert.ok(route.indexOf("notFoundDecision(departureUtc, now) === 'DEFER'") < route.indexOf('handleFlightNotFound('));
    const init = lifecycle.slice(lifecycle.indexOf('export async function initializeTripMonitoring'));
    assert.match(init, /routeFlightNotFound\(tripId, segment, now, \{ source: 'REGISTRATION' \}\)/);

    const worker = readFileSync('workers/guardianWorker.ts', 'utf8');
    assert.match(worker, /trip\.status === 'PENDING_VERIFICATION' && kind !== 'VERIFY_FLIGHT'/);
    assert.match(worker, /verifyCheckOutcome\(result,/);
    assert.ok(!/handleFlightNotFound\(/.test(worker.slice(worker.indexOf('async function runLeasedCheck'))), 'worker never bypasses the 7-day rule');
    assert.match(readFileSync('lib/guardian/flightNotFound.ts', 'utf8'), /status: \{ in: \['ACTIVE', 'PENDING_VERIFICATION'\] \}/);
});

// ── Form date rule (no API call) ───────────────────────────────────────────

test('form date: past and > 330 days are rejected with their own codes', () => {
    assert.equal(MAX_DAYS_AHEAD, 330);
    const ymd = (d: Date) => d.toISOString().slice(0, 10);
    assert.deepEqual(validateFlightDate(ymd(at(0)), NOW).ok, true, 'today');
    assert.equal(validateFlightDate(ymd(at(-1)), NOW).ok, true, 'yesterday: one day of timezone slack');
    assert.deepEqual(validateFlightDate(ymd(at(-2)), NOW), { ok: false, code: 'DATE_PAST' });
    assert.equal(validateFlightDate(ymd(at(330)), NOW).ok, true, 'day 330 allowed');
    assert.deepEqual(validateFlightDate(ymd(at(331)), NOW), { ok: false, code: 'DATE_TOO_FAR' });
    assert.deepEqual(validateFlightDate('2026-02-30', NOW), { ok: false, code: 'INVALID_DATE' });
    assert.deepEqual(validateFlightDate('10/07/2026', NOW), { ok: false, code: 'INVALID_DATE' });
    assert.deepEqual(validateFlightDate('', NOW), { ok: false, code: 'INVALID_DATE' });
});

test('form + API share the rule and return field-specific errors (en/de/tr)', () => {
    const form = readFileSync('components/home/HeroSearchForm.tsx', 'utf8');
    assert.match(form, /validateFlightDate\(value\)/);
    assert.match(form, /DATE_TOO_FAR: \{ field: 'date'/);
    const api = readFileSync('app/api/trips/track/route.ts', 'utf8');
    assert.match(api, /fieldError\('date', dateCheck\.code/);
    assert.match(api, /fieldError\('flightNumber', 'INVALID_FLIGHT'/);
    for (const l of ['en', 'de', 'tr']) {
        const e = JSON.parse(readFileSync(`messages/${l}.json`, 'utf8')).HomePage.guardian.heroForm.errors;
        assert.ok(e.datePast && e.dateTooFar && e.invalidDate, l);
    }
});

// ── Dashboard wording ───────────────────────────────────────────────────────

test('human-readable status labels for every status in en/de/tr', () => {
    const tr = JSON.parse(readFileSync('messages/tr.json', 'utf8')).TripDisplay;
    assert.equal(tr.status.PENDING_VERIFICATION, 'Uçuş tarihi yaklaşınca doğrulanacak');
    assert.equal(tr.routeVerifying, 'Rota doğrulanıyor');
    for (const l of ['en', 'de', 'tr']) {
        const d = JSON.parse(readFileSync(`messages/${l}.json`, 'utf8')).TripDisplay;
        for (const k of [...TRIP_STATUS_LABEL_KEYS, 'UNKNOWN']) assert.ok(d.status[k], `${l}.${k}`);
        assert.ok(d.routeVerifying, l);
    }
    // Every enum value in the schema has a label.
    const schema = readFileSync('prisma/schema.prisma', 'utf8');
    const enumBody = schema.slice(schema.indexOf('enum TripStatus {'), schema.indexOf('}', schema.indexOf('enum TripStatus {')));
    const values = [...enumBody.matchAll(/^\s+([A-Z_]+)\b/gm)].map((m) => m[1]);
    for (const v of values) assert.notEqual(tripStatusLabelKey(v), 'UNKNOWN', `label for ${v}`);
    assert.equal(tripStatusLabelKey('SOMETHING_NEW'), 'UNKNOWN');
});

test('route: "UNK → UNK" is never shown', () => {
    assert.equal(routeText('UNK', 'UNK'), null);
    assert.equal(routeText('CDG', 'UNK'), null);
    assert.equal(routeText('', 'JFK'), null);
    assert.equal(routeText(null, 'JFK'), null);
    assert.equal(routeText('CDG', 'JFK'), 'CDG → JFK');
    assert.equal(routeText('CDG', 'JFK', '➝'), 'CDG ➝ JFK');
});

test('schema SQL: two separate ADD VALUE statements, nothing else', () => {
    const sql = readFileSync('docs/phase2_schema_flight_not_found.sql', 'utf8')
        .split('\n').filter((l) => !l.startsWith('--')).join('\n').split(';').map((s) => s.trim()).filter(Boolean);
    assert.deepEqual(sql, [
        `ALTER TYPE "TripStatus" ADD VALUE 'FLIGHT_NOT_FOUND'`,
        `ALTER TYPE "TripStatus" ADD VALUE 'PENDING_VERIFICATION'`,
    ]);
});

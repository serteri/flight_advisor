import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runFormLookup, type FormLookupDeps, type LookupCacheEntry } from '../lib/flightData/formLookup';
import type { FlightLegOption } from '../lib/flightData/legs';
import { normalizePnr, resolveMonitorSelection } from '../lib/guardian/monitorSelection';
import { ADD_TRIP_ERRORS, classifyLookupResponse, classifySaveResponse } from '../lib/guardian/addTripErrors';
import { pnrLabel, routeVerifyingApplies, splitTrips } from '../lib/guardian/tripBuckets';
import { MAX_DAYS_AHEAD } from '../lib/flights/flightDateRule';

const modal = readFileSync('components/dashboard/AddTripModal.tsx', 'utf8');
const monitorRoute = readFileSync('app/api/trips/monitor/route.ts', 'utf8');

const leg = (over: Partial<FlightLegOption> = {}): FlightLegOption => ({
    key: 'BNE-SYD-2026-10-15T08:15:00.000Z',
    origin: { iata: 'BNE', name: 'Brisbane', city: 'Brisbane', timeZone: 'Australia/Brisbane' },
    destination: { iata: 'SYD', name: 'Sydney', city: 'Sydney', timeZone: 'Australia/Sydney' },
    departureLocal: '2026-10-15T18:15', arrivalLocal: '2026-10-15T20:50',
    departureUtc: '2026-10-15T08:15:00.000Z', arrivalUtc: '2026-10-15T09:50:00.000Z',
    airlineCode: 'QF', airlineName: 'Qantas', ...over,
});
const DATE = '2026-10-15';
const NOW = new Date('2026-10-14T00:00:00Z');
const fresh = (over: Partial<LookupCacheEntry> = {}): LookupCacheEntry => ({ outcome: 'FOUND', options: [leg()], fetchedAt: new Date(NOW.getTime() - 60_000), ...over });
const select = (cache: LookupCacheEntry | null, legKey?: string | null) =>
    resolveMonitorSelection({ cache, date: DATE, departureDate: new Date(`${DATE}T00:00:00Z`), legKey, now: NOW });

test('AddTripModal uses the shared /api/flights/lookup, not verify-schedule', () => {
    assert.match(modal, /\/api\/flights\/lookup/);
    assert.doesNotMatch(modal, /verify-schedule/);
});

test('AddTripModal has no native alert()', () => {
    assert.doesNotMatch(modal, /\balert\s*\(/);
    assert.doesNotMatch(modal, /window\.alert/);
    assert.match(modal, /role="alert"/);
});

test('AddTripModal button states and retained input', () => {
    assert.match(modal, /Finding flight…/);
    assert.match(modal, /Starting monitoring…/);
    assert.match(modal, /disabled=\{saving \|\| !selectedKey\}/);
    assert.doesNotMatch(modal, /setFlightNo\(''\)|setDate\(''\)|setPnr\(''\)/);
});

test('free limit (402) goes to UpgradePrompt with the Free-plan sentence', () => {
    assert.match(modal, /<UpgradePrompt/);
    assert.deepEqual(classifySaveResponse(402, { feature: 'monitored_trip', current: 1, limit: 1 }), { kind: 'LIMIT', feature: 'monitored_trip', current: 1, limit: 1 });
    assert.match(modal, /FREE_PLAN_LIMIT_NOTE/);
});

test('error copy: format, date, not found, rate limit, network, provider, save', () => {
    assert.equal(ADD_TRIP_ERRORS.INVALID_FLIGHT_FORMAT.message, 'Enter a valid flight number, for example QF549.');
    assert.equal(ADD_TRIP_ERRORS.INVALID_DATE.title, 'Check the flight date');
    assert.equal(ADD_TRIP_ERRORS.DATE_PAST.title, 'This flight date has passed');
    assert.ok(ADD_TRIP_ERRORS.DATE_TOO_FAR.note?.includes(String(MAX_DAYS_AHEAD)));
    assert.equal(ADD_TRIP_ERRORS.FLIGHT_NOT_FOUND.title, "We couldn't find this flight");
    assert.equal(ADD_TRIP_ERRORS.NETWORK_ERROR.title, 'Connection problem');
    assert.equal(ADD_TRIP_ERRORS.SAVE_FAILED.title, "We couldn't add this trip");
    assert.doesNotMatch(JSON.stringify(ADD_TRIP_ERRORS.RATE_LIMITED), /\d/); // no thresholds exposed
    assert.doesNotMatch(modal, /System error|Something went wrong/);
});

test('lookup responses map to the right inline error', () => {
    assert.deepEqual(classifyLookupResponse(400, { code: 'INVALID_FLIGHT' }), { kind: 'ERROR', code: 'INVALID_FLIGHT_FORMAT' });
    assert.deepEqual(classifyLookupResponse(400, { code: 'DATE_PAST' }), { kind: 'ERROR', code: 'DATE_PAST' });
    assert.deepEqual(classifyLookupResponse(400, { code: 'DATE_TOO_FAR' }), { kind: 'ERROR', code: 'DATE_TOO_FAR' });
    assert.deepEqual(classifyLookupResponse(200, { status: 'NOT_FOUND', blocking: true }), { kind: 'ERROR', code: 'FLIGHT_NOT_FOUND' });
    assert.deepEqual(classifyLookupResponse(429, { status: 'RATE_LIMITED' }), { kind: 'ERROR', code: 'RATE_LIMITED' });
});

test('provider unavailable / skipped is never "flight not found"', () => {
    const cases: Array<[number, unknown]> = [
        [200, { status: 'SKIPPED', reason: 'UNAVAILABLE' }],
        [200, { status: 'SKIPPED', reason: 'QUOTA' }],
        [500, null],
        [200, {}],
    ];
    for (const [status, body] of cases) {
        assert.deepEqual(classifyLookupResponse(status, body), { kind: 'ERROR', code: 'PROVIDER_UNAVAILABLE' });
    }
});

test('FOUND: one card and several selectable legs come through intact', () => {
    const one = classifyLookupResponse(200, { status: 'FOUND', options: [leg()] });
    assert.equal(one.kind === 'FOUND' && one.options.length, 1);
    const two = classifyLookupResponse(200, { status: 'FOUND', options: [leg(), leg({ key: 'SYD-MEL-x' })] });
    assert.equal(two.kind === 'FOUND' && two.options.length, 2);
    assert.match(modal, /role="radio"/);
    assert.match(modal, /setSelectedKey\(outcome\.options\.length === 1/); // several: nothing preselected
});

test('save sends only flightNumber, date, legKey, pnr; server ignores client route/times', () => {
    const body = modal.slice(modal.indexOf("'/api/trips/monitor'"), modal.indexOf('classifySaveResponse(res.status'));
    assert.match(body, /legKey: selectedKey/);
    assert.doesNotMatch(body, /origin|destination|departureTime|arrivalTime|scheduled/);
    assert.doesNotMatch(monitorRoute, /body\.(origin|destination|departureTime|arrivalTime|scheduled\w*|flightData|airlineCode)/);
    assert.match(monitorRoute, /resolveMonitorSelection/);
    assert.match(monitorRoute, /withFreemiumGate\(userId, 'monitored_trip'/);
});

test('server-verified selection: route and times come from the cache', () => {
    const r = select(fresh(), leg().key);
    assert.ok(r.ok);
    if (r.ok) {
        assert.equal(r.segment.origin, 'BNE');
        assert.equal(r.segment.destination, 'SYD');
        assert.equal(r.segment.scheduledDepartureUtc?.toISOString(), '2026-10-15T08:15:00.000Z');
    }
});

test('invalid, missing, stale or foreign legKey fails safely', () => {
    assert.deepEqual(select(fresh(), 'XXX-YYY'), { ok: false, code: 'INVALID_SEGMENT' });
    assert.deepEqual(select(fresh(), null), { ok: false, code: 'INVALID_SEGMENT' });
    assert.deepEqual(select(null, leg().key), { ok: false, code: 'INVALID_SEGMENT' });
    assert.deepEqual(select(fresh({ fetchedAt: new Date(NOW.getTime() - 7 * 3600_000) }), leg().key), { ok: false, code: 'INVALID_SEGMENT' });
    assert.deepEqual(select(fresh({ outcome: 'NOT_FOUND', options: [] }), leg().key), { ok: false, code: 'FLIGHT_NOT_FOUND' });
    const noAirport = leg({ origin: { iata: null, name: null, city: null, timeZone: null } });
    assert.deepEqual(select(fresh({ options: [noAirport] }), noAirport.key), { ok: false, code: 'INVALID_SEGMENT' });
});

test('save responses: success, stale selection, bad PNR, generic failure', () => {
    assert.deepEqual(classifySaveResponse(200, { success: true, tripId: 't1' }), { kind: 'OK', tripId: 't1' });
    assert.deepEqual(classifySaveResponse(400, { code: 'INVALID_SEGMENT' }), { kind: 'ERROR', code: 'INVALID_SEGMENT' });
    assert.deepEqual(classifySaveResponse(400, { code: 'INVALID_PNR' }), { kind: 'ERROR', code: 'INVALID_PNR' });
    assert.deepEqual(classifySaveResponse(500, null), { kind: 'ERROR', code: 'SAVE_FAILED' });
    assert.match(modal, /ADD_TRIP_SUCCESS\.title/);
});

test('PNR normalisation', () => {
    assert.equal(normalizePnr(undefined), null);
    assert.equal(normalizePnr('  '), null);
    assert.equal(normalizePnr(' abc123 '), 'ABC123');
    assert.equal(normalizePnr('<script>'), 'INVALID');
    assert.equal(normalizePnr(123), 'INVALID');
});

test('home and dashboard see the same QF549 2026-10-15 result from the one lookup source', async () => {
    const store = new Map<string, LookupCacheEntry>();
    let providerCalls = 0;
    const deps: FormLookupDeps = {
        countRecentAttempts: async () => 0,
        recordAttempt: async () => undefined,
        getCache: async (f, d) => store.get(`${f}|${d}`) ?? null,
        putCache: async (f, d, e) => { store.set(`${f}|${d}`, e); },
        lookupLegs: async () => { providerCalls++; return { ok: true, legs: [leg()] } as never; },
    };
    // Home form: first lookup hits the provider and fills FlightLookupCache.
    const home = await runFormLookup({ flightNumber: 'QF549', date: DATE, ipHash: 'h', now: NOW }, deps);
    // Dashboard: same function behind the same endpoint, answered from the same cache.
    const dash = await runFormLookup({ flightNumber: 'QF549', date: DATE, ipHash: 'h2', now: NOW }, deps);
    assert.equal(home.status, 'FOUND');
    assert.equal(dash.status, 'FOUND');
    if (home.status === 'FOUND' && dash.status === 'FOUND') assert.deepEqual(dash.options, home.options);
    assert.equal(providerCalls, 1);
    const saved = select(store.get(`QF549|${DATE}`) ?? null, leg().key);
    assert.ok(saved.ok);
});

test('current trips exclude history and the count equals the rendered list', () => {
    const trips = [
        { id: 1, status: 'ACTIVE' }, { id: 2, status: 'COMPLETED' }, { id: 3, status: 'FLIGHT_NOT_FOUND' },
        { id: 4, status: 'ARCHIVED' }, { id: 5, status: 'PENDING_VERIFICATION' }, { id: 6, status: 'CANCELLED' },
    ];
    const { current, history } = splitTrips(trips);
    assert.deepEqual(current.map((t) => t.id), [1, 5]);
    assert.deepEqual(history.map((t) => t.id), [2, 3, 4, 6]);
    assert.equal(current.length + history.length, trips.length);
    const client = readFileSync('components/dashboard/DashboardClient.tsx', 'utf8');
    assert.match(client, /currentTrips\.map\(/);
    assert.doesNotMatch(client, /\btrips\.map\(/);
});

test('a completed record never says "Route being verified"; empty PNR renders nothing', () => {
    assert.equal(routeVerifyingApplies('COMPLETED'), false);
    assert.equal(routeVerifyingApplies('FLIGHT_NOT_FOUND'), false);
    assert.equal(routeVerifyingApplies('PENDING_VERIFICATION'), true);
    for (const empty of [null, undefined, '', '  ', '-', '•', 'null', 'undefined']) assert.equal(pnrLabel(empty), null);
    assert.equal(pnrLabel('ABC123'), 'ABC123');
    const client = readFileSync('components/dashboard/DashboardClient.tsx', 'utf8');
    assert.match(client, /routeVerifyingApplies\(trip\.status\)/);
    assert.doesNotMatch(client, /trip\.pnr \|\| '-'/);
});

test('status labels match the intended wording', () => {
    const en = JSON.parse(readFileSync('messages/en.json', 'utf8')).TripDisplay.status;
    assert.equal(en.ACTIVE, 'Monitoring active');
    assert.equal(en.PENDING_VERIFICATION, 'Flight being verified');
    assert.equal(en.PENDING_CONFIRMATION, 'Waiting for confirmation');
    assert.equal(en.COMPLETED, 'Monitoring completed');
    assert.equal(en.FLIGHT_NOT_FOUND, 'Flight not found');
    assert.equal(en.ARCHIVED, 'Archived');
});

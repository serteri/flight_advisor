import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    LOOKUP_CACHE_TTL_MS,
    LOOKUP_LIMIT_PER_IP,
    resolveFlightSelection,
    runFormLookup,
    type FormLookupDeps,
    type LookupCacheEntry,
} from '@/lib/flightData/formLookup';
import { parseLegs, type FlightLegOption } from '@/lib/flightData/legs';
import { getMockAeroDataBoxPayload } from '@/lib/flightData/mock';
import { LegMismatchError, parseAeroDataBoxResponse } from '@/lib/flightData/aerodatabox';
import type { FlightLegsResult } from '@/lib/flightData/client';
import { estimateMonthlyCalls, getMonthlyCallCapacity, getQuotaConfig, isCheckAllowed } from '@/lib/flightData/quotaPolicy';
import { airlineDisplayName, formatLocalDateTime } from '@/lib/flights/legFormat';
import { submitGate } from '@/lib/flights/lookupFormState';
import { skipRegistrationLookup, verifiedSegmentData } from '@/lib/guardian/verifiedFlight';
import { compensationInputFromTrip, evaluateTripCompensation } from '@/lib/compensation/tripCompensation';
import { hashRequestIp } from '@/lib/guardian/trackRateLimit';

const realWarn = console.warn;
const realError = console.error;
afterEach(() => { console.warn = realWarn; console.error = realError; });

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = new Date('2026-10-05T10:00:00Z');
const dayFromNow = (days: number) => new Date(NOW.getTime() + days * DAY).toISOString().slice(0, 10);

// Provider stand-in that answers from the mock scenarios, like dev/preview do.
function mockLegs(flightNumber: string, date: string): FlightLegsResult {
    const legs = parseLegs(getMockAeroDataBoxPayload(flightNumber, date));
    return legs.length ? { ok: true, legs } : { ok: false, code: 'NOT_FOUND', message: 'none' };
}

function makeDeps(over: Partial<FormLookupDeps> = {}) {
    const cache = new Map<string, LookupCacheEntry>();
    const attempts: { ipHash: string; at: Date }[] = [];
    const calls: string[] = [];
    const deps: FormLookupDeps = {
        countRecentAttempts: async (ip, since) => attempts.filter((a) => a.ipHash === ip && a.at >= since).length,
        recordAttempt: async (ipHash, at) => { attempts.push({ ipHash, at }); },
        getCache: async (f, d) => cache.get(`${f}|${d}`) ?? null,
        putCache: async (f, d, e) => { cache.set(`${f}|${d}`, e); },
        lookupLegs: async (f, d) => { calls.push(`${f}|${d}`); return mockLegs(f, d); },
        ...over,
    };
    return { deps, cache, attempts, calls };
}

// ── found ───────────────────────────────────────────────────────────────────

test('found: one leg, route + local times + airline come from the provider, nothing from the user', async () => {
    const date = dayFromNow(20);
    const { deps, calls, cache } = makeDeps();
    const r = await runFormLookup({ flightNumber: 'XX1000', date, ipHash: 'ip1', now: NOW }, deps);
    assert.equal(r.status, 'FOUND');
    if (r.status !== 'FOUND') return;
    assert.equal(r.cached, false);
    assert.equal(r.options.length, 1);
    const [leg] = r.options;
    assert.deepEqual([leg.origin.iata, leg.destination.iata], ['FRA', 'MAD']);
    assert.equal(formatLocalDateTime(leg.departureLocal), `${Number(date.slice(8))} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}, 09:00`);
    assert.equal(leg.departureUtc?.endsWith('Z'), true);
    assert.equal(calls.length, 1);
    assert.equal(cache.size, 1, 'result cached');
});

test('found: single leg is used by the server without a key; the form still asks "This is my flight"', async () => {
    const date = dayFromNow(20);
    const { deps, cache } = makeDeps();
    await runFormLookup({ flightNumber: 'XX1000', date, ipHash: null, now: NOW }, deps);
    const sel = resolveFlightSelection({ cache: cache.get(`XX1000|${date}`)!, date, now: NOW });
    assert.equal(sel.action, 'VERIFIED');
    // client gate: found + not confirmed → blocked
    const state = { kind: 'found' as const, options: parseLegs(getMockAeroDataBoxPayload('XX1000', date)) };
    assert.equal(submitGate(state, null), 'CONFIRM_FLIGHT');
    assert.equal(submitGate(state, state.options[0].key), null);
});

// ── several segments ────────────────────────────────────────────────────────

test('several segments: all legs, codeshare repeat removed, local times per airport, ordered', async () => {
    const date = '2026-10-15';
    const { deps } = makeDeps();
    const r = await runFormLookup({ flightNumber: 'XX2020', date, ipHash: null, now: NOW }, deps);
    assert.equal(r.status, 'FOUND');
    if (r.status !== 'FOUND') return;
    assert.equal(r.options.length, 2, 'the IsCodeshared repeat of IST→FRA is not a third option');
    const [a, b] = r.options;
    assert.deepEqual([a.origin.iata, a.destination.iata], ['IST', 'FRA']);
    assert.deepEqual([b.origin.iata, b.destination.iata], ['FRA', 'JFK']);
    // Airport-local wall clocks, month as a name — not UTC.
    assert.equal(formatLocalDateTime(a.departureLocal), '15 Oct 2026, 10:50');   // Istanbul (UTC+3); UTC would be 07:50
    assert.equal(formatLocalDateTime(a.arrivalLocal), '15 Oct 2026, 12:40');     // Frankfurt (UTC+1)
    assert.equal(formatLocalDateTime(b.departureLocal), '15 Oct 2026, 13:35');
    assert.equal(formatLocalDateTime(b.arrivalLocal), '15 Oct 2026, 16:20');     // New York (UTC−5); UTC would be 21:20
    assert.equal(a.airlineCode, 'XX');
});

test('several segments: choosing one is required; the chosen leg is what gets saved', async () => {
    const date = '2026-10-15';
    const { deps, cache } = makeDeps();
    const r = await runFormLookup({ flightNumber: 'XX2020', date, ipHash: null, now: NOW }, deps);
    if (r.status !== 'FOUND') throw new Error('expected FOUND');
    const entry = cache.get(`XX2020|${date}`)!;
    const [ist, jfk] = r.options;

    // client: no choice → blocked; with a choice → free
    const state = { kind: 'found' as const, options: r.options };
    assert.equal(submitGate(state, null), 'SELECT_SEGMENT');
    assert.equal(submitGate(state, 'FRA-ZZZ-nonsense'), 'SELECT_SEGMENT');
    assert.equal(submitGate(state, jfk.key), null);

    // server: no key → blocked, stale key → blocked, valid key → that leg
    assert.deepEqual(resolveFlightSelection({ cache: entry, date, legKey: null, now: NOW }), { action: 'BLOCK', code: 'SEGMENT_REQUIRED' });
    assert.deepEqual(resolveFlightSelection({ cache: entry, date, legKey: 'nope', now: NOW }), { action: 'BLOCK', code: 'INVALID_SEGMENT' });
    const picked = resolveFlightSelection({ cache: entry, date, legKey: jfk.key, now: NOW });
    assert.equal(picked.action, 'VERIFIED');
    if (picked.action !== 'VERIFIED') return;
    const seg = verifiedSegmentData(picked.leg, new Date(`${date}T00:00:00Z`))!;
    assert.deepEqual([seg.origin, seg.destination], ['FRA', 'JFK']);
    assert.equal(seg.scheduledDepartureUtc?.toISOString(), '2026-10-15T12:35:00.000Z');
    assert.notEqual(ist.key, jfk.key);
});

test('EU261 uses the chosen segment\'s route: FRA→JFK (EU departure) vs IST→FRA (non-EU carrier into the EU)', () => {
    const date = '2026-10-15';
    const [ist, jfk] = parseLegs(getMockAeroDataBoxPayload('XX2020', date));
    const tripFor = (leg: FlightLegOption) => {
        const seg = verifiedSegmentData(leg, new Date(`${date}T00:00:00Z`))!;
        return { segments: [{ airlineCode: 'TK', origin: seg.origin, destination: seg.destination, scheduledDepartureUtc: seg.scheduledDepartureUtc }], snapshot: { status: 'DELAYED', delayMinutes: 240 } };
    };
    assert.equal(compensationInputFromTrip(tripFor(jfk))!.originIata, 'FRA');
    assert.equal(compensationInputFromTrip(tripFor(jfk))!.finalDestinationIata, 'JFK');
    assert.equal(compensationInputFromTrip(tripFor(ist))!.originIata, 'IST');
    const onJfk = evaluateTripCompensation(tripFor(jfk));
    const onIst = evaluateTripCompensation(tripFor(ist));
    assert.equal(onJfk.regime, 'EU261');
    assert.notEqual(onIst.regime, 'EU261', 'a Turkish carrier arriving in the EU is not covered; the other leg is');
});

test('later checkpoint lookups read the chosen leg, never the other one; a vanished leg is a failure, not a guess', () => {
    const date = '2026-10-15';
    const payload = getMockAeroDataBoxPayload('XX2020', date);
    const onFra = parseAeroDataBoxResponse(payload, 'XX2020', date, 'MOCK', { origin: 'FRA', destination: 'JFK' })!;
    assert.deepEqual([onFra.origin.iata, onFra.destination.iata], ['FRA', 'JFK']);
    assert.equal(onFra.scheduledDepartureUtc, '2026-10-15T12:35:00.000Z');
    assert.throws(() => parseAeroDataBoxResponse(payload, 'XX2020', date, 'MOCK', { origin: 'LHR', destination: 'JFK' }), LegMismatchError);
    // one leg + hint: used as before (route changes must not turn into failures)
    const single = getMockAeroDataBoxPayload('XX1000', date);
    assert.ok(parseAeroDataBoxResponse(single, 'XX1000', date, 'MOCK', { origin: 'AAA', destination: 'BBB' }));
});

// ── not found: ≤7 days vs >7 days ───────────────────────────────────────────

test('not found ≤7 days before departure: blocking ("check number/date")', async () => {
    const date = dayFromNow(3);
    const { deps } = makeDeps();
    const r = await runFormLookup({ flightNumber: 'XX404', date, ipHash: null, now: NOW }, deps);
    assert.deepEqual(r, { status: 'NOT_FOUND', blocking: true, cached: false });
    assert.equal(submitGate({ kind: 'notFound', blocking: true }, null), 'FLIGHT_NOT_FOUND');
});

test('not found >7 days before departure: not blocking ("schedule may not be published")', async () => {
    const date = dayFromNow(40);
    const { deps } = makeDeps();
    const r = await runFormLookup({ flightNumber: 'XX404', date, ipHash: null, now: NOW }, deps);
    assert.deepEqual(r, { status: 'NOT_FOUND', blocking: false, cached: false });
    assert.equal(submitGate({ kind: 'notFound', blocking: false }, null), null);
});

test('server enforces the same rule on submit: NOT_FOUND blocks only ≤7 days; no lookup = as before', () => {
    const soon = dayFromNow(3);
    const far = dayFromNow(40);
    const nf: LookupCacheEntry = { outcome: 'NOT_FOUND', options: [], fetchedAt: NOW };
    assert.deepEqual(resolveFlightSelection({ cache: nf, date: soon, now: NOW }), { action: 'BLOCK', code: 'FLIGHT_NOT_FOUND' });
    assert.deepEqual(resolveFlightSelection({ cache: nf, date: far, now: NOW }), { action: 'UNVERIFIED' });
    assert.deepEqual(resolveFlightSelection({ cache: null, date: soon, now: NOW }), { action: 'UNVERIFIED' });
    const stale: LookupCacheEntry = { ...nf, fetchedAt: new Date(NOW.getTime() - LOOKUP_CACHE_TTL_MS - 1) };
    assert.deepEqual(resolveFlightSelection({ cache: stale, date: soon, now: NOW }), { action: 'UNVERIFIED' });
});

// ── cache ───────────────────────────────────────────────────────────────────

test('cache hit: second lookup of the same flight + date makes no provider call (6 h TTL)', async () => {
    const date = dayFromNow(20);
    const { deps, calls } = makeDeps();
    const first = await runFormLookup({ flightNumber: 'XX1000', date, ipHash: null, now: NOW }, deps);
    const second = await runFormLookup({ flightNumber: 'XX1000', date, ipHash: null, now: new Date(NOW.getTime() + 5 * HOUR) }, deps);
    assert.equal(calls.length, 1);
    assert.equal(first.status === 'FOUND' && first.cached, false);
    assert.equal(second.status === 'FOUND' && second.cached, true);
    // after 6 h it is fetched again
    await runFormLookup({ flightNumber: 'XX1000', date, ipHash: null, now: new Date(NOW.getTime() + 6 * HOUR + 1) }, deps);
    assert.equal(calls.length, 2);
    // a different date is a different entry
    await runFormLookup({ flightNumber: 'XX1000', date: dayFromNow(21), ipHash: null, now: NOW }, deps);
    assert.equal(calls.length, 3);
});

test('not-found results are cached too', async () => {
    const date = dayFromNow(3);
    const { deps, calls } = makeDeps();
    await runFormLookup({ flightNumber: 'XX404', date, ipHash: null, now: NOW }, deps);
    const again = await runFormLookup({ flightNumber: 'XX404', date, ipHash: null, now: NOW }, deps);
    assert.equal(calls.length, 1);
    assert.deepEqual(again, { status: 'NOT_FOUND', blocking: true, cached: true });
});

// ── rate limit ──────────────────────────────────────────────────────────────

test('rate limit: 10 lookups per hour per hashed IP, the 11th is refused without a provider call', async () => {
    const { deps, calls } = makeDeps();
    const ip = hashRequestIp('203.0.113.7', 'secret')!;
    assert.match(ip, /^[0-9a-f]{64}$/);
    assert.ok(!ip.includes('203.0.113.7'), 'raw IP is never stored');
    for (let i = 0; i < LOOKUP_LIMIT_PER_IP; i++) {
        const r = await runFormLookup({ flightNumber: 'XX1000', date: dayFromNow(10 + i), ipHash: ip, now: NOW }, deps);
        assert.equal(r.status, 'FOUND');
    }
    assert.equal(calls.length, 10);
    const refused = await runFormLookup({ flightNumber: 'XX1000', date: dayFromNow(30), ipHash: ip, now: NOW }, deps);
    assert.deepEqual(refused, { status: 'RATE_LIMITED' });
    assert.equal(calls.length, 10);
    // cache hits count too, another IP is unaffected, and the window slides
    assert.equal((await runFormLookup({ flightNumber: 'XX1000', date: dayFromNow(10), ipHash: ip, now: NOW }, deps)).status, 'RATE_LIMITED');
    assert.equal((await runFormLookup({ flightNumber: 'XX1000', date: dayFromNow(30), ipHash: 'other', now: NOW }, deps)).status, 'FOUND');
    assert.equal((await runFormLookup({ flightNumber: 'XX1000', date: dayFromNow(31), ipHash: ip, now: new Date(NOW.getTime() + HOUR + 1) }, deps)).status, 'FOUND');
    // rate-limited visitors can still use the form
    assert.equal(submitGate({ kind: 'rateLimited' }, null), null);
});

// ── quota critical / provider errors never block ────────────────────────────

test('quota critical: lookup is skipped and the form works as today', async () => {
    console.warn = () => {};
    assert.equal(isCheckAllowed('FORM_LOOKUP', 'OK'), true);
    assert.equal(isCheckAllowed('FORM_LOOKUP', 'SKIP_EARLY'), true);
    assert.equal(isCheckAllowed('FORM_LOOKUP', 'CRITICAL'), false);
    assert.equal(isCheckAllowed('FORM_LOOKUP', 'EXHAUSTED'), false);
    assert.equal(isCheckAllowed('DEP', 'CRITICAL'), true, 'monitoring keeps its calls');

    const { deps, cache } = makeDeps({ lookupLegs: async () => ({ ok: false, code: 'QUOTA_BLOCKED', message: 'Quota level CRITICAL blocks FORM_LOOKUP' }) });
    const r = await runFormLookup({ flightNumber: 'XX1000', date: dayFromNow(10), ipHash: null, now: NOW }, deps);
    assert.deepEqual(r, { status: 'SKIPPED', reason: 'QUOTA' });
    assert.equal(cache.size, 0, 'not cached');
    assert.equal(submitGate({ kind: 'skipped' }, null), null, 'form is submittable');
});

test('provider errors (HTTP, timeout, missing key, thrown) never block and are not cached', async () => {
    console.warn = () => {};
    console.error = () => {};
    for (const code of ['HTTP_ERROR', 'EXCEPTION', 'MISSING_CREDENTIALS', 'INVALID_FLIGHT_NUMBER'] as const) {
        const { deps, cache } = makeDeps({ lookupLegs: async () => ({ ok: false, code, message: code }) });
        assert.deepEqual(await runFormLookup({ flightNumber: 'XX1000', date: dayFromNow(10), ipHash: null, now: NOW }, deps), { status: 'SKIPPED', reason: 'UNAVAILABLE' });
        assert.equal(cache.size, 0);
    }
    const thrown = makeDeps({ lookupLegs: async () => { throw new Error('boom'); } });
    assert.deepEqual(await runFormLookup({ flightNumber: 'XX1000', date: dayFromNow(10), ipHash: null, now: NOW }, thrown.deps), { status: 'SKIPPED', reason: 'UNAVAILABLE' });
    // broken cache storage degrades to "no cache"
    const brokenCache = makeDeps({ getCache: async () => { throw new Error('table missing'); }, putCache: async () => { throw new Error('table missing'); } });
    assert.equal((await runFormLookup({ flightNumber: 'XX1000', date: dayFromNow(10), ipHash: null, now: NOW }, brokenCache.deps)).status, 'FOUND');
});

// ── display ─────────────────────────────────────────────────────────────────

test('time format: airport-local, month as a name', () => {
    assert.equal(formatLocalDateTime('2026-10-15T13:00'), '15 Oct 2026, 13:00');
    assert.equal(formatLocalDateTime('2026-01-05T07:05'), '5 Jan 2026, 07:05');
    assert.equal(formatLocalDateTime('2026-10-15T13:00', 'tr'), '15 Eki 2026, 13:00');
    assert.equal(formatLocalDateTime('2026-10-15T13:00', 'de'), '15 Okt 2026, 13:00');
    assert.equal(formatLocalDateTime('2026-10-15T13:00', 'xx'), '15 Oct 2026, 13:00');
    assert.equal(formatLocalDateTime(null), null);
    assert.equal(formatLocalDateTime('2026-10-15 13:00'), null);
});

test('local time comes from the provider\'s local string, or the airport time zone when only UTC is given', () => {
    const [leg] = parseLegs([{ departure: { airport: { iata: 'IST', timeZone: 'Europe/Istanbul' }, scheduledTime: { utc: '2026-10-15 07:50Z' } }, arrival: { airport: { iata: 'FRA' } } }]);
    assert.equal(leg.departureLocal, '2026-10-15T10:50');
    assert.equal(leg.arrivalLocal, null);
});

test('airline name: local list first (TK → Turkish Airlines); unknown codes never block', () => {
    assert.equal(airlineDisplayName('TK', 'THY'), 'Turkish Airlines');
    assert.equal(airlineDisplayName('tk', null), 'Turkish Airlines');
    assert.equal(airlineDisplayName('QQ', 'Quux Air'), 'Quux Air');
    assert.equal(airlineDisplayName('QQ', null), 'QQ');
    assert.equal(airlineDisplayName(null, null), null);
});

// ── no second provider call at opt-in; quota report ─────────────────────────

test('opt-in skips the registration lookup for a trip whose leg was resolved in the form', () => {
    assert.equal(skipRegistrationLookup({ flightVerifiedAt: new Date() }), true);
    assert.equal(skipRegistrationLookup({ flightVerifiedAt: null }), false);
    const life = readFileSync('lib/guardian/tripLifecycle.ts', 'utf8');
    const init = life.slice(life.indexOf('export async function initializeTripMonitoring'));
    assert.ok(init.indexOf('skipRegistrationLookup(trip)') > 0);
    assert.ok(init.indexOf('skipRegistrationLookup(trip)') < init.indexOf("lookupWithinBudget(tripId, segment, 'REGISTRATION')"));
});

test('track route takes only the leg KEY from the client and saves the resolved leg on the trip', () => {
    const src = readFileSync('app/api/trips/track/route.ts', 'utf8');
    assert.match(src, /legKey\?: string/);
    assert.match(src, /resolveFlightSelection\(/);
    assert.match(src, /flightVerifiedAt: now/);
    assert.doesNotMatch(src, /body\.(origin|destination|departure)/);
});

test('quota report: calls per N submissions at the default 600 units / 2 per call', () => {
    const capacity = getMonthlyCallCapacity(getQuotaConfig({}));
    assert.equal(capacity, 300);
    const base = { lookupsPerSubmission: 1.3, confirmRate: 0.6, cacheHitRate: 0 };
    const at = (n: number) => estimateMonthlyCalls({ submissions: n, ...base });
    assert.equal(Math.round(at(100).formLookups), 130);
    assert.equal(Math.round(at(100).monitoring), 300);
    assert.equal(Math.round(at(100).total), 430);
    assert.ok(at(100).total > capacity);
    assert.ok(at(60).total <= capacity, '60 submissions/month fit');
});

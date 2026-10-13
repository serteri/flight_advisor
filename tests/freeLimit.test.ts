import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { FREE_TIER_LIMITS } from '@/lib/freemium/limits';
import { FREE_MONITORED_FLIGHT_LIMIT, LIMIT_HOLDING_STATUSES, planActivation } from '@/lib/guardian/freeLimit';

test('the Free limit is the advertised one flight', () => {
    assert.equal(FREE_MONITORED_FLIGHT_LIMIT, 1);
    assert.equal(FREE_MONITORED_FLIGHT_LIMIT, FREE_TIER_LIMITS.monitoredTrips);
    assert.deepEqual([...LIMIT_HOLDING_STATUSES], ['ACTIVE', 'PENDING_VERIFICATION']);
});

test('free user with nothing monitored: the oldest pending trip activates, the rest are rejected', () => {
    const plan = planActivation({ isPro: false, holding: 0, pendingIdsOldestFirst: ['a', 'b', 'c'] });
    assert.deepEqual(plan, { activate: ['a'], rejected: ['b', 'c'] });
});

test('free user already monitoring one flight: nothing new activates', () => {
    const plan = planActivation({ isPro: false, holding: 1, pendingIdsOldestFirst: ['a'] });
    assert.deepEqual(plan, { activate: [], rejected: ['a'] });
});

test('repeatedly submitting the same email cannot exceed the limit', () => {
    // Five submissions, one confirmation click.
    const plan = planActivation({ isPro: false, holding: 0, pendingIdsOldestFirst: ['1', '2', '3', '4', '5'] });
    assert.equal(plan.activate.length + 0, 1);
    assert.equal(plan.rejected.length, 4);
});

test('paid users are not limited', () => {
    const plan = planActivation({ isPro: true, holding: 7, pendingIdsOldestFirst: ['a', 'b'] });
    assert.deepEqual(plan, { activate: ['a', 'b'], rejected: [] });
});

test('over-limit holding never produces negative capacity', () => {
    const plan = planActivation({ isPro: false, holding: 5, pendingIdsOldestFirst: ['a'] });
    assert.deepEqual(plan, { activate: [], rejected: ['a'] });
});

test('wiring: confirmation applies the plan; monitor route and checkLimit use the same rule', () => {
    const confirm = readFileSync('lib/guardian/tripConfirmation.ts', 'utf8');
    assert.match(confirm, /planActivation\(/);
    assert.match(confirm, /orderBy: \{ createdAt: 'asc' \}/);
    const usage = readFileSync('lib/freemium/usage.ts', 'utf8');
    assert.match(usage, /feature === 'monitored_trip'[\s\S]*countHoldingTrips\(userId\)/);
    const monitor = readFileSync('app/api/trips/monitor/route.ts', 'utf8');
    assert.match(monitor, /withFreemiumGate\(session\.user\.id!, 'monitored_trip'/);
});

test('anonymous /api/trips/track never reveals whether an address is registered', () => {
    const track = readFileSync('app/api/trips/track/route.ts', 'utf8');
    assert.doesNotMatch(track, /LIMIT_REACHED|limit reached|already (has|monitor)/i);
    assert.doesNotMatch(track, /countHoldingTrips|checkLimit/);
});

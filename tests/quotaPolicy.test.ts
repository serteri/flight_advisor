import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    MAX_CALLS_PER_TRIP,
    computeUsageRatio,
    getMonthlyCallCapacity,
    getMonthlyTripCapacity,
    getQuotaConfig,
    getQuotaLevel,
    isCheckAllowed,
    parseRateLimitHeaders,
    reachedThreshold,
} from '@/lib/flightData/quotaPolicy';

test('config reads env with conservative defaults', () => {
    assert.deepEqual(getQuotaConfig({}), { monthlyQuotaUnits: 600, unitsPerCall: 2 });
    assert.deepEqual(getQuotaConfig({ AERODATABOX_MONTHLY_QUOTA: '3000', AERODATABOX_UNITS_PER_CALL: '1' }), { monthlyQuotaUnits: 3000, unitsPerCall: 1 });
    assert.deepEqual(getQuotaConfig({ AERODATABOX_MONTHLY_QUOTA: 'abc', AERODATABOX_UNITS_PER_CALL: '0' }), { monthlyQuotaUnits: 600, unitsPerCall: 2 });
});

test('monthly call and trip capacity', () => {
    const config = { monthlyQuotaUnits: 600, unitsPerCall: 2 };
    assert.equal(MAX_CALLS_PER_TRIP, 8);
    assert.equal(getMonthlyCallCapacity(config), 300);
    assert.deepEqual(getMonthlyTripCapacity(config), { worstCase: 37, typical: 50 });
});

test('usage ratio prefers provider headers over the internal counter', () => {
    const config = { monthlyQuotaUnits: 600, unitsPerCall: 2 };
    assert.equal(computeUsageRatio({ unitsUsed: 300 }, config), 0.5);
    assert.equal(computeUsageRatio({ unitsUsed: 300, headerLimit: 1000, headerRemaining: 100 }, config), 0.9);
});

test('quota levels and thresholds', () => {
    assert.equal(getQuotaLevel(0.79), 'OK');
    assert.equal(getQuotaLevel(0.8), 'SKIP_EARLY');
    assert.equal(getQuotaLevel(0.95), 'CRITICAL');
    assert.equal(getQuotaLevel(1), 'EXHAUSTED');
    assert.equal(reachedThreshold(0.5), 0);
    assert.equal(reachedThreshold(0.81), 80);
    assert.equal(reachedThreshold(0.96), 95);
    assert.equal(reachedThreshold(1.2), 100);
});

test('checkpoint gating per quota level', () => {
    const kinds = ['REGISTRATION', 'DEP_MINUS_24H', 'DEP_MINUS_3H', 'DEP', 'ARR_PLUS_1H', 'ARR_PLUS_4H', 'EXTRA_ARR_PLUS_1H'] as const;
    const allowed = (level: Parameters<typeof isCheckAllowed>[1]) => kinds.filter((k) => isCheckAllowed(k, level));

    assert.deepEqual(allowed('OK'), [...kinds]);
    assert.deepEqual(allowed('SKIP_EARLY'), kinds.filter((k) => k !== 'DEP_MINUS_24H'));
    assert.deepEqual(allowed('CRITICAL'), ['DEP', 'ARR_PLUS_4H']);
    assert.deepEqual(allowed('EXHAUSTED'), []);
    assert.equal(isCheckAllowed('COMPLETE', 'EXHAUSTED'), true, 'COMPLETE never calls the provider');
});

test('parses RapidAPI rate-limit headers, preferring units', () => {
    const headers = new Headers({
        'x-ratelimit-requests-limit': '1000',
        'x-ratelimit-requests-remaining': '900',
        'x-ratelimit-api-units-limit': '600',
        'x-ratelimit-api-units-remaining': '120',
    });
    assert.deepEqual(parseRateLimitHeaders(headers), { kind: 'api-units', limit: 600, remaining: 120 });
    assert.deepEqual(
        parseRateLimitHeaders({ 'X-RateLimit-Requests-Limit': '50', 'X-RateLimit-Requests-Remaining': '5' }),
        { kind: 'requests', limit: 50, remaining: 5 },
    );
    assert.equal(parseRateLimitHeaders(new Headers({ 'content-type': 'application/json' })), null);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildQuotaView } from '@/lib/flightData/quotaView';
import { EXPECTED_CALLS_PER_TRIP } from '@/lib/flightData/quotaPolicy';
import {
    PUBLISH_SCHEDULE_CRON,
    evaluateSchedule,
    expectedPublishDestination,
} from '@/lib/guardian/publishSchedule';
import { formatFailure, parseFailure } from '@/lib/guardian/failureText';

const config = { monthlyQuotaUnits: 600, unitsPerCall: 2 };

test('quota view: defaults 600 units / 2 per call = 300 calls', () => {
    const v = buildQuotaView({ callsUsed: 0, unitsUsed: 0, config });
    assert.equal(v.monthlyAllocationUnits, 600);
    assert.equal(v.estimatedCallsRemaining, 300);
    assert.equal(v.additionalNormalTrips, Math.floor(300 / EXPECTED_CALLS_PER_TRIP));
    assert.equal(v.level, 'OK');
    assert.equal(v.source, 'INTERNAL_COUNTER');
});

test('quota view: levels follow the existing 80/95/100 thresholds', () => {
    const at = (unitsUsed: number) => buildQuotaView({ callsUsed: unitsUsed / 2, unitsUsed, config });
    assert.equal(at(479).level, 'OK');
    assert.equal(at(480).level, 'SKIP_EARLY');
    assert.equal(at(570).level, 'CRITICAL');
    assert.equal(at(600).level, 'EXHAUSTED');
    assert.equal(at(700).unitsRemaining, 0);
    assert.equal(at(700).additionalNormalTrips, 0);
});

test('quota view: provider headers win over the internal counter', () => {
    const v = buildQuotaView({ callsUsed: 10, unitsUsed: 20, headerLimit: 1000, headerRemaining: 150, headerKind: 'units', config });
    assert.equal(v.source, 'PROVIDER_HEADERS');
    assert.equal(v.monthlyAllocationUnits, 1000);
    assert.equal(v.unitsUsed, 850);
    assert.equal(v.estimatedCallsRemaining, 75);
    assert.equal(v.level, 'SKIP_EARLY');
});

test('quota view: a "requests" header counts one unit per call', () => {
    const v = buildQuotaView({ callsUsed: 0, unitsUsed: 0, headerLimit: 100, headerRemaining: 40, headerKind: 'requests', config });
    assert.equal(v.estimatedCallsRemaining, 40);
});

test('schedule health verdicts', () => {
    const dest = expectedPublishDestination('https://www.flightagent.io/');
    assert.equal(dest, 'https://www.flightagent.io/api/guardian/publish-due');
    const ok = { cron: PUBLISH_SCHEDULE_CRON, destination: dest, isPaused: false };
    assert.equal(evaluateSchedule(ok, dest), 'HEALTHY');
    assert.equal(evaluateSchedule(null, dest), 'MISSING');
    assert.equal(evaluateSchedule({ ...ok, isPaused: true }, dest), 'PAUSED');
    assert.equal(evaluateSchedule({ ...ok, destination: 'https://old.example/api/guardian/publish-due' }, dest), 'WRONG_DESTINATION');
    assert.equal(evaluateSchedule({ ...ok, cron: '0 0 * * *' }, dest), 'WRONG_CRON');
});

test('failure text round-trips and tolerates legacy text', () => {
    const text = formatFailure('TEMPORARY', 'HTTP_ERROR', 'AeroDataBox returned HTTP 503');
    assert.deepEqual(parseFailure(text), { failureClass: 'TEMPORARY', code: 'HTTP_ERROR' });
    assert.deepEqual(parseFailure('QUOTA_BLOCKED: Quota level EXHAUSTED'), { failureClass: 'UNCLASSIFIED', code: null });
    assert.deepEqual(parseFailure(null), { failureClass: 'UNCLASSIFIED', code: null });
});

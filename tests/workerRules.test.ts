import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DELAY_BUCKETS, getDelayBucket, proactiveClaimRuleType } from '@/workers/guardianWorker';
import { evaluateCompensation } from '@/lib/compensation/engine';

const SCHED = '2026-03-10T12:00:00.000Z';
const delayResult = (origin: string, destination: string, carrier: string, minutes: number) =>
    evaluateCompensation({
        disruption: 'DELAY',
        carrierIata: carrier,
        originIata: origin,
        finalDestinationIata: destination,
        scheduledArrivalUtc: SCHED,
        actualGateArrivalUtc: new Date(Date.parse(SCHED) + minutes * 60000).toISOString(),
    });

test('delay buckets extend past 60 to the 180/240 legal thresholds', () => {
    assert.deepEqual([...DELAY_BUCKETS], [15, 30, 60, 180, 240]);
    assert.equal(getDelayBucket(59), 30);
    assert.equal(getDelayBucket(179), 60);
    assert.equal(getDelayBucket(180), 180);
    assert.equal(getDelayBucket(239), 180);
    assert.equal(getDelayBucket(240), 240);
    assert.equal(getDelayBucket(600), 240);
});

test('no "check your rights" email below 180 minutes', () => {
    for (const minutes of [15, 60, 120, 179]) {
        assert.equal(proactiveClaimRuleType('DELAYED', delayResult('MUC', 'FCO', 'LH', minutes)), null, `${minutes} min`);
    }
});

test('delay email only when the engine says LIKELY_ELIGIBLE', () => {
    assert.equal(proactiveClaimRuleType('DELAYED', delayResult('MUC', 'FCO', 'LH', 180)), 'COMPENSATION_DELAYED');
    // ≥180 but out of scope (non-EU carrier into the EU)
    assert.equal(proactiveClaimRuleType('DELAYED', delayResult('DXB', 'FRA', 'EK', 300)), null);
    // ≥180 but carrier unknown → NEEDS_INFO → no email
    assert.equal(proactiveClaimRuleType('DELAYED', delayResult('JFK', 'FRA', 'XX', 300)), null);
    // Route unknown → the worker passes null
    assert.equal(proactiveClaimRuleType('DELAYED', null), null);
});

test('cancellation email unless EU261/UK261 is ruled out', () => {
    const noNotice = evaluateCompensation({
        disruption: 'CANCELLATION', carrierIata: 'LH', originIata: 'MUC', finalDestinationIata: 'FCO',
        scheduledDepartureUtc: SCHED,
    });
    assert.equal(noNotice.status, 'NEEDS_INFO');
    assert.equal(proactiveClaimRuleType('CANCELLED', noNotice), 'COMPENSATION_CANCELLED');

    const earlyNotice = evaluateCompensation({
        disruption: 'CANCELLATION', carrierIata: 'LH', originIata: 'MUC', finalDestinationIata: 'FCO',
        scheduledDepartureUtc: SCHED,
        cancellationNoticeUtc: new Date(Date.parse(SCHED) - 30 * 86400000).toISOString(),
    });
    assert.equal(proactiveClaimRuleType('CANCELLED', earlyNotice), null);

    const auDomestic = evaluateCompensation({
        disruption: 'CANCELLATION', carrierIata: 'QF', originIata: 'SYD', finalDestinationIata: 'MEL',
        scheduledDepartureUtc: SCHED,
    });
    assert.equal(proactiveClaimRuleType('CANCELLED', auDomestic), null);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classifyForBackfill } from '@/lib/guardian/backfill';

const NOW = new Date('2026-10-01T12:00:00.000Z');
const seg = (depIso: string, arrIso: string) => ({
    departureDate: new Date(depIso),
    arrivalDate: new Date(arrIso),
    scheduledDepartureUtc: new Date(depIso),
    scheduledArrivalUtc: new Date(arrIso),
});

test('backfill: trip with an existing QStash message id is skipped (idempotent)', () => {
    const d = classifyForBackfill({ hasScheduledMessage: true, segment: seg('2026-10-05T08:00:00Z', '2026-10-05T11:00:00Z') }, NOW);
    assert.equal(d.action, 'SKIP_ALREADY_SCHEDULED');
    assert.deepEqual(d.checks, []);
});

test('backfill: future trip gets the full future plan', () => {
    const d = classifyForBackfill({ hasScheduledMessage: false, segment: seg('2026-10-05T08:00:00Z', '2026-10-05T11:00:00Z') }, NOW);
    assert.equal(d.action, 'SCHEDULE');
    assert.deepEqual(d.checks.map((c) => c.kind), ['DEP_MINUS_24H', 'DEP_MINUS_3H', 'DEP', 'ARR_PLUS_1H', 'ARR_PLUS_4H', 'COMPLETE']);
});

test('backfill: past checkpoints are never scheduled', () => {
    // Departed 2h ago, lands in 1h: only arrival-based checks remain.
    const d = classifyForBackfill({ hasScheduledMessage: false, segment: seg('2026-10-01T10:00:00Z', '2026-10-01T13:00:00Z') }, NOW);
    assert.equal(d.action, 'SCHEDULE');
    assert.deepEqual(d.checks.map((c) => c.kind), ['ARR_PLUS_1H', 'ARR_PLUS_4H', 'COMPLETE']);
    assert.ok(d.checks.every((c) => c.runAt.getTime() > NOW.getTime()));
});

test('backfill: arrival already passed → PAST_ARRIVAL, nothing scheduled', () => {
    const d = classifyForBackfill({ hasScheduledMessage: false, segment: seg('2026-09-20T08:00:00Z', '2026-09-20T11:00:00Z') }, NOW);
    assert.equal(d.action, 'PAST_ARRIVAL');
    assert.deepEqual(d.checks, []);
});

test('backfill: trip without a segment is skipped', () => {
    assert.equal(classifyForBackfill({ hasScheduledMessage: false, segment: null }, NOW).action, 'SKIP_NO_SEGMENT');
});

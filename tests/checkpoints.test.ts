import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    monitoringEndsAt,
    planCheckpoints,
    planExtraCheck,
    resolveTripSchedule,
    scheduleChanged,
} from '@/lib/guardian/checkpoints';

const H = 60 * 60 * 1000;
const dep = new Date('2026-06-10T09:00:00Z');
const arr = new Date('2026-06-10T17:30:00Z');
const schedule = { departureUtc: dep, arrivalUtc: arr, approximate: false };

test('plans the five checkpoints plus COMPLETE when everything is in the future', () => {
    const plan = planCheckpoints(schedule, new Date('2026-06-01T00:00:00Z'));
    assert.deepEqual(plan.map((c) => c.kind), ['DEP_MINUS_24H', 'DEP_MINUS_3H', 'DEP', 'ARR_PLUS_1H', 'ARR_PLUS_4H', 'COMPLETE']);
    assert.equal(plan[0].runAt.toISOString(), '2026-06-09T09:00:00.000Z');
    assert.equal(plan[1].runAt.toISOString(), '2026-06-10T06:00:00.000Z');
    assert.equal(plan[2].runAt.toISOString(), '2026-06-10T09:00:00.000Z');
    assert.equal(plan[3].runAt.toISOString(), '2026-06-10T18:30:00.000Z');
    assert.equal(plan[4].runAt.toISOString(), '2026-06-10T21:30:00.000Z');
    assert.equal(plan[5].runAt.toISOString(), '2026-06-12T17:30:00.000Z', 'COMPLETE = arrival + 48h');
});

test('skips checkpoints already in the past', () => {
    const plan = planCheckpoints(schedule, new Date('2026-06-10T08:00:00Z'));
    assert.deepEqual(plan.map((c) => c.kind), ['DEP', 'ARR_PLUS_1H', 'ARR_PLUS_4H', 'COMPLETE']);
});

test('COMPLETE runs immediately when the monitoring window is already over', () => {
    const now = new Date('2026-07-01T00:00:00Z');
    const plan = planCheckpoints(schedule, now);
    assert.deepEqual(plan.map((c) => c.kind), ['COMPLETE']);
    assert.equal(plan[0].runAt.getTime(), now.getTime());
});

test('monitoring ends 48h after scheduled arrival', () => {
    assert.equal(monitoringEndsAt(schedule).toISOString(), '2026-06-12T17:30:00.000Z');
});

test('resolveTripSchedule prefers provider UTC times', () => {
    const s = resolveTripSchedule({
        scheduledDepartureUtc: dep,
        scheduledArrivalUtc: arr,
        departureDate: new Date('2026-06-10T00:00:00Z'),
    });
    assert.equal(s.approximate, false);
    assert.equal(s.departureUtc.getTime(), dep.getTime());
    assert.equal(s.arrivalUtc.getTime(), arr.getTime());
});

test('resolveTripSchedule approximates a date-only flight at 12:00 UTC + 3h', () => {
    const s = resolveTripSchedule({ departureDate: new Date('2026-06-10T00:00:00Z'), arrivalDate: new Date('2026-06-10T00:00:00Z') });
    assert.equal(s.approximate, true);
    assert.equal(s.departureUtc.toISOString(), '2026-06-10T12:00:00.000Z');
    assert.equal(s.arrivalUtc.toISOString(), '2026-06-10T15:00:00.000Z');
});

test('scheduleChanged ignores changes under 15 minutes and missing provider values', () => {
    const prev = { departureUtc: dep, arrivalUtc: arr };
    assert.equal(scheduleChanged(prev, { departureUtc: new Date(dep.getTime() + 10 * 60000), arrivalUtc: arr }), false);
    assert.equal(scheduleChanged(prev, { departureUtc: new Date(dep.getTime() + 20 * 60000), arrivalUtc: arr }), true);
    assert.equal(scheduleChanged(prev, { departureUtc: null, arrivalUtc: null }), false);
    assert.equal(scheduleChanged({ departureUtc: null, arrivalUtc: null }, { departureUtc: dep, arrivalUtc: null }), true);
});

test('extra check only when estimated arrival is ≥150 min late, once, and in the future', () => {
    const now = new Date('2026-06-10T12:00:00Z');
    assert.equal(planExtraCheck({ scheduledArrivalUtc: arr, estimatedArrivalUtc: new Date(arr.getTime() + 149 * 60000), now, extraAlreadyPlanned: false }), null);

    const at = planExtraCheck({ scheduledArrivalUtc: arr, estimatedArrivalUtc: new Date(arr.getTime() + 150 * 60000), now, extraAlreadyPlanned: false });
    assert.equal(at?.toISOString(), new Date(arr.getTime() + 150 * 60000 + H).toISOString(), 'estimated arrival + 1h');

    assert.equal(planExtraCheck({ scheduledArrivalUtc: arr, estimatedArrivalUtc: new Date(arr.getTime() + 200 * 60000), now, extraAlreadyPlanned: true }), null);
    assert.equal(planExtraCheck({ scheduledArrivalUtc: arr, estimatedArrivalUtc: new Date(arr.getTime() + 200 * 60000), now: new Date('2026-06-11T00:00:00Z'), extraAlreadyPlanned: false }), null);
    assert.equal(planExtraCheck({ scheduledArrivalUtc: null, estimatedArrivalUtc: arr, now, extraAlreadyPlanned: false }), null);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { compensationInputFromTrip, evaluateTripCompensation } from '@/lib/compensation/tripCompensation';

const seg = (origin: string, destination: string, airlineCode = 'AF') => ({
    airlineCode, origin, destination, scheduledDepartureUtc: new Date('2026-09-30T10:00:00Z'),
});

test('trip page and letter share one engine result: CDG→JFK 185 min → EUR 300', () => {
    const r = evaluateTripCompensation({ segments: [seg('CDG', 'JFK')], snapshot: { status: 'DELAYED', delayMinutes: 185 } });
    assert.equal(r.regime, 'EU261');
    assert.equal(r.status, 'LIKELY_ELIGIBLE');
    assert.equal(r.amount, 300);
    assert.equal(r.currency, 'EUR');
});

test('no snapshot yet → NEEDS_INFO (never "eligible" before any data)', () => {
    const input = compensationInputFromTrip({ segments: [seg('CDG', 'JFK')], snapshot: null });
    assert.equal(input!.arrivalDelayMinutes, null);
    assert.equal(evaluateTripCompensation({ segments: [seg('CDG', 'JFK')], snapshot: null }).status, 'NEEDS_INFO');
});

test('unknown route → NEEDS_INFO, no amount', () => {
    const r = evaluateTripCompensation({ routeUnknown: true, segments: [seg('UNK', 'UNK')], snapshot: { delayMinutes: 400 } });
    assert.equal(r.status, 'NEEDS_INFO');
    assert.equal(r.amount, null);
});

test('connecting trip uses the final destination; cancellation read from snapshot status', () => {
    const input = compensationInputFromTrip({ segments: [seg('FRA', 'IST', 'TK'), seg('IST', 'SIN', 'TK')], snapshot: { status: 'cancelled', delayMinutes: 0 } });
    assert.equal(input!.finalDestinationIata, 'SIN');
    assert.equal(input!.disruption, 'CANCELLATION');
});

test('no segments → NEEDS_INFO', () => {
    assert.equal(evaluateTripCompensation({ segments: [], snapshot: null }).status, 'NEEDS_INFO');
});

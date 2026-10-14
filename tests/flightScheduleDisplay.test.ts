import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { airportSchedule, scheduleTime, scheduleDate } from '../lib/guardian/flightScheduleDisplay';
import { parseLegs } from '../lib/flightData/legs';
import { verifiedSegmentData } from '../lib/guardian/verifiedFlight';

const legs = parseLegs({
    departure: { airport: { iata: 'BNE', timeZone: 'Australia/Brisbane' }, scheduledTime: { utc: '2026-10-15T08:15:00Z', local: '2026-10-15 18:15+10:00' } },
    arrival: { airport: { iata: 'SYD', timeZone: 'Australia/Sydney' }, scheduledTime: { utc: '2026-10-15T09:50:00Z', local: '2026-10-15 20:50+11:00' } },
});
const segment = { origin: 'BNE', destination: 'SYD', departureDate: new Date('2026-10-15T00:00:00Z'), arrivalDate: new Date('2026-10-15T08:50:00Z'), scheduledDepartureUtc: '2026-10-15T08:15:00Z', scheduledArrivalUtc: '2026-10-15T09:50:00Z' };

test('QF549 uses saved schedule and provider-local clocks, independent of lookup dates', () => {
    const display = airportSchedule(segment, legs);
    assert.equal(scheduleTime(display.scheduledDepartureLocal, 'Not available'), '18:15');
    assert.equal(scheduleTime(display.scheduledArrivalLocal, 'Not available'), '20:50');
    assert.equal(scheduleDate(display.scheduledDepartureLocal, 'en-US', 'Not available'), 'Oct 15, 2026');
});

test('IANA conversion and date-only display are independent of user timezone', () => {
    const previous = process.env.TZ;
    try {
        for (const zone of ['UTC', 'America/Los_Angeles', 'Asia/Tokyo']) {
            process.env.TZ = zone;
            const display = airportSchedule(segment, legs.map(l => ({ ...l, departureLocal: null, arrivalLocal: null })));
            assert.equal(scheduleTime(display.scheduledDepartureLocal, 'Not available'), '18:15');
            assert.equal(scheduleTime(display.scheduledArrivalLocal, 'Not available'), '20:50');
            assert.equal(scheduleDate(display.scheduledDepartureLocal, 'en-US', 'Not available'), 'Oct 15, 2026');
        }
    } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});

test('missing schedule or timezone never invents a clock', () => {
    const display = airportSchedule({ ...segment, scheduledDepartureUtc: null, scheduledArrivalUtc: null }, legs);
    assert.equal(scheduleTime(display.scheduledDepartureLocal, 'Not available'), 'Not available');
    assert.equal(scheduleTime(display.scheduledArrivalLocal, 'Not available'), 'Not available');
    assert.equal(scheduleDate(display.scheduledDepartureLocal, 'en-US', 'Not available'), 'Not available');
    assert.equal(airportSchedule(segment, []).scheduledDepartureLocal, null);
});

test('changed schedule recomputes from UTC instead of reusing stale local digits', () => {
    const display = airportSchedule({ ...segment, scheduledDepartureUtc: '2026-10-15T09:15:00Z', scheduledArrivalUtc: '2026-10-15T10:50:00Z' }, legs);
    assert.equal(scheduleTime(display.scheduledDepartureLocal, 'Not available'), '19:15');
    assert.equal(scheduleTime(display.scheduledArrivalLocal, 'Not available'), '21:50');
});

test('Trip Details wires schedule fields and never formats lookup dates as clocks', () => {
    const client = readFileSync('app/[locale]/dashboard/guardian/[id]/TripDetailsClient.tsx', 'utf8');
    assert.doesNotMatch(client, /(?:tm|formatTime)\(segment\.(?:departureDate|arrivalDate)/);
    assert.match(client, /scheduleTime\(segment.scheduledDepartureLocal/);
    assert.match(client, /scheduleTime\(segment.scheduledArrivalLocal/);
    assert.match(client, /scheduleDate\(firstSegment\?\.scheduledDepartureLocal/);
    const saved = verifiedSegmentData(legs[0], segment.departureDate);
    assert.ok(saved);
    assert.equal(saved.scheduledDepartureUtc?.toISOString(), new Date(segment.scheduledDepartureUtc).toISOString());
    assert.equal(saved.scheduledArrivalUtc?.toISOString(), new Date(segment.scheduledArrivalUtc).toISOString());
});

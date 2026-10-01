import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    arrivalDelayMinutes,
    mapAdbStatus,
    parseAdbTime,
    parseAeroDataBoxResponse,
} from '@/lib/flightData/aerodatabox';
import { FIXTURE_BASE_DATE, getMockAeroDataBoxPayload } from '@/lib/flightData/mock';
import { isLiveFlightData } from '@/lib/flightData/client';

const load = (flightNumber: string, date = FIXTURE_BASE_DATE) =>
    parseAeroDataBoxResponse(getMockAeroDataBoxPayload(flightNumber, date), flightNumber, date, 'MOCK')!;

test('parseAdbTime converts AeroDataBox UTC/local strings to ISO', () => {
    assert.equal(parseAdbTime({ utc: '2026-01-15 08:00Z' }), '2026-01-15T08:00:00.000Z');
    assert.equal(parseAdbTime({ local: '2026-01-15 09:00+01:00' }), '2026-01-15T08:00:00.000Z');
    assert.equal(parseAdbTime(undefined), null);
    assert.equal(parseAdbTime({ utc: 'garbage' }), null);
});

test('mapAdbStatus covers AeroDataBox status strings', () => {
    assert.equal(mapAdbStatus('Canceled'), 'cancelled');
    assert.equal(mapAdbStatus('CanceledUncertain'), 'cancelled');
    assert.equal(mapAdbStatus('Arrived'), 'landed');
    assert.equal(mapAdbStatus('EnRoute'), 'active');
    assert.equal(mapAdbStatus('Departed'), 'active');
    assert.equal(mapAdbStatus('Expected'), 'scheduled');
    assert.equal(mapAdbStatus('Delayed'), 'scheduled');
    assert.equal(mapAdbStatus('Diverted'), 'diverted');
    assert.equal(mapAdbStatus('Unknown'), 'unknown');
    assert.equal(mapAdbStatus(undefined), 'unknown');
});

test('XX1000 is on time with a known route', () => {
    const f = load('XX1000');
    assert.equal(f.status, 'landed');
    assert.equal(f.origin.iata, 'FRA');
    assert.equal(f.destination.iata, 'MAD');
    assert.equal(f.origin.countryCode, 'DE');
    assert.equal(f.routeKnown, true);
    assert.equal(arrivalDelayMinutes(f), 0);
    assert.equal(f.source, 'MOCK');
});

test('XX1180 arrives 185 minutes late, XX1240 245 minutes late', () => {
    assert.equal(arrivalDelayMinutes(load('XX1180')), 185);
    assert.equal(arrivalDelayMinutes(load('XX1240')), 245);
    assert.equal(load('XX1180').greatCircleDistanceKm, 5837.4);
});

test('XX1300 is cancelled', () => {
    const f = load('XX1300');
    assert.equal(f.status, 'cancelled');
    assert.equal(f.origin.iata, 'MUC');
});

test('XX1999 has no resolvable route', () => {
    const f = load('XX1999');
    assert.equal(f.routeKnown, false);
    assert.equal(f.origin.iata, null);
    assert.equal(f.destination.iata, null);
    assert.equal(arrivalDelayMinutes(f), null, 'never guesses a delay without arrival times');
});

test('U21234 parses a digit IATA designator on an intra-EU route', () => {
    const f = load('U21234');
    assert.equal(f.airlineIata, 'U2');
    assert.equal(f.origin.countryCode, 'DE');
    assert.equal(f.destination.countryCode, 'IT');
});

test('unknown flight numbers fall back to the on-time scenario with their own number', () => {
    const payload = getMockAeroDataBoxPayload('LH400', FIXTURE_BASE_DATE);
    assert.equal(payload[0].number, 'LH 400');
    assert.equal(payload[0].airline?.iata, 'LH');
    assert.equal(arrivalDelayMinutes(parseAeroDataBoxResponse(payload, 'LH400', FIXTURE_BASE_DATE, 'MOCK')!), 0);
});

test('mock payloads are shifted to the requested date', () => {
    const f = load('XX1180', '2026-11-03');
    assert.equal(f.scheduledDepartureUtc, '2026-11-03T09:00:00.000Z');
    assert.equal(f.scheduledArrivalUtc, '2026-11-03T17:30:00.000Z');
});

test('arrival delay never uses departure times', () => {
    const f = load('XX1000');
    const noArrival = { ...f, scheduledArrivalUtc: null, revisedArrivalUtc: null, predictedArrivalUtc: null, runwayArrivalUtc: null };
    assert.equal(arrivalDelayMinutes(noArrival), null);
});

test('live data only in Vercel production or when forced', () => {
    assert.equal(isLiveFlightData({ VERCEL_ENV: 'production' }), true);
    assert.equal(isLiveFlightData({ VERCEL_ENV: 'preview' }), false);
    assert.equal(isLiveFlightData({ NODE_ENV: 'production' }), false, 'NODE_ENV alone must not enable live calls');
    assert.equal(isLiveFlightData({ VERCEL_ENV: 'development', AERODATABOX_FORCE_LIVE: 'true' }), true);
});

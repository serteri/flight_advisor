import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    MAX_CHECK_RETRIES,
    classifyLookupFailure,
    retriedFromHeader,
    shouldRetry,
} from '@/lib/guardian/failureClass';

const http = (httpStatus: number) => ({ code: 'HTTP_ERROR', httpStatus });

test('classification of provider failures', () => {
    for (const status of [500, 503, 429, 408]) assert.equal(classifyLookupFailure(http(status)), 'TEMPORARY', String(status));
    assert.equal(classifyLookupFailure(http(401)), 'AUTHENTICATION');
    assert.equal(classifyLookupFailure(http(403)), 'AUTHENTICATION');
    assert.equal(classifyLookupFailure(http(400)), 'INVALID_INPUT');
    assert.equal(classifyLookupFailure(http(422)), 'INVALID_INPUT');
    assert.equal(classifyLookupFailure(http(410)), 'PERMANENT');
    assert.equal(classifyLookupFailure({ code: 'HTTP_ERROR' }), 'UNKNOWN');
    assert.equal(classifyLookupFailure({ code: 'MISSING_CREDENTIALS' }), 'AUTHENTICATION');
    assert.equal(classifyLookupFailure({ code: 'INVALID_FLIGHT_NUMBER' }), 'INVALID_INPUT');
    assert.equal(classifyLookupFailure({ code: 'QUOTA_BLOCKED' }), 'QUOTA');
    assert.equal(classifyLookupFailure({ code: 'NOT_FOUND' }), 'NOT_FOUND');
    assert.equal(classifyLookupFailure({ code: 'EXCEPTION', message: 'The operation was aborted due to timeout' }), 'TEMPORARY');
    assert.equal(classifyLookupFailure({ code: 'EXCEPTION', message: 'fetch failed' }), 'TEMPORARY');
    assert.equal(classifyLookupFailure({ code: 'EXCEPTION', message: 'Could not parse AeroDataBox response' }), 'UNKNOWN');
    assert.equal(classifyLookupFailure({ code: 'SOMETHING_NEW' }), 'UNKNOWN');
});

test('only TEMPORARY failures retry, and only up to MAX_CHECK_RETRIES redeliveries', () => {
    assert.equal(MAX_CHECK_RETRIES, 3);
    for (let retried = 0; retried < MAX_CHECK_RETRIES; retried++) assert.equal(shouldRetry('TEMPORARY', retried), true);
    assert.equal(shouldRetry('TEMPORARY', MAX_CHECK_RETRIES), false, 'bounded: no infinite QStash loop');
    for (const c of ['PERMANENT', 'QUOTA', 'AUTHENTICATION', 'NOT_FOUND', 'INVALID_INPUT', 'UNKNOWN'] as const) {
        assert.equal(shouldRetry(c, 0), false, `${c} never retries`);
    }
});

test('Upstash-Retried header parsing is defensive', () => {
    assert.equal(retriedFromHeader(null), 0);
    assert.equal(retriedFromHeader(''), 0);
    assert.equal(retriedFromHeader('abc'), 0);
    assert.equal(retriedFromHeader('-2'), 0);
    assert.equal(retriedFromHeader('2'), 2);
});

test('wiring: the retry exits before any snapshot or alert write, and the route answers 503 for RETRY', () => {
    const worker = readFileSync('workers/guardianWorker.ts', 'utf8');
    const retryAt = worker.indexOf("return { status: 'RETRY', reason: `${failureClass}");
    assert.ok(retryAt > 0);
    assert.ok(retryAt < worker.indexOf('applyFlightDataToTrip(trip.id, segment, flight)'));
    assert.ok(retryAt < worker.indexOf('deriveAndDispatchEvents({'));
    assert.ok(retryAt < worker.indexOf('tripSnapshot.upsert'), 'a retried check cannot create a snapshot');
    const route = readFileSync('app/api/guardian/check/route.ts', 'utf8');
    assert.match(route, /outcome\.status === 'RETRY' \? 503 : 200/);
    assert.match(route, /upstash-retried/);
});

test('wiring: a retried check gives its reserved provider call back', () => {
    const worker = readFileSync('workers/guardianWorker.ts', 'utf8');
    const block = worker.slice(worker.indexOf('if (shouldRetry('), worker.indexOf("return { status: 'RETRY', reason: `${failureClass}"));
    assert.match(block, /releaseProviderCall\(trip\.id\)/);
});

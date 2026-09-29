import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    TRACK_LIMIT_PER_EMAIL,
    TRACK_LIMIT_PER_IP,
    clientIpFromHeaders,
    evaluateTrackRateLimit,
    hashRequestIp,
} from '@/lib/guardian/trackRateLimit';

test('rate limit: allows under both limits', () => {
    assert.deepEqual(evaluateTrackRateLimit({ emailRecent: 0, ipRecent: 0 }), { allowed: true });
    assert.deepEqual(
        evaluateTrackRateLimit({ emailRecent: TRACK_LIMIT_PER_EMAIL - 1, ipRecent: TRACK_LIMIT_PER_IP - 1 }),
        { allowed: true },
    );
});

test('rate limit: blocks at the per-email limit (protects third-party inboxes)', () => {
    assert.deepEqual(
        evaluateTrackRateLimit({ emailRecent: TRACK_LIMIT_PER_EMAIL, ipRecent: 0 }),
        { allowed: false, reason: 'EMAIL_LIMIT' },
    );
});

test('rate limit: blocks at the per-IP limit; unknown IP only uses the email limit', () => {
    assert.deepEqual(
        evaluateTrackRateLimit({ emailRecent: 0, ipRecent: TRACK_LIMIT_PER_IP }),
        { allowed: false, reason: 'IP_LIMIT' },
    );
    assert.deepEqual(evaluateTrackRateLimit({ emailRecent: 0, ipRecent: null }), { allowed: true });
});

test('client IP: first x-forwarded-for hop, then x-real-ip, else null', () => {
    assert.equal(clientIpFromHeaders(new Headers({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' })), '203.0.113.5');
    assert.equal(clientIpFromHeaders(new Headers({ 'x-real-ip': '198.51.100.7' })), '198.51.100.7');
    assert.equal(clientIpFromHeaders(new Headers()), null);
});

test('IP hash: stable, keyed, never the raw IP', () => {
    const a = hashRequestIp('203.0.113.5', 'secret-a');
    assert.ok(a && /^[0-9a-f]{64}$/.test(a));
    assert.equal(hashRequestIp('203.0.113.5', 'secret-a'), a);
    assert.notEqual(hashRequestIp('203.0.113.5', 'secret-b'), a);
    assert.ok(!a!.includes('203.0.113.5'));
    assert.equal(hashRequestIp(null, 'secret-a'), null);
    assert.equal(hashRequestIp('203.0.113.5', undefined), null);
});

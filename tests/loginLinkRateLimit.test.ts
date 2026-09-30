import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    DEFAULT_LOGIN_LINK_GLOBAL_CAP,
    LOGIN_LINK_TTL_MS,
    MAX_OUTSTANDING_LOGIN_LINKS,
    isLoginLinkGlobalCapReached,
    isLoginLinkRateLimited,
    loginLinkGlobalCap,
    outstandingLoginLinkWindow,
} from '@/lib/auth/loginLinkRateLimit';

test('login links: per-address limit blocks at the outstanding limit', () => {
    assert.equal(isLoginLinkRateLimited(0), false);
    assert.equal(isLoginLinkRateLimited(MAX_OUTSTANDING_LOGIN_LINKS - 1), false);
    assert.equal(isLoginLinkRateLimited(MAX_OUTSTANDING_LOGIN_LINKS), true);
});

test('global cap: env value, default 30 for unset/invalid', () => {
    assert.equal(DEFAULT_LOGIN_LINK_GLOBAL_CAP, 30);
    assert.equal(loginLinkGlobalCap(undefined), 30);
    assert.equal(loginLinkGlobalCap(''), 30);
    assert.equal(loginLinkGlobalCap('abc'), 30);
    assert.equal(loginLinkGlobalCap('0'), 30);
    assert.equal(loginLinkGlobalCap('-5'), 30);
    assert.equal(loginLinkGlobalCap('2.5'), 30);
    assert.equal(loginLinkGlobalCap('100'), 100);
});

test('global cap: reached at >= cap', () => {
    assert.equal(isLoginLinkGlobalCapReached(29, 30), false);
    assert.equal(isLoginLinkGlobalCapReached(30, 30), true);
    assert.equal(isLoginLinkGlobalCapReached(31, 30), true);
});

test('global cap window counts 15-minute login links, not 24h opt-in tokens', () => {
    const now = new Date('2026-10-01T12:00:00Z');
    const w = outstandingLoginLinkWindow(now);
    const inWindow = (expiresAt: Date) => expiresAt > w.gt && expiresAt <= w.lte;
    assert.equal(inWindow(new Date(now.getTime() + LOGIN_LINK_TTL_MS)), true, 'fresh login link');
    assert.equal(inWindow(new Date(now.getTime() + 60_000)), true, 'login link about to expire');
    assert.equal(inWindow(new Date(now.getTime() + 24 * 3600_000)), false, 'fresh opt-in token');
    assert.equal(inWindow(new Date(now.getTime() - 1)), false, 'expired');
});

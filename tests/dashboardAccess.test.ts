import { test } from 'node:test';
import assert from 'node:assert/strict';

import { canEnterDashboard, isMagicLinkTripPath } from '@/lib/auth/dashboardAccess';

test('trip pages (any locale, subpages) accept a magic-link session', () => {
    for (const p of ['/dashboard/guardian/abc', '/tr/dashboard/guardian/abc', '/de/dashboard/guardian/abc/amenity', '/en/dashboard/guardian/abc/']) {
        assert.equal(isMagicLinkTripPath(p), true, p);
        assert.equal(canEnterDashboard({ pathname: p, hasNextAuthSession: false, hasValidMagicLinkSession: true }), true, p);
    }
});

test('other dashboard pages still require NextAuth', () => {
    for (const p of ['/dashboard', '/dashboard/guardian', '/dashboard/settings', '/tr/dashboard/routes/1']) {
        assert.equal(canEnterDashboard({ pathname: p, hasNextAuthSession: false, hasValidMagicLinkSession: true }), false, p);
        assert.equal(canEnterDashboard({ pathname: p, hasNextAuthSession: true, hasValidMagicLinkSession: false }), true, p);
    }
});

test('no session at all is rejected everywhere', () => {
    assert.equal(canEnterDashboard({ pathname: '/dashboard/guardian/abc', hasNextAuthSession: false, hasValidMagicLinkSession: false }), false);
});

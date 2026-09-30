import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MAX_OUTSTANDING_LOGIN_LINKS, isLoginLinkRateLimited } from '@/lib/auth/loginLinkRateLimit';

test('login links: allowed below the outstanding limit, blocked at it', () => {
    assert.equal(isLoginLinkRateLimited(0), false);
    assert.equal(isLoginLinkRateLimited(MAX_OUTSTANDING_LOGIN_LINKS - 1), false);
    assert.equal(isLoginLinkRateLimited(MAX_OUTSTANDING_LOGIN_LINKS), true);
    assert.equal(isLoginLinkRateLimited(MAX_OUTSTANDING_LOGIN_LINKS + 5), true);
});

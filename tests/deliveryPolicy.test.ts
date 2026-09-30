import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { isRealEmailDeliveryAllowed } from '@/lib/email/deliveryPolicy';

test('real email only in production or when explicitly forced', () => {
    assert.equal(isRealEmailDeliveryAllowed({ NODE_ENV: 'production' } as NodeJS.ProcessEnv), true);
    assert.equal(isRealEmailDeliveryAllowed({ NODE_ENV: 'development' } as NodeJS.ProcessEnv), false);
    assert.equal(isRealEmailDeliveryAllowed({ NODE_ENV: 'test' } as NodeJS.ProcessEnv), false);
    assert.equal(isRealEmailDeliveryAllowed({ NODE_ENV: 'development', EMAIL_FORCE_LIVE: 'true' } as NodeJS.ProcessEnv), true);
    assert.equal(isRealEmailDeliveryAllowed({ NODE_ENV: 'development', EMAIL_FORCE_LIVE: '1' } as NodeJS.ProcessEnv), false);
});

// Regression guard: every app-side Resend send point consults the policy
// before calling emails.send (dev DBs can be copies of prod with real users).
for (const file of ['lib/email/sender.ts', 'services/notifications/providers/resend.ts', 'services/notifications/sender.ts']) {
    test(`${file} checks the delivery policy`, () => {
        const src = readFileSync(file, 'utf8');
        assert.match(src, /isRealEmailDeliveryAllowed/);
    });
}

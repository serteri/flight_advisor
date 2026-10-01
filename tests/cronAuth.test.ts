import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { checkCronAuth } from '@/lib/auth/cronAuth';

test('cron auth fails closed when CRON_SECRET is unset', () => {
    assert.equal(checkCronAuth(null, undefined), 'NOT_CONFIGURED');
    assert.equal(checkCronAuth('Bearer anything', undefined), 'NOT_CONFIGURED');
    assert.equal(checkCronAuth('Bearer ', ''), 'NOT_CONFIGURED');
});

test('cron auth requires the exact bearer secret', () => {
    assert.equal(checkCronAuth('Bearer s3cret', 's3cret'), 'OK');
    assert.equal(checkCronAuth('Bearer wrong', 's3cret'), 'UNAUTHORIZED');
    assert.equal(checkCronAuth(null, 's3cret'), 'UNAUTHORIZED');
    assert.equal(checkCronAuth('s3cret', 's3cret'), 'UNAUTHORIZED');
});

test('trial-reminder uses the fail-closed check', () => {
    const src = readFileSync('app/api/cron/trial-reminder/route.ts', 'utf8');
    assert.match(src, /checkCronAuth\(/);
    assert.doesNotMatch(src, /if \(cronSecret && /, 'old fail-open check must not come back');
});

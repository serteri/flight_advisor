import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { isQStashPublishAllowed } from '@/lib/guardian/qstashPolicy';
import { publishDecision } from '@/lib/guardian/scheduler';

const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;

test('QStash publishes only from Vercel production (or QSTASH_FORCE_LIVE=true)', () => {
    assert.equal(isQStashPublishAllowed(env({ VERCEL_ENV: 'production' })), true);
    assert.equal(isQStashPublishAllowed(env({ VERCEL_ENV: 'preview', NODE_ENV: 'production' })), false);
    assert.equal(isQStashPublishAllowed(env({ NODE_ENV: 'production' })), false, 'local next start');
    assert.equal(isQStashPublishAllowed(env({ NODE_ENV: 'development' })), false);
    assert.equal(isQStashPublishAllowed(env({ QSTASH_FORCE_LIVE: 'true' })), true);
    assert.equal(isQStashPublishAllowed(env({ QSTASH_FORCE_LIVE: '1' })), false);
});

test('publish decision: store unpublished outside production even with a token', () => {
    assert.equal(publishDecision({ publishAllowed: false, hasToken: true }), 'STORE_UNPUBLISHED');
    assert.equal(publishDecision({ publishAllowed: false, hasToken: false }), 'STORE_UNPUBLISHED');
    assert.equal(publishDecision({ publishAllowed: true, hasToken: true }), 'PUBLISH');
    assert.equal(publishDecision({ publishAllowed: true, hasToken: false }), 'FAIL_NO_TOKEN');
});

test('scheduler gates the QStash client on the policy; backfill refuses unpublished --apply', () => {
    const scheduler = readFileSync('lib/guardian/scheduler.ts', 'utf8');
    assert.match(scheduler, /if \(!isQStashPublishAllowed\(\)\) return null;/);
    assert.doesNotMatch(scheduler, /NODE_ENV/);
    const backfill = readFileSync('scripts/backfill-checkpoints.ts', 'utf8');
    assert.match(backfill, /isQStashPublishAllowed\(\) \|\| !process\.env\.QSTASH_TOKEN/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Regression guard for the runtime env fail-fast (verified with `next start`:
// without it, prerendered pages returned 200 silently with env missing).
const src = readFileSync('proxy.ts', 'utf8');

test('proxy checks required env before anything else and answers 500', () => {
    const guard = src.indexOf('getMissingRequiredEnv()');
    const bypass = src.indexOf('apiBypass(req');
    assert.ok(guard > 0, 'env guard missing');
    assert.ok(guard < bypass, 'env guard must run before the API bypass');
    assert.match(src, /status: 500/);
    assert.match(src, /console\.error\(`\[Startup Fail-Fast:proxy\]/);
});

test('proxy matcher covers API routes', () => {
    const matcher = src.slice(src.indexOf('matcher'));
    assert.doesNotMatch(matcher, /\(\?!api\|/, '/api must not be excluded from the proxy');
});

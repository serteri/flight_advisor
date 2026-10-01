import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { PROD_CONFIRM_FLAG, databaseUrlFromEnvFile, parseDbArgs, resolveDbTarget } from '@/lib/ops/dbTarget';
import { backfillNeedsQStash, parseBackfillArgs } from '@/lib/guardian/backfill';

const PROD = 'postgresql://u:p@ep-gentle-math-a7ajyh5a-pooler.ap-southeast-2.aws.neon.tech/neondb';
const BRANCH = 'postgresql://u:p@ep-broad-boat-a7mh68j0-pooler.ap-southeast-2.aws.neon.tech/neondb';

test('default: .env.local branch URL is used', () => {
    const t = resolveDbTarget({ cliUrl: null, prodConfirmed: false, envLocalText: `DATABASE_URL="${BRANCH}"\n` });
    assert.ok(t.ok && !t.isProd && t.source === '.env.local' && t.host.startsWith('ep-broad-boat'));
});

test('prod host in .env.local is refused — even with the flag', () => {
    assert.equal(resolveDbTarget({ cliUrl: null, prodConfirmed: false, envLocalText: `DATABASE_URL=${PROD}` }).ok, false);
    assert.equal(resolveDbTarget({ cliUrl: null, prodConfirmed: true, envLocalText: `DATABASE_URL=${PROD}` }).ok, false);
});

test('prod via CLI requires the explicit flag', () => {
    const noFlag = resolveDbTarget({ cliUrl: PROD, prodConfirmed: false, envLocalText: null });
    assert.equal(noFlag.ok, false);
    const withFlag = resolveDbTarget({ cliUrl: PROD, prodConfirmed: true, envLocalText: `DATABASE_URL=${BRANCH}` });
    assert.ok(withFlag.ok && withFlag.isProd && withFlag.source === 'cli' && withFlag.url === PROD);
});

test('the flag with a non-prod URL is refused (no wrong URL under the flag)', () => {
    assert.equal(resolveDbTarget({ cliUrl: BRANCH, prodConfirmed: true, envLocalText: null }).ok, false);
});

test('a non-prod URL on the CLI works without the flag; garbage is refused', () => {
    const t = resolveDbTarget({ cliUrl: BRANCH, prodConfirmed: false, envLocalText: null });
    assert.ok(t.ok && !t.isProd);
    assert.equal(resolveDbTarget({ cliUrl: 'not a url', prodConfirmed: false, envLocalText: null }).ok, false);
    assert.equal(resolveDbTarget({ cliUrl: null, prodConfirmed: false, envLocalText: null }).ok, false);
});

test('.env.local parsing is BOM-safe and ignores other keys', () => {
    assert.equal(databaseUrlFromEnvFile(`﻿DATABASE_URL=${BRANCH}\nOTHER=x`), BRANCH);
    assert.equal(databaseUrlFromEnvFile('OTHER=x'), null);
});

test('CLI parsing: both --database-url forms and the flag are consumed', () => {
    assert.deepEqual(parseDbArgs(['--complete-past', '--database-url', PROD, PROD_CONFIRM_FLAG, '--dry-run']), {
        cliUrl: PROD, prodConfirmed: true, rest: ['--complete-past', '--dry-run'],
    });
    assert.equal(parseDbArgs([`--database-url=${BRANCH}`]).cliUrl, BRANCH);
});

test('backfill modes: complete-past never needs QStash; scheduling --apply does', () => {
    const cp = parseBackfillArgs(['--complete-past', '--apply']);
    assert.ok(cp.ok && cp.mode === 'COMPLETE_PAST' && cp.apply);
    assert.equal(backfillNeedsQStash('COMPLETE_PAST', true), false);
    assert.equal(backfillNeedsQStash('SCHEDULE', true), true);
    assert.equal(backfillNeedsQStash('SCHEDULE', false), false);
    const dry = parseBackfillArgs(['--complete-past', '--dry-run']);
    assert.ok(dry.ok && dry.mode === 'COMPLETE_PAST' && !dry.apply);
    assert.equal(parseBackfillArgs(['--apply', '--dry-run']).ok, false);
    assert.equal(parseBackfillArgs(['--typo']).ok, false);
});

test('backfill script resolves the DB target and never reads DATABASE_URL from .env itself', () => {
    const src = readFileSync('scripts/backfill-checkpoints.ts', 'utf8');
    assert.match(src, /resolveDbTarget\(/);
    assert.match(src, /process\.env\.DATABASE_URL = target\.url;/);
    // prisma is imported only after the target is set
    assert.ok(src.indexOf("await import('@/lib/prisma')") > src.indexOf('process.env.DATABASE_URL = target.url'));
    assert.doesNotMatch(src.replace(/\/\/.*$/gm, ''), /new URL\(process\.env\.DATABASE_URL/);
});

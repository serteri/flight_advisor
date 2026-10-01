import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// The Ignored Build Step must never skip production. The old rule
// `[ "$VERCEL_ENV" != "production" ]` skipped the production deploy of the
// merge commit when VERCEL_ENV was empty during that step. Only an explicit
// "preview" may skip; empty/unknown values build.
const cmd: string = JSON.parse(readFileSync('vercel.json', 'utf8')).ignoreCommand;

test('ignoreCommand skips only explicit preview builds', () => {
    assert.equal(cmd, '[ "$VERCEL_ENV" = "preview" ]');
});

test('ignoreCommand outcome per VERCEL_ENV (exit 0 = skip, 1 = build)', (t) => {
    const probe = spawnSync('sh', ['-c', 'exit 0']);
    if (probe.error) { t.skip('sh not available'); return; }
    const run = (value: string) => spawnSync('sh', ['-c', cmd], { env: { ...process.env, VERCEL_ENV: value } }).status;
    assert.equal(run('preview'), 0, 'preview is skipped');
    assert.equal(run('production'), 1, 'production builds');
    assert.equal(run(''), 1, 'empty VERCEL_ENV builds (never blocks production)');
    assert.equal(run('development'), 1);
});

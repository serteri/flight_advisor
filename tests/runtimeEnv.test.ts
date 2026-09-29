import { test } from 'node:test';
import assert from 'node:assert/strict';

import { assertRequiredRuntimeEnv } from '@/lib/config/runtimeEnv';

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
    const prev: Record<string, string | undefined> = {};
    for (const k of Object.keys(vars)) { prev[k] = process.env[k]; if (vars[k] === undefined) delete process.env[k]; else process.env[k] = vars[k]; }
    try { fn(); } finally { for (const k of Object.keys(prev)) { if (prev[k] === undefined) delete process.env[k]; else process.env[k] = prev[k]; } }
}

test('fail-fast throws at runtime when required env is missing', () => {
    withEnv({ NEXT_PHASE: undefined, NOTIFICATION_FROM_EMAIL: undefined, APP_BASE_URL: undefined }, () => {
        assert.throws(() => assertRequiredRuntimeEnv('test'), /NOTIFICATION_FROM_EMAIL/);
    });
});

test('fail-fast does not break next build (phase-production-build)', () => {
    withEnv({ NEXT_PHASE: 'phase-production-build', NOTIFICATION_FROM_EMAIL: undefined, APP_BASE_URL: undefined }, () => {
        assert.doesNotThrow(() => assertRequiredRuntimeEnv('test'));
    });
});

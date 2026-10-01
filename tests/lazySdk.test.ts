import { test } from 'node:test';
import assert from 'node:assert/strict';

// `next build` imports API routes while collecting page data. SDK clients must
// not be constructed at module load, or a missing key fails the whole build
// (this happened with Amadeus and Stripe when built without env vars).
test('importing lib/stripe and lib/amadeus without keys does not throw', async () => {
    const saved = { s: process.env.STRIPE_SECRET_KEY, a: process.env.AMADEUS_API_KEY, b: process.env.AMADEUS_API_SECRET };
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.AMADEUS_API_KEY;
    delete process.env.AMADEUS_API_SECRET;
    try {
        const stripeMod = await import('@/lib/stripe');
        const amadeusMod = await import('@/lib/amadeus');
        assert.ok(stripeMod.stripe);
        assert.ok(amadeusMod.default);
    } finally {
        if (saved.s !== undefined) process.env.STRIPE_SECRET_KEY = saved.s;
        if (saved.a !== undefined) process.env.AMADEUS_API_KEY = saved.a;
        if (saved.b !== undefined) process.env.AMADEUS_API_SECRET = saved.b;
    }
});

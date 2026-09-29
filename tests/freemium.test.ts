import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FREE_TIER_LIMITS } from '@/lib/freemium/limits';
import { isMeteredFeature } from '@/lib/freemium/usage';

test('Free plan includes the basic claim letter (no 402)', () => {
    assert.equal(FREE_TIER_LIMITS.compensationLetters, true);
    // Boolean limits are not metered, so the gate never counts them down.
    assert.equal(isMeteredFeature('compensation_letter'), false);
});

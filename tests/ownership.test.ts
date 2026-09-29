import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isOwnedBy } from '@/lib/auth/ownership';
import { isListedAdminEmail } from '@/lib/auth/adminEmails';

test('isOwnedBy: owner matches', () => {
    assert.equal(isOwnedBy({ userId: 'u1' }, 'u1'), true);
});

test('isOwnedBy: other user is rejected', () => {
    assert.equal(isOwnedBy({ userId: 'u1' }, 'u2'), false);
});

test('isOwnedBy: missing record or caller is rejected', () => {
    assert.equal(isOwnedBy(null, 'u1'), false);
    assert.equal(isOwnedBy(undefined, 'u1'), false);
    assert.equal(isOwnedBy({ userId: 'u1' }, null), false);
    assert.equal(isOwnedBy({ userId: 'u1' }, ''), false);
});

test('isOwnedBy: ownerless (lead) record never matches, even a null caller', () => {
    assert.equal(isOwnedBy({ userId: null }, null), false);
    assert.equal(isOwnedBy({ userId: null }, 'u1'), false);
});

test('isListedAdminEmail: unset or empty list grants nobody', () => {
    assert.equal(isListedAdminEmail('', undefined), false);
    assert.equal(isListedAdminEmail(null, ''), false);
    assert.equal(isListedAdminEmail('', ''), false, 'regression: "".split(",") used to yield [""]');
    assert.equal(isListedAdminEmail('a@x.io', ' , '), false);
});

test('isListedAdminEmail: listed email is admin, case/space-insensitive', () => {
    assert.equal(isListedAdminEmail('A@x.io ', 'b@x.io, a@x.io'), true);
    assert.equal(isListedAdminEmail('c@x.io', 'b@x.io, a@x.io'), false);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { isAdminEmail } from '@/lib/auth/adminAccess';

test('admin rule: only the configured ADMIN_EMAIL, case-insensitive', () => {
    assert.equal(isAdminEmail('Boss@Example.com', 'boss@example.com'), true);
    assert.equal(isAdminEmail(' boss@example.com ', ' BOSS@example.com'), true);
    assert.equal(isAdminEmail('other@example.com', 'boss@example.com'), false);
});

test('admin rule: no ADMIN_EMAIL or no signed-in email grants nobody', () => {
    assert.equal(isAdminEmail('boss@example.com', undefined), false);
    assert.equal(isAdminEmail('boss@example.com', ''), false);
    assert.equal(isAdminEmail('boss@example.com', '   '), false);
    assert.equal(isAdminEmail(null, 'boss@example.com'), false);
    assert.equal(isAdminEmail(undefined, undefined), false);
});

test('/admin/guardian authorizes before it reads any data and 404s non-admins', () => {
    const page = readFileSync('app/[locale]/admin/guardian/page.tsx', 'utf8');
    const authAt = page.indexOf('if (!isAdmin(email)) notFound();');
    assert.ok(authAt > 0, 'uses the existing isAdmin convention');
    assert.ok(authAt < page.indexOf('await Promise.all([getGuardianOpsSnapshot()'));
    assert.ok(authAt < page.indexOf('getEmailReadiness()'));
});

test('the ops snapshot and page select no personal data', () => {
    const code = (path: string) => readFileSync(path, 'utf8').split(/\r?\n/).filter((l) => !l.trim().startsWith('//')).join(' ');
    const snapshot = code('lib/guardian/opsSnapshot.ts');
    const page = code('app/[locale]/admin/guardian/page.tsx');
    for (const src of [snapshot, page]) {
        assert.doesNotMatch(src, /subscriberEmail|passenger|fullName|email:\s*true|user:\s*\{/i);
    }
    assert.doesNotMatch(page, /\{process\.env/, 'env values are never rendered');
});

test('currentUser.isAdmin delegates to the shared rule', () => {
    assert.match(readFileSync('lib/auth/currentUser.ts', 'utf8'), /return isAdminEmail\(email\)/);
});

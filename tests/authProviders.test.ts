import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Provider constructor in lib/auth.ts -> the provider id signIn() uses.
const PROVIDER_IDS: Record<string, string> = {
    Google: 'google',
    GitHub: 'github',
    MicrosoftEntraID: 'microsoft-entra-id',
    Credentials: 'credentials',
};

const codeOnly = (path: string) =>
    readFileSync(path, 'utf8')
        .split(/\r?\n/)
        .filter((line) => !line.trim().startsWith('//'))
        .join('\n');

function enabledProviderIds(): Set<string> {
    // Block comments are not used around providers; line comments are stripped.
    const src = codeOnly('lib/auth.ts');
    const ids = new Set<string>();
    for (const [ctor, id] of Object.entries(PROVIDER_IDS)) {
        if (new RegExp(`\\b${ctor}\\(\\{`).test(src)) ids.add(id);
    }
    return ids;
}

test('every provider a login button signs in with is enabled in the mounted auth handler', () => {
    const enabled = enabledProviderIds();
    const pages = ['app/[locale]/(auth)/login/page.tsx', 'app/[locale]/(auth)/register/page.tsx'];
    for (const page of pages) {
        const src = readFileSync(page, 'utf8').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
        for (const match of src.matchAll(/signIn\(\s*"([^"]+)"/g)) {
            assert.ok(enabled.has(match[1]), `${page} signs in with "${match[1]}" but lib/auth.ts does not enable it`);
        }
    }
});

test('the mounted handler is lib/auth.ts, and Google + credentials are enabled', () => {
    assert.match(readFileSync('app/api/auth/[...nextauth]/route.ts', 'utf8'), /from "@\/lib\/auth"/);
    const enabled = enabledProviderIds();
    assert.ok(enabled.has('google'));
    assert.ok(enabled.has('credentials'));
});

test('Microsoft sign-in is hidden while lib/auth.ts has no Entra ID provider', () => {
    const enabled = enabledProviderIds();
    const login = readFileSync('app/[locale]/(auth)/login/page.tsx', 'utf8').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    assert.equal(enabled.has('microsoft-entra-id'), false);
    assert.doesNotMatch(login, /microsoft-entra-id|signInWithMicrosoft/);
});

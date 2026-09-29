import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

// Regression guard: every API route that reaches the paid Amadeus client must
// require a session before doing anything else. (These routes were public.)

function routeFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) return routeFiles(full);
        return name === 'route.ts' ? [full] : [];
    });
}

const amadeusRoutes = routeFiles(path.join(process.cwd(), 'app', 'api'))
    .filter((file) => /@\/lib\/amadeus|getAmadeusClient|services\/flight\/(booking|schedule|seatmap)/.test(readFileSync(file, 'utf8')));

test('Amadeus-backed API routes exist (guard is actually checking something)', () => {
    assert.ok(amadeusRoutes.length >= 5, `found ${amadeusRoutes.length}`);
});

for (const file of amadeusRoutes) {
    const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
    test(`${rel} requires a session before calling Amadeus`, () => {
        const src = readFileSync(file, 'utf8');
        const guard = src.search(/if \(!userId\) \{\s*return NextResponse\.json\(\{ error: 'Unauthorized' \}, \{ status: 401 \}\)/);
        assert.ok(guard > 0, 'missing 401 session guard');
        const firstCall = src.search(/getAmadeusClient\(\)|amadeus\.|validateAndFetchPNR\(|getRealFlightDetails\(/);
        assert.ok(firstCall === -1 || guard < firstCall, 'guard must come before the first Amadeus call');
        assert.doesNotMatch(src, /console\.log\([^)]*[Aa]madeus(Instance)?\b[^)]*\)/, 'must not log the Amadeus client');
    });
}

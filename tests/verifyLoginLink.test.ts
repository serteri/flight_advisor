import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { verifyLoginLink, type VerifyDeps } from '@/lib/auth/verifyLoginLink';
import { parseAeroDataBoxResponse } from '@/lib/flightData/aerodatabox';

const realError = console.error;
afterEach(() => { console.error = realError; });

const future = new Date(Date.now() + 10 * 60_000);
const past = new Date(Date.now() - 60_000);

function makeDeps(over: Partial<VerifyDeps> = {}) {
    const state = { consumed: [] as string[], confirmed: [] as string[] };
    const deps: VerifyDeps = {
        findToken: async () => ({ identifier: 'u@example.com', expiresAt: future }),
        consumeToken: async (t) => { state.consumed.push(t); return true; },
        upsertUser: async () => ({ id: 'user_1' }),
        confirmPendingTrips: async (id) => { state.confirmed.push(id); return []; },
        ...over,
    };
    return { deps, state };
}

test('valid token: consumed, user resolved, trips confirmed', async () => {
    const { deps, state } = makeDeps();
    assert.deepEqual(await verifyLoginLink('t1', deps), { kind: 'ok', userId: 'user_1' });
    assert.deepEqual(state.consumed, ['t1']);
    assert.deepEqual(state.confirmed, ['user_1']);
});

test('trip activation failure (provider/QStash/DB) never blocks login; token already consumed', async () => {
    const logged: string[] = [];
    console.error = (...a: unknown[]) => { logged.push(a.join(' ')); };
    const { deps, state } = makeDeps({ confirmPendingTrips: async () => { throw new Error('QStash publish failed: 401'); } });
    assert.deepEqual(await verifyLoginLink('t1', deps), { kind: 'ok', userId: 'user_1' });
    assert.deepEqual(state.consumed, ['t1']);
    assert.ok(logged.some((l) => l.includes('trip confirmation failed') && l.includes('user_1')));
});

test('unknown, expired and already-used tokens are "expired", never thrown', async () => {
    assert.deepEqual(await verifyLoginLink('x', makeDeps({ findToken: async () => null }).deps), { kind: 'expired' });

    const expired = makeDeps({ findToken: async () => ({ identifier: 'u@example.com', expiresAt: past }) });
    assert.deepEqual(await verifyLoginLink('x', expired.deps), { kind: 'expired' });
    assert.deepEqual(expired.state.consumed, ['x'], 'expired token is still removed');
    assert.deepEqual(expired.state.confirmed, []);

    // Two concurrent clicks: only the one that deleted the row proceeds.
    const raced = makeDeps({ consumeToken: async () => false });
    assert.deepEqual(await verifyLoginLink('x', raced.deps), { kind: 'expired' });
    assert.deepEqual(raced.state.confirmed, []);
});

test('DB failures become "failed" (logged), not an exception', async () => {
    const logged: unknown[][] = [];
    console.error = (...a: unknown[]) => { logged.push(a); };
    for (const over of [
        { findToken: async () => { throw new Error('connection refused'); } },
        { consumeToken: async () => { throw new Error('deadlock'); } },
        { upsertUser: async () => { throw new Error('unique violation'); } },
    ] as Partial<VerifyDeps>[]) {
        assert.deepEqual(await verifyLoginLink('x', makeDeps(over).deps), { kind: 'failed' });
    }
    assert.equal(logged.length, 3);
});

// Shapes AeroDataBox can return for a flight that doesn't exist / isn't
// scheduled yet. None of these may be treated as a real flight.
test('AeroDataBox non-flight bodies parse to null (no phantom flight)', () => {
    for (const body of [[], {}, null, undefined, '', { message: 'Flight not found' }, [{}], [null], [{ number: 'TK 1234' }]]) {
        assert.equal(parseAeroDataBoxResponse(body, 'TK1234', '2026-10-14', 'LIVE'), null, JSON.stringify(body));
    }
});

test('AeroDataBox real-shaped leg (TK1234-like) still parses; codeshare operator wins', () => {
    const leg = (code: string, share: string) => ({
        greatCircleDistance: { meter: 2_800_000, km: 2800, mile: 1740, nauticalMile: 1511, feet: 9_186_000 },
        departure: {
            airport: { icao: 'LTFM', iata: 'IST', name: 'Istanbul', timeZone: 'Europe/Istanbul', countryCode: 'TR', location: { lat: 41.27, lon: 28.75 } },
            scheduledTime: { utc: '2026-10-14 08:05Z', local: '2026-10-14 11:05+03:00' },
            terminal: 'I',
            quality: ['Basic', 'Live'],
        },
        arrival: {
            airport: { icao: 'EGLL', iata: 'LHR', name: 'London Heathrow', timeZone: 'Europe/London', countryCode: 'GB' },
            scheduledTime: { utc: '2026-10-14 11:55Z', local: '2026-10-14 12:55+01:00' },
            quality: ['Basic'],
        },
        lastUpdatedUtc: '2026-10-13 21:00Z',
        number: code,
        status: 'Expected',
        codeshareStatus: share,
        isCargo: false,
        aircraft: { model: 'Airbus A321' },
        airline: { name: 'Turkish Airlines', iata: 'TK', icao: 'THY' },
    });
    const flight = parseAeroDataBoxResponse([leg('XX 9', 'IsCodeshared'), leg('TK 1234', 'IsOperator')], 'TK1234', '2026-10-14', 'LIVE')!;
    assert.equal(flight.origin.iata, 'IST');
    assert.equal(flight.destination.iata, 'LHR');
    assert.equal(flight.routeKnown, true);
    assert.equal(flight.scheduledDepartureUtc, '2026-10-14T08:05:00.000Z');
    assert.equal(flight.status, 'scheduled');
});

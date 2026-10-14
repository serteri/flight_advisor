import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prisma } from '../lib/prisma';
import { findNextCheckAt, refreshNextCheckAt, type NextCheckStore } from '../lib/guardian/nextCheck';
import { initializeTripMonitoring, replanTripChecks } from '../lib/guardian/tripLifecycle';
import { planCheckpoints, monitoringEndsAt } from '../lib/guardian/checkpoints';
import { processTripCheck } from '../workers/guardianWorker';

const now = new Date('2026-10-14T01:14:37.837Z');
const schedule = { departureUtc: new Date('2026-10-15T08:15:00Z'), arrivalUtc: new Date('2026-10-15T09:50:00Z'), approximate: false };

test('verified initialization and replan synchronize nextCheckAt without a provider run or duplicate active checks', async () => {
    const previous = { vercel: process.env.VERCEL_ENV, live: process.env.QSTASH_FORCE_LIVE };
    process.env.VERCEL_ENV = 'development';
    delete process.env.QSTASH_FORCE_LIVE;
    const trip = { id: 'fixture', status: 'ACTIVE', flightVerifiedAt: now, lastCheckedAt: null, nextCheckAt: now, monitoringEndsAt: null as Date | null, segments: [{ id: 'seg', airlineCode: 'QF', flightNumber: '549', origin: 'BNE', destination: 'SYD', departureDate: new Date('2026-10-15'), arrivalDate: schedule.arrivalUtc, scheduledDepartureUtc: schedule.departureUtc, scheduledArrivalUtc: schedule.arrivalUtc }] };
    const rows: Array<{ id: string; kind: string; runAt: Date; status: string; tripId: string }> = [];
    const restores: Array<() => void> = [];
    const stub = (target: object, key: string, replacement: unknown) => {
        const original = Reflect.get(target, key);
        Reflect.set(target, key, replacement);
        restores.push(() => { Reflect.set(target, key, original); });
    };
    stub(prisma.monitoredTrip, 'findUnique', async () => trip);
    stub(prisma.monitoredTrip, 'update', async ({ data }: { data: object }) => { Object.assign(trip, data); return trip; });
    stub(prisma.scheduledTripCheck, 'findMany', async () => rows.filter(r => r.status === 'SCHEDULED'));
    stub(prisma.scheduledTripCheck, 'updateMany', async () => { const active = rows.filter(r => r.status === 'SCHEDULED'); active.forEach(r => r.status = 'CANCELLED'); return { count: active.length }; });
    stub(prisma.scheduledTripCheck, 'create', async ({ data }: { data: { kind: string; runAt: Date; tripId: string } }) => { const row = { ...data, id: String(rows.length), status: 'SCHEDULED' }; rows.push(row); return row; });
    stub(prisma.scheduledTripCheck, 'findFirst', async ({ where }: { where: { runAt: { gt: Date }; id?: { not: string } } }) => rows.filter(r => r.status === 'SCHEDULED' && r.runAt > where.runAt.gt && r.id !== where.id?.not).sort((a, b) => +a.runAt - +b.runAt)[0] ?? null);
    try {
        await initializeTripMonitoring(trip.id, now);
        assert.equal(trip.nextCheckAt.toISOString(), '2026-10-14T08:15:00.000Z');
        assert.equal(trip.lastCheckedAt, null);
        assert.equal(rows.filter(r => r.status === 'SCHEDULED').length, 6);
        await replanTripChecks(trip.id, { ...schedule, departureUtc: new Date('2026-10-15T10:15:00Z') }, now);
        assert.equal(trip.nextCheckAt.toISOString(), '2026-10-14T10:15:00.000Z');
        assert.equal(rows.filter(r => r.status === 'SCHEDULED').length, 6);
        assert.equal(new Set(rows.filter(r => r.status === 'SCHEDULED').map(r => r.kind)).size, 6);
        assert.equal(trip.lastCheckedAt, null);
    } finally {
        restores.reverse().forEach(restore => restore());
        if (previous.vercel === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = previous.vercel;
        if (previous.live === undefined) delete process.env.QSTASH_FORCE_LIVE; else process.env.QSTASH_FORCE_LIVE = previous.live;
    }
});

test('worker selection excludes current, overdue, completed and failed checks; falls back to monitoring end', async () => {
    const rows = [
        { id: 'past', runAt: now, status: 'SCHEDULED' },
        { id: 'current', runAt: new Date('2026-10-14T08:15:00Z'), status: 'SCHEDULED' },
        { id: 'failed', runAt: new Date('2026-10-14T09:15:00Z'), status: 'FAILED' },
        { id: 'done', runAt: new Date('2026-10-14T10:15:00Z'), status: 'DONE' },
        { id: 'next', runAt: new Date('2026-10-15T05:15:00Z'), status: 'SCHEDULED' },
    ];
    let end: Date | null = monitoringEndsAt(schedule);
    let stored: unknown;
    const store: NextCheckStore = {
        scheduledTripCheck: { findFirst: async args => {
            const where = args.where!;
            assert.equal(where.status, 'SCHEDULED');
            const cutoff = (where.runAt as { gt: Date }).gt;
            const excluded = (where.id as { not: string } | undefined)?.not;
            return rows.filter(r => r.status === where.status && r.runAt > cutoff && r.id !== excluded).sort((a, b) => +a.runAt - +b.runAt)[0] ?? null;
        } },
        monitoredTrip: { findUnique: async () => ({ monitoringEndsAt: end }), update: async args => { stored = args.data; } },
    };
    await refreshNextCheckAt('fixture', now, 'current', store);
    assert.deepEqual(stored, { nextCheckAt: rows[4].runAt });
    rows.length = 0;
    assert.equal(await findNextCheckAt('fixture', now, undefined, store), end);
    end = null;
    assert.equal(await findNextCheckAt('fixture', now, undefined, store), null);
    const worker = readFileSync('workers/guardianWorker.ts', 'utf8');
    assert.match(worker, /findNextCheckAt\(trip.id, now, ctx.check\?\.id\)/);
    assert.match(worker, /data: \{ lastCheckedAt: now, \.\.\.\(nextCheckAt/);
    assert.doesNotMatch(worker, /status: 'COMPLETED', lastCheckedAt/);
});

test('QF549 milestone order and exact UTC instants', () => {
    assert.deepEqual(planCheckpoints(schedule, now).map(c => [c.kind, c.runAt.toISOString()]), [
        ['DEP_MINUS_24H', '2026-10-14T08:15:00.000Z'],
        ['DEP_MINUS_3H', '2026-10-15T05:15:00.000Z'],
        ['DEP', '2026-10-15T08:15:00.000Z'],
        ['ARR_PLUS_1H', '2026-10-15T10:50:00.000Z'],
        ['ARR_PLUS_4H', '2026-10-15T13:50:00.000Z'],
        ['COMPLETE', '2026-10-17T09:50:00.000Z'],
    ]);
});

test('successful worker/provider completion advances the persisted next checkpoint and records the real run', async () => {
    const savedEnv = { vercel: process.env.VERCEL_ENV, live: process.env.AERODATABOX_FORCE_LIVE };
    process.env.VERCEL_ENV = 'development';
    delete process.env.AERODATABOX_FORCE_LIVE;
    const run = new Date('2026-10-14T08:00:00Z');
    const next = new Date('2026-10-15T05:00:00Z');
    const seg = { id: 'seg', airlineCode: 'XX', flightNumber: '1000', origin: 'FRA', destination: 'MAD', departureDate: new Date('2026-10-15'), arrivalDate: new Date('2026-10-15T10:30:00Z'), scheduledDepartureUtc: new Date('2026-10-15T08:00:00Z'), scheduledArrivalUtc: new Date('2026-10-15T10:30:00Z'), aircraftType: 'Airbus A320' };
    const trip = { id: 'worker-fixture', status: 'ACTIVE', lastCheckedAt: null as Date | null, nextCheckAt: run, monitoringEndsAt: new Date('2026-10-17T10:30:00Z'), segments: [seg], snapshot: { status: 'ON_TIME', delayMinutes: 0, departureGate: 'A26', arrivalGate: 'D8' }, user: null };
    const rows = [{ id: 'current', tripId: trip.id, kind: 'DEP_MINUS_24H', runAt: run, status: 'SCHEDULED' }, { id: 'next', tripId: trip.id, kind: 'DEP_MINUS_3H', runAt: next, status: 'SCHEDULED' }];
    const restores: Array<() => void> = [];
    const stub = (target: object, key: string, replacement: unknown) => {
        const original = Reflect.get(target, key);
        Reflect.set(target, key, replacement);
        restores.push(() => { Reflect.set(target, key, original); });
    };
    stub(prisma.monitoredTrip, 'findUnique', async () => trip);
    stub(prisma.monitoredTrip, 'updateMany', async () => ({ count: 1 }));
    stub(prisma.monitoredTrip, 'update', async ({ data }: { data: object }) => { Object.assign(trip, data); return trip; });
    stub(prisma.flightSegment, 'update', async ({ data }: { data: object }) => ({ ...seg, ...data }));
    stub(prisma.scheduledTripCheck, 'findUnique', async () => rows[0]);
    stub(prisma.scheduledTripCheck, 'findFirst', async ({ where }: { where: { id: { not: string }; runAt: { gt: Date } } }) => {
        assert.equal(where.id.not, 'current');
        assert.equal(where.runAt.gt, run);
        return rows[1];
    });
    stub(prisma.scheduledTripCheck, 'update', async ({ data }: { data: object }) => { Object.assign(rows[0], data); return rows[0]; });
    stub(prisma.tripSnapshot, 'upsert', async () => ({}));
    stub(prisma, '$transaction', async (operations: Promise<unknown>[]) => Promise.all(operations));
    try {
        const outcome = await processTripCheck(trip.id, 'current', run);
        assert.equal(outcome.status, 'DONE');
        assert.equal(trip.lastCheckedAt, run);
        assert.equal(trip.nextCheckAt, next);
        assert.equal(rows[0].status, 'DONE');
        assert.equal(rows.length, 2);
    } finally {
        restores.reverse().forEach(restore => restore());
        if (savedEnv.vercel === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = savedEnv.vercel;
        if (savedEnv.live === undefined) delete process.env.AERODATABOX_FORCE_LIVE; else process.env.AERODATABOX_FORCE_LIVE = savedEnv.live;
    }
});

test('UI does not substitute creation snapshot for a real monitoring run', () => {
    const ui = readFileSync('app/[locale]/dashboard/guardian/[id]/TripDetailsClient.tsx', 'utf8');
    assert.match(ui, /const latestRunAt = trip.lastCheckedAt;/);
    assert.match(ui, /t\('notCheckedYet'\)/);
    assert.match(ui, /t\('notScheduled'\)/);
});

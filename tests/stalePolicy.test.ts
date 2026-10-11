import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { publishDueChecks, type DueRow, type PublishDueDeps } from '@/lib/guardian/publishDue';
import { ORPHAN_AFTER_MS, STALE_AFTER_MS, staleVerdict } from '@/lib/guardian/publishWindow';

const HOUR = 60 * 60 * 1000;
const realWarn = console.warn;
afterEach(() => { console.warn = realWarn; });

type Row = DueRow & { status: string; messageId: string | null; error: string | null };

// In-memory ScheduledTripCheck table behind the same deps the real publisher uses.
function world(now: Date) {
    const rows = new Map<string, Row>();
    const publishedAt = new Map<string, number>();
    let seq = 0;
    const deps: PublishDueDeps = {
        resetMaxDelayFailures: async () => 0,
        findUnpublished: async () =>
            [...rows.values()].filter((r) => r.status === 'SCHEDULED' && (!r.messageId || (now.getTime() - r.runAt.getTime() > ORPHAN_AFTER_MS && now.getTime() - (publishedAt.get(r.id) ?? 0) > ORPHAN_AFTER_MS))),
        publish: async () => `msg_${++seq}`,
        markPublished: async (id, messageId) => { const r = rows.get(id)!; r.messageId = messageId; publishedAt.set(id, now.getTime()); },
        markFailed: async (id, error) => { const r = rows.get(id)!; r.status = 'FAILED'; r.error = error; },
        markSkipped: async (id, reason) => { const r = rows.get(id)!; r.status = 'SKIPPED'; r.error = reason; },
    };
    const add = (id: string, tripId: string, kind: string, ageHours: number, extra: Partial<Row> = {}) =>
        rows.set(id, {
            id, tripId, kind, runAt: new Date(now.getTime() - ageHours * HOUR),
            monitoringEndsAt: new Date(now.getTime() + 30 * HOUR),
            status: 'SCHEDULED', messageId: null, error: null, ...extra,
        });
    return { rows, deps, add };
}

test('stale verdicts: obsolete pre-departure checks skip; arrival-side and COMPLETE still run', () => {
    const now = new Date('2026-10-10T12:00:00Z');
    const ends = new Date(now.getTime() + 20 * HOUR);
    const mk = (kind: string) => ({ id: kind, tripId: 't', kind, runAt: new Date(now.getTime() - 30 * HOUR), monitoringEndsAt: ends });
    for (const kind of ['DEP_MINUS_24H', 'DEP_MINUS_3H', 'DEP']) assert.equal(staleVerdict(mk(kind), now).action, 'SKIP', kind);
    for (const kind of ['ARR_PLUS_1H', 'ARR_PLUS_4H', 'EXTRA_ARR_PLUS_1H', 'COMPLETE']) assert.equal(staleVerdict(mk(kind), now).action, 'RUN_LATE', kind);
    // After the monitoring window there is nothing left to protect.
    assert.equal(staleVerdict({ ...mk('ARR_PLUS_4H'), monitoringEndsAt: new Date(now.getTime() - HOUR) }, now).action, 'SKIP');
});

test('one missed publisher run: rows overdue by less than 24h are published late, none lost', async () => {
    const now = new Date('2026-10-10T03:00:00Z');
    const w = world(now);
    w.add('a', 't', 'DEP_MINUS_3H', 20);
    w.add('b', 't', 'DEP', 17);
    w.add('c', 't', 'ARR_PLUS_1H', 14);
    const s = await publishDueChecks(now, w.deps);
    assert.deepEqual({ published: s.published, stale: s.stale }, { published: 3, stale: 0 });
});

test('multi-day outage: one arrival-side catch-up per trip; obsolete and superseded rows are SKIPPED with a reason', async () => {
    const now = new Date('2026-10-10T03:00:00Z');
    console.warn = () => {};
    const w = world(now);
    w.add('d1', 'T', 'DEP', 40);
    w.add('a1', 'T', 'ARR_PLUS_1H', 38);
    w.add('a4', 'T', 'ARR_PLUS_4H', 35);
    w.add('cx', 'T', 'COMPLETE', 25);
    const s = await publishDueChecks(now, w.deps);
    assert.equal(s.published, 2, 'ARR_PLUS_4H and COMPLETE');
    assert.equal(s.recovered, 2);
    assert.equal(s.stale, 2, 'DEP obsolete, ARR_PLUS_1H superseded');
    assert.equal(w.rows.get('d1')!.status, 'SKIPPED');
    assert.equal(w.rows.get('a1')!.status, 'SKIPPED');
    assert.match(w.rows.get('a1')!.error!, /superseded/);
    assert.ok(w.rows.get('a4')!.messageId && w.rows.get('cx')!.messageId);
});

test('trips are independent: each keeps its own catch-up check', async () => {
    const now = new Date('2026-10-10T03:00:00Z');
    console.warn = () => {};
    const w = world(now);
    w.add('x', 'T1', 'ARR_PLUS_4H', 30);
    w.add('y', 'T2', 'ARR_PLUS_4H', 30);
    assert.equal((await publishDueChecks(now, w.deps)).published, 2);
});

test('orphans: a published row QStash lost is republished; a fresh in-flight row is left alone', async () => {
    const now = new Date('2026-10-10T12:00:00Z');
    const w = world(now);
    w.add('lost', 't', 'DEP', 3, { messageId: 'msg_old' });
    w.add('inflight', 't', 'DEP', 10 / 60, { messageId: 'msg_new' });
    const s = await publishDueChecks(now, w.deps);
    assert.equal(s.published, 1);
    assert.notEqual(w.rows.get('lost')!.messageId, 'msg_old');
    assert.equal(w.rows.get('inflight')!.messageId, 'msg_new');
});

test('a second run after recovery publishes nothing more (idempotent)', async () => {
    const now = new Date('2026-10-10T03:00:00Z');
    console.warn = () => {};
    const w = world(now);
    w.add('a4', 'T', 'ARR_PLUS_4H', 30);
    w.add('d1', 'T', 'DEP', 30);
    await publishDueChecks(now, w.deps);
    const second = await publishDueChecks(now, w.deps);
    assert.deepEqual({ published: second.published, stale: second.stale }, { published: 0, stale: 0 });
});

test('policy constants match the documentation in publishWindow.ts', () => {
    assert.equal(STALE_AFTER_MS, 24 * HOUR);
    assert.equal(ORPHAN_AFTER_MS, 2 * HOUR);
});

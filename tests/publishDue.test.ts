import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { planCheckpoints, resolveTripSchedule } from '@/lib/guardian/checkpoints';
import {
    PUBLISH_HORIZON_MS,
    QSTASH_MAX_DELAY_MS,
    planPublication,
    withinPublishHorizon,
} from '@/lib/guardian/publishWindow';
import { publishDueChecks, type DueRow, type PublishDueDeps } from '@/lib/guardian/publishDue';

const DAY = 24 * 60 * 60 * 1000;
const realError = console.error;
const realWarn = console.warn;
afterEach(() => { console.error = realError; console.warn = realWarn; });

test('horizon stays inside QStash maxDelay (604800 s) with a day of slack', () => {
    assert.equal(QSTASH_MAX_DELAY_MS / 1000, 604800);
    assert.equal(PUBLISH_HORIZON_MS, 6 * DAY);
    const now = new Date('2026-10-01T00:00:00Z');
    assert.equal(withinPublishHorizon(new Date(now.getTime() + 6 * DAY), now), true);
    assert.equal(withinPublishHorizon(new Date(now.getTime() + 6 * DAY + 1), now), false);
});

// In-memory ScheduledTripCheck table + a fake QStash that enforces maxDelay
// exactly like the real free plan does.
function fakeWorld() {
    const rows = new Map<string, DueRow & { status: string; messageId: string | null; error: string | null }>();
    const qstash: { id: string; delaySec: number }[] = [];
    let seq = 0;
    let clock = new Date();

    const deps: PublishDueDeps = {
        resetMaxDelayFailures: async () => {
            let n = 0;
            for (const r of rows.values()) {
                if (r.status === 'FAILED' && !r.messageId && /maxDelay/i.test(r.error ?? '')) { r.status = 'SCHEDULED'; r.error = null; n++; }
            }
            return n;
        },
        findUnpublished: async () => [...rows.values()].filter((r) => r.status === 'SCHEDULED' && (!r.messageId || clock.getTime() - r.runAt.getTime() > 2 * 60 * 60 * 1000)),
        publish: async (r) => {
            const delaySec = Math.floor((r.runAt.getTime() - clock.getTime()) / 1000);
            if (delaySec > 604800) throw new Error('quota maxDelay exceeded');
            if (qstash.some((m) => m.id === r.id)) return `msg_dup_${r.id}`; // QStash dedup on row id
            qstash.push({ id: r.id, delaySec });
            return `msg_${++seq}`;
        },
        markPublished: async (id, messageId) => { const r = rows.get(id)!; r.messageId = messageId ?? 'published-no-id'; },
        markFailed: async (id, error) => { const r = rows.get(id)!; r.status = 'FAILED'; r.error = error; },
        markSkipped: async (id, reason) => { const r = rows.get(id)!; r.status = 'SKIPPED'; r.error = reason; },
    };

    return {
        rows, qstash, deps,
        setClock: (d: Date) => { clock = d; },
        // What scheduleTripChecks does for each planned checkpoint.
        schedule(tripId: string, checks: { kind: string; runAt: Date }[], now: Date) {
            clock = now;
            for (const c of checks) {
                const id = `chk_${rows.size + 1}`;
                const row = { id, tripId, kind: c.kind, runAt: c.runAt, status: 'SCHEDULED', messageId: null as string | null, error: null as string | null };
                rows.set(id, row);
                if (!withinPublishHorizon(c.runAt, now)) continue; // deferred: stays unpublished
                const delaySec = Math.floor((c.runAt.getTime() - now.getTime()) / 1000);
                if (delaySec > 604800) { row.status = 'FAILED'; row.error = 'quota maxDelay exceeded'; continue; }
                qstash.push({ id, delaySec });
                row.messageId = `msg_${++seq}`;
            }
        },
    };
}

test('flight 10 days out: nothing beyond 6 days is published now; the daily run publishes the rest as they come in range', async () => {
    const day0 = new Date('2026-10-04T06:00:00Z');
    const departure = new Date(day0.getTime() + 10 * DAY);
    const arrival = new Date(departure.getTime() + 2 * 60 * 60 * 1000);
    const checks = planCheckpoints({ departureUtc: departure, arrivalUtc: arrival, approximate: false }, day0);
    assert.deepEqual(checks.map((c) => c.kind), ['DEP_MINUS_24H', 'DEP_MINUS_3H', 'DEP', 'ARR_PLUS_1H', 'ARR_PLUS_4H', 'COMPLETE']);

    const w = fakeWorld();
    w.schedule('trip_1', checks, day0);

    // Day 0: DEP-24h is 9 days away → nothing is inside the window, nothing hits QStash, nothing FAILED.
    assert.equal(w.qstash.length, 0);
    assert.ok([...w.rows.values()].every((r) => r.status === 'SCHEDULED' && r.messageId === null));
    assert.ok(w.qstash.every((m) => m.delaySec <= 604800));

    // Daily cron, day 1..9. Each run publishes only what has come within 6 days.
    const publishedPerDay: number[] = [];
    for (let d = 1; d <= 12; d++) {
        const now = new Date(day0.getTime() + d * DAY);
        w.setClock(now);
        const before = w.qstash.length;
        const summary = await publishDueChecks(now, w.deps);
        publishedPerDay.push(w.qstash.length - before);
        assert.equal(summary.failed, 0);
        for (const r of w.rows.values()) {
            if (r.messageId) assert.ok(r.runAt.getTime() - now.getTime() <= PUBLISH_HORIZON_MS || r.messageId, 'published rows were in range when published');
        }
    }
    // Run N happens at day0+N 06:00; a checkpoint is published on the first run at most 6 days before it.
    assert.equal(publishedPerDay[2], 1, 'day 3: DEP_MINUS_24H (day 9 06:00)');
    assert.equal(publishedPerDay[3], 2, 'day 4: DEP_MINUS_3H (day 10 03:00), DEP (day 10 06:00)');
    assert.equal(publishedPerDay[4], 2, 'day 5: ARR_PLUS_1H (day 10 09:00), ARR_PLUS_4H (day 10 12:00)');
    assert.equal(publishedPerDay[6], 1, 'day 7: COMPLETE (day 12 08:00)');
    assert.equal(publishedPerDay.reduce((a, b) => a + b, 0), 6);
    assert.ok([...w.rows.values()].every((r) => r.messageId));
    assert.ok(w.qstash.every((m) => m.delaySec <= 604800), 'QStash never saw a delay above maxDelay');
});

test('mixed trip: only the checkpoints within 6 days are published immediately, the rest wait', () => {
    const now = new Date('2026-10-04T06:00:00Z');
    const rows = [1, 3, 5.9, 6.1, 8, 12].map((d, i) => ({ id: `c${i}`, runAt: new Date(now.getTime() + d * DAY) }));
    const plan = planPublication(rows, now);
    assert.deepEqual(plan.publish.map((r) => r.id), ['c0', 'c1', 'c2']);
    assert.deepEqual(plan.deferred.map((r) => r.id), ['c3', 'c4', 'c5']);
    assert.equal(plan.stale.length, 0);
});

test('publish-due is idempotent: a second run (or a concurrent one) publishes nothing new', async () => {
    const now = new Date('2026-10-04T06:00:00Z');
    const w = fakeWorld();
    w.schedule('trip_1', [{ kind: 'DEP', runAt: new Date(now.getTime() + 2 * DAY) }], new Date(now.getTime() - 20 * DAY)); // stored unpublished long ago
    for (const r of w.rows.values()) { r.messageId = null; r.status = 'SCHEDULED'; }
    w.qstash.length = 0;
    w.setClock(now);
    assert.equal((await publishDueChecks(now, w.deps)).published, 1);
    assert.equal((await publishDueChecks(now, w.deps)).published, 0);
    assert.equal(w.qstash.length, 1);
});

test('rows that FAILED only on maxDelay are reset and published once in range; other failures stay failed', async () => {
    const now = new Date('2026-10-04T06:00:00Z');
    const w = fakeWorld();
    const mk = (id: string, error: string, days: number) =>
        w.rows.set(id, { id, tripId: 't', kind: 'COMPLETE', runAt: new Date(now.getTime() + days * DAY), status: 'FAILED', messageId: null, error });
    mk('a', 'quota maxDelay exceeded', 3);
    mk('b', 'quota maxDelay exceeded', 9);
    mk('c', 'QSTASH_TOKEN is not set', 3);
    w.setClock(now);
    const s = await publishDueChecks(now, w.deps);
    assert.equal(s.reset, 2);
    assert.equal(s.published, 1);
    assert.equal(s.deferred, 1);
    assert.equal(w.rows.get('a')!.messageId !== null, true);
    assert.equal(w.rows.get('b')!.status, 'SCHEDULED');
    assert.equal(w.rows.get('c')!.status, 'FAILED');
});

test('a QStash error is logged and recorded on the row; the run continues', async () => {
    const now = new Date('2026-10-04T06:00:00Z');
    const logged: string[] = [];
    console.error = (...a: unknown[]) => { logged.push(a.join(' ')); };
    const w = fakeWorld();
    w.rows.set('x', { id: 'x', tripId: 't', kind: 'DEP', runAt: new Date(now.getTime() + DAY), status: 'SCHEDULED', messageId: null, error: null });
    w.rows.set('y', { id: 'y', tripId: 't', kind: 'ARR_PLUS_1H', runAt: new Date(now.getTime() + 2 * DAY), status: 'SCHEDULED', messageId: null, error: null });
    const flaky: PublishDueDeps = { ...w.deps, publish: async (r) => { if (r.id === 'x') throw new Error('QStash 503'); return 'msg_ok'; } };
    const s = await publishDueChecks(now, flaky);
    assert.deepEqual({ published: s.published, failed: s.failed }, { published: 1, failed: 1 });
    assert.equal(w.rows.get('x')!.status, 'FAILED');
    assert.match(w.rows.get('x')!.error!, /QStash 503/);
    assert.ok(logged.some((l) => l.includes('check x') && l.includes('QStash 503')));
});

test('long-overdue obsolete rows are skipped with a recorded reason, not run blindly', async () => {
    const now = new Date('2026-10-04T06:00:00Z');
    console.warn = () => {};
    const w = fakeWorld();
    w.rows.set('old', { id: 'old', tripId: 't', kind: 'DEP', runAt: new Date(now.getTime() - 3 * DAY), status: 'SCHEDULED', messageId: null, error: null });
    const s = await publishDueChecks(now, w.deps);
    assert.deepEqual({ published: s.published, stale: s.stale }, { published: 0, stale: 1 });
    assert.equal(w.qstash.length, 0);
    assert.equal(w.rows.get('old')!.status, 'SKIPPED');
    assert.match(w.rows.get('old')!.error!, /obsolete/);
});

test('wiring: scheduler defers beyond the window; the endpoint is signature-verified; same verifier as the check route', () => {
    const scheduler = readFileSync('lib/guardian/scheduler.ts', 'utf8');
    const loop = scheduler.slice(scheduler.indexOf('export async function scheduleTripChecks'), scheduler.indexOf('// Cancels future SCHEDULED'));
    assert.ok(loop.indexOf('withinPublishHorizon') > 0 && loop.indexOf('withinPublishHorizon') < loop.indexOf('publishCheck('));
    const route = readFileSync('app/api/guardian/publish-due/route.ts', 'utf8');
    assert.match(route, /isQStashAuthorized\(/);
    assert.ok(route.indexOf('isQStashAuthorized(') < route.indexOf('publishDueScheduledChecks('));
    assert.match(readFileSync('app/api/guardian/check/route.ts', 'utf8'), /isQStashAuthorized\(/);
    assert.match(scheduler, /isQStashPublishAllowed\(\)\) return \{ skipped/);
});

test('SESSION_REFRESH no longer logs the user id on every request', () => {
    const src = readFileSync('lib/auth.ts', 'utf8');
    assert.doesNotMatch(src, /console\.log\([^)]*SESSION_REFRESH/);
    assert.doesNotMatch(src, /SESSION_REFRESH\][^\n]*\n[^\n]*userId: token\.sub/);
});

// Sanity: resolveTripSchedule is unchanged input for the 10-day fixture above.
test('fixture sanity', () => {
    const s = resolveTripSchedule({ departureDate: new Date('2026-10-14T00:00:00Z') });
    assert.equal(s.departureUtc.toISOString(), '2026-10-14T12:00:00.000Z');
});

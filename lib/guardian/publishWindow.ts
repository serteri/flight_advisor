// lib/guardian/publishWindow.ts
//
// QStash caps how far ahead a message can be delayed (free plan: 7 days =
// 604800 s; a longer notBefore is rejected with "quota maxDelay exceeded").
// Checkpoints always live in ScheduledTripCheck; only those due within
// PUBLISH_HORIZON_MS are handed to QStash. The rest stay SCHEDULED with no
// messageId until the daily publish-due run (app/api/guardian/publish-due)
// brings them inside the window. 6 days leaves a day of slack for a missed run.

export const QSTASH_MAX_DELAY_MS = 7 * 24 * 60 * 60 * 1000;
export const PUBLISH_HORIZON_MS = 6 * 24 * 60 * 60 * 1000;

// -- Stale-check policy -------------------------------------------------------
// A missed daily run (or a QStash/Vercel outage) must not permanently kill
// monitoring for a flight that is still upcoming or in progress, and ancient
// checks must not be executed blindly either.
//
//  * A row overdue by up to STALE_AFTER_MS is simply published now (QStash
//    delivers a past notBefore immediately): a late check is still a good check.
//  * A row overdue by more than that is "stale" and is judged by kind:
//      COMPLETE                        run (no provider call; closes the trip)
//      ARR_PLUS_1H / ARR_PLUS_4H / EXTRA_ARR_PLUS_1H
//                                      run late while the trip is inside its
//                                      monitoring window (arrival + 48h): the
//                                      provider still reports the actual
//                                      arrival, which is what compensation
//                                      needs. At most ONE per trip (the latest);
//                                      earlier ones are superseded.
//      DEP_MINUS_24H / DEP_MINUS_3H / DEP / other
//                                      skipped as obsolete (their moment has
//                                      passed). Recorded as SKIPPED with the
//                                      reason, never silently dropped.
//  * A row QStash already holds (messageId set) that is still SCHEDULED
//    ORPHAN_AFTER_MS past its time was lost (delivery retries exhausted, QStash
//    outage): it is republished by the same rules. Running a check twice is
//    safe: the handler ignores non-SCHEDULED rows and holds a per-trip lease.
export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
export const ORPHAN_AFTER_MS = 2 * 60 * 60 * 1000;

export const MAX_DELAY_ERROR_MARKER = 'maxDelay';

const ARRIVAL_SIDE_KINDS = new Set(['ARR_PLUS_1H', 'ARR_PLUS_4H', 'EXTRA_ARR_PLUS_1H']);

export function withinPublishHorizon(runAt: Date, now: Date): boolean {
    return runAt.getTime() - now.getTime() <= PUBLISH_HORIZON_MS;
}

export interface UnpublishedRow {
    id: string;
    runAt: Date;
    kind?: string;
    tripId?: string;
    /** Trip.monitoringEndsAt (scheduled arrival + 48h), when known. */
    monitoringEndsAt?: Date | null;
}

export type StaleVerdict = { action: 'RUN_LATE' } | { action: 'SKIP'; reason: string };

export function staleVerdict(row: UnpublishedRow, now: Date): StaleVerdict {
    if (row.kind === 'COMPLETE') return { action: 'RUN_LATE' };
    if (row.kind && ARRIVAL_SIDE_KINDS.has(row.kind)) {
        if (row.monitoringEndsAt && now.getTime() >= row.monitoringEndsAt.getTime()) {
            return { action: 'SKIP', reason: 'stale: monitoring window already ended' };
        }
        return { action: 'RUN_LATE' };
    }
    return { action: 'SKIP', reason: `stale: ${row.kind ?? 'check'} is obsolete (its moment passed more than 24h ago)` };
}

export function planPublication<T extends UnpublishedRow>(
    rows: T[],
    now: Date,
): { publish: T[]; deferred: T[]; stale: Array<T & { reason: string }>; recovered: T[] } {
    const publish: T[] = [];
    const deferred: T[] = [];
    const stale: Array<T & { reason: string }> = [];
    const lateCandidates: T[] = [];

    for (const row of rows) {
        if (now.getTime() - row.runAt.getTime() > STALE_AFTER_MS) {
            const verdict = staleVerdict(row, now);
            if (verdict.action === 'SKIP') stale.push({ ...row, reason: verdict.reason });
            else lateCandidates.push(row);
        } else if (withinPublishHorizon(row.runAt, now)) {
            publish.push(row);
        } else {
            deferred.push(row);
        }
    }

    // At most one late arrival-side catch-up per trip: the latest one.
    const recovered: T[] = [];
    const latestByTrip = new Map<string, T>();
    for (const row of lateCandidates) {
        if (row.kind === 'COMPLETE' || !row.tripId) {
            recovered.push(row);
            continue;
        }
        const current = latestByTrip.get(row.tripId);
        if (!current || row.runAt.getTime() > current.runAt.getTime()) {
            if (current) stale.push({ ...current, reason: 'superseded by a later catch-up check' });
            latestByTrip.set(row.tripId, row);
        } else {
            stale.push({ ...row, reason: 'superseded by a later catch-up check' });
        }
    }
    recovered.push(...latestByTrip.values());

    const toPublish = [...publish, ...recovered].sort((a, b) => a.runAt.getTime() - b.runAt.getTime());
    return { publish: toPublish, deferred, stale, recovered };
}

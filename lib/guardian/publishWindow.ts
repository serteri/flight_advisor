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
// An unpublished row this far in the past is not run blindly (a provider call
// for a long-gone checkpoint); it is reported instead.
export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export const MAX_DELAY_ERROR_MARKER = 'maxDelay';

export function withinPublishHorizon(runAt: Date, now: Date): boolean {
    return runAt.getTime() - now.getTime() <= PUBLISH_HORIZON_MS;
}

export interface UnpublishedRow {
    id: string;
    runAt: Date;
}

export function planPublication<T extends UnpublishedRow>(
    rows: T[],
    now: Date,
): { publish: T[]; deferred: T[]; stale: T[] } {
    const publish: T[] = [];
    const deferred: T[] = [];
    const stale: T[] = [];
    for (const row of rows) {
        if (now.getTime() - row.runAt.getTime() > STALE_AFTER_MS) stale.push(row);
        else if (withinPublishHorizon(row.runAt, now)) publish.push(row);
        else deferred.push(row);
    }
    publish.sort((a, b) => a.runAt.getTime() - b.runAt.getTime());
    return { publish, deferred, stale };
}

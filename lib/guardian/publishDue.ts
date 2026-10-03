// lib/guardian/publishDue.ts
//
// The daily catch-up: publishes unpublished SCHEDULED checkpoints that have come
// inside the QStash delay window. Idempotent — a published row has a messageId
// and is never selected again, and QStash additionally de-duplicates on the row
// id. Storage is injected so the logic is testable without a database.

import { planPublication } from '@/lib/guardian/publishWindow';

export interface DueRow {
    id: string;
    tripId: string;
    kind: string;
    runAt: Date;
}

export interface PublishDueDeps {
    // FAILED rows that only failed on QStash's max delay go back to SCHEDULED
    // (unpublished) so replans can cancel them and this run can publish them.
    resetMaxDelayFailures(): Promise<number>;
    // SCHEDULED, no messageId, trip ACTIVE.
    findUnpublished(): Promise<DueRow[]>;
    // Throws on a QStash error. Returns the message id (null if QStash gave none).
    publish(row: DueRow): Promise<string | null>;
    markPublished(id: string, messageId: string | null): Promise<void>;
    markFailed(id: string, error: string): Promise<void>;
}

export interface PublishDueSummary {
    reset: number;
    published: number;
    failed: number;
    deferred: number;
    stale: number;
}

export async function publishDueChecks(now: Date, deps: PublishDueDeps): Promise<PublishDueSummary> {
    const reset = await deps.resetMaxDelayFailures();
    const rows = await deps.findUnpublished();
    const { publish, deferred, stale } = planPublication(rows, now);

    let published = 0;
    let failed = 0;
    for (const row of publish) {
        try {
            const messageId = await deps.publish(row);
            await deps.markPublished(row.id, messageId);
            published++;
        } catch (error: any) {
            const message = String(error?.message || 'QStash publish failed');
            console.error(`[PublishDue] Failed to publish ${row.kind} for trip ${row.tripId} (check ${row.id}): ${message}`);
            await deps.markFailed(row.id, message.slice(0, 500)).catch((e) =>
                console.error(`[PublishDue] Could not record failure for check ${row.id}:`, e),
            );
            failed++;
        }
    }

    if (stale.length > 0) {
        console.warn(`[PublishDue] ${stale.length} unpublished check(s) are more than 24h overdue and were not published: ${stale.map((r) => r.id).join(', ')}`);
    }
    return { reset, published, failed, deferred: deferred.length, stale: stale.length };
}

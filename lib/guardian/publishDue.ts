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
    monitoringEndsAt?: Date | null;
}

export interface PublishDueDeps {
    // FAILED rows that only failed on QStash's max delay go back to SCHEDULED
    // (unpublished) so replans can cancel them and this run can publish them.
    resetMaxDelayFailures(): Promise<number>;
    // SCHEDULED rows on an ACTIVE trip that are either never published or were
    // published but are still SCHEDULED ORPHAN_AFTER_MS past their time.
    findUnpublished(): Promise<DueRow[]>;
    // Throws on a QStash error. Returns the message id (null if QStash gave none).
    publish(row: DueRow): Promise<string | null>;
    markPublished(id: string, messageId: string | null): Promise<void>;
    markFailed(id: string, error: string): Promise<void>;
    // Stale rows the policy decides not to run (SKIPPED, with the reason).
    markSkipped(id: string, reason: string): Promise<void>;
}

export interface PublishDueSummary {
    reset: number;
    published: number;
    failed: number;
    deferred: number;
    /** Overdue rows skipped by the stale policy (marked SKIPPED with a reason). */
    stale: number;
    /** Overdue rows the stale policy ran late (already counted in `published`). */
    recovered: number;
}

export async function publishDueChecks(now: Date, deps: PublishDueDeps): Promise<PublishDueSummary> {
    const reset = await deps.resetMaxDelayFailures();
    const rows = await deps.findUnpublished();
    const { publish, deferred, stale, recovered } = planPublication(rows, now);

    let published = 0;
    let failed = 0;
    const publishedIds = new Set<string>();
    for (const row of publish) {
        try {
            const messageId = await deps.publish(row);
            await deps.markPublished(row.id, messageId);
            published++;
            publishedIds.add(row.id);
        } catch (error: any) {
            const message = String(error?.message || 'QStash publish failed');
            console.error(`[PublishDue] Failed to publish ${row.kind} for trip ${row.tripId} (check ${row.id}): ${message}`);
            await deps.markFailed(row.id, message.slice(0, 500)).catch((e) =>
                console.error(`[PublishDue] Could not record failure for check ${row.id}:`, e),
            );
            failed++;
        }
    }

    for (const row of stale) {
        console.warn(`[PublishDue] Skipping stale check ${row.id} (${row.kind}, trip ${row.tripId}, runAt ${row.runAt.toISOString()}): ${row.reason}`);
        await deps.markSkipped(row.id, row.reason).catch((e) =>
            console.error(`[PublishDue] Could not record skip for check ${row.id}:`, e),
        );
    }
    const recoveredPublished = recovered.filter((r) => publishedIds.has(r.id)).length;
    return { reset, published, failed, deferred: deferred.length, stale: stale.length, recovered: recoveredPublished };
}

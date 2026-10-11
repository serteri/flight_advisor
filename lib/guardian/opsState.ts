// lib/guardian/opsState.ts
//
// Last successful /api/guardian/publish-due run, kept in the existing
// ApiQuotaState table (provider GUARDIAN_PUBLISH_DUE, one row) so no schema
// change has to be applied to production first. Column mapping:
//   callsUsed       published in the last run
//   unitsUsed       failed
//   headerLimit     stale (skipped as obsolete / recovered per policy)
//   headerRemaining deferred (beyond the QStash window, not yet due)
//   updatedAt       when the run completed
// Reading and writing never throws: ops bookkeeping must not break publishing.

import { prisma } from '@/lib/prisma';

const PROVIDER = 'GUARDIAN_PUBLISH_DUE';
const PERIOD = 'last-run';

export interface PublishDueRunRecord {
    at: Date;
    published: number;
    failed: number;
    stale: number;
    deferred: number;
}

export async function recordPublishDueRun(summary: Omit<PublishDueRunRecord, 'at'>): Promise<void> {
    const data = {
        callsUsed: summary.published,
        unitsUsed: summary.failed,
        headerLimit: summary.stale,
        headerRemaining: summary.deferred,
    };
    try {
        await prisma.apiQuotaState.upsert({
            where: { provider_period: { provider: PROVIDER, period: PERIOD } },
            create: { provider: PROVIDER, period: PERIOD, ...data },
            update: data,
        });
    } catch (error) {
        console.error('[PublishDue] Could not record run status:', error);
    }
}

export async function readLastPublishDueRun(): Promise<PublishDueRunRecord | null> {
    try {
        const row = await prisma.apiQuotaState.findUnique({
            where: { provider_period: { provider: PROVIDER, period: PERIOD } },
        });
        if (!row) return null;
        return {
            at: row.updatedAt,
            published: row.callsUsed,
            failed: row.unitsUsed,
            stale: row.headerLimit ?? 0,
            deferred: row.headerRemaining ?? 0,
        };
    } catch (error) {
        console.error('[Ops] Could not read publish-due status:', error);
        return null;
    }
}

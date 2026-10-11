// lib/guardian/opsSnapshot.ts
//
// Read-only data for /admin/guardian. Deliberately selects no personal data:
// no email addresses, no passenger names, no secrets - only counts, ids,
// statuses and failure text.

import { prisma } from '@/lib/prisma';
import { getQuotaConfig } from '@/lib/flightData/quotaPolicy';
import { currentQuotaPeriod } from '@/lib/flightData/quotaStore';
import { buildQuotaView, type QuotaView } from '@/lib/flightData/quotaView';
import { STALE_AFTER_MS } from '@/lib/guardian/publishWindow';
import { parseFailure, type FailureClass } from '@/lib/guardian/failureText';
import { readLastPublishDueRun, type PublishDueRunRecord } from '@/lib/guardian/opsState';

export interface FailureRow {
    at: Date;
    checkId: string;
    tripId: string;
    kind: string;
    failureClass: FailureClass | 'UNCLASSIFIED';
    code: string | null;
    detail: string;
    retryState: 'RETRY_PENDING' | 'FINAL';
}

export interface GuardianOpsSnapshot {
    generatedAt: Date;
    quota: QuotaView;
    quotaPeriod: string;
    trips: { active: number; pendingConfirmation: number; pendingVerification: number; flightNotFound: number; completed: number };
    checks: { unpublished: number; published: number; running: number; failed: number; stale: number; failedLast24h: number };
    lastPublishDue: PublishDueRunRecord | null;
    latestFailureAt: Date | null;
    failures: FailureRow[];
}

export async function getGuardianOpsSnapshot(now = new Date()): Promise<GuardianOpsSnapshot> {
    const period = currentQuotaPeriod(now);
    const staleBefore = new Date(now.getTime() - STALE_AFTER_MS);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [tripGroups, unpublished, published, running, failed, stale, failedLast24h, quotaRow, failureRows, lastRun] =
        await Promise.all([
            prisma.monitoredTrip.groupBy({ by: ['status'], _count: { _all: true } }),
            prisma.scheduledTripCheck.count({ where: { status: 'SCHEDULED', messageId: null } }),
            prisma.scheduledTripCheck.count({ where: { status: 'SCHEDULED', messageId: { not: null } } }),
            prisma.monitoredTrip.count({ where: { processingLeaseExpiresAt: { gt: now } } }),
            prisma.scheduledTripCheck.count({ where: { status: 'FAILED' } }),
            prisma.scheduledTripCheck.count({ where: { status: 'SCHEDULED', runAt: { lt: staleBefore } } }),
            prisma.scheduledTripCheck.count({ where: { status: 'FAILED', updatedAt: { gte: dayAgo } } }),
            prisma.apiQuotaState.findUnique({ where: { provider_period: { provider: 'AERODATABOX', period } } }),
            prisma.scheduledTripCheck.findMany({
                where: { OR: [{ status: 'FAILED' }, { status: 'SCHEDULED', error: { not: null } }] },
                orderBy: { updatedAt: 'desc' },
                take: 25,
                select: { id: true, tripId: true, kind: true, status: true, error: true, updatedAt: true },
            }),
            readLastPublishDueRun(),
        ]);

    const tripCount = (status: string) => tripGroups.find((g) => g.status === status)?._count._all ?? 0;

    const failures: FailureRow[] = failureRows.map((row) => {
        const parsed = parseFailure(row.error);
        return {
            at: row.updatedAt,
            checkId: row.id,
            tripId: row.tripId,
            kind: row.kind,
            failureClass: parsed.failureClass,
            code: parsed.code,
            detail: (row.error ?? '').slice(0, 200),
            retryState: row.status === 'SCHEDULED' ? 'RETRY_PENDING' : 'FINAL',
        };
    });

    return {
        generatedAt: now,
        quotaPeriod: period,
        quota: buildQuotaView({
            callsUsed: quotaRow?.callsUsed ?? 0,
            unitsUsed: quotaRow?.unitsUsed ?? 0,
            headerLimit: quotaRow?.headerLimit,
            headerRemaining: quotaRow?.headerRemaining,
            headerKind: quotaRow?.headerKind,
            config: getQuotaConfig(),
        }),
        trips: {
            active: tripCount('ACTIVE'),
            pendingConfirmation: tripCount('PENDING_CONFIRMATION'),
            pendingVerification: tripCount('PENDING_VERIFICATION'),
            flightNotFound: tripCount('FLIGHT_NOT_FOUND'),
            completed: tripCount('COMPLETED'),
        },
        checks: { unpublished, published, running, failed, stale, failedLast24h },
        lastPublishDue: lastRun,
        latestFailureAt: failures.find((f) => f.retryState === 'FINAL')?.at ?? failures[0]?.at ?? null,
        failures,
    };
}

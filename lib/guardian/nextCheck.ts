import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export interface NextCheckStore {
    scheduledTripCheck: {
        findFirst: (args: Prisma.ScheduledTripCheckFindFirstArgs) => Promise<{ runAt: Date } | null>;
    };
    monitoredTrip: {
        findUnique: (args: Prisma.MonitoredTripFindUniqueArgs) => Promise<{ monitoringEndsAt: Date | null } | null>;
        update: (args: Prisma.MonitoredTripUpdateArgs) => Promise<unknown>;
    };
}

/** Only future pending checkpoints count. The required DB field falls back to
 * the monitoring end, never a fabricated current timestamp. */
export async function findNextCheckAt(tripId: string, now: Date, excludeCheckId?: string, store: NextCheckStore = prisma): Promise<Date | null> {
    const pending = await store.scheduledTripCheck.findFirst({
        where: { tripId, status: 'SCHEDULED', runAt: { gt: now }, ...(excludeCheckId ? { id: { not: excludeCheckId } } : {}) },
        orderBy: [{ runAt: 'asc' }, { id: 'asc' }],
        select: { runAt: true },
    });
    if (pending) return pending.runAt;
    const trip = await store.monitoredTrip.findUnique({ where: { id: tripId }, select: { monitoringEndsAt: true } });
    return trip?.monitoringEndsAt ?? null;
}

export async function refreshNextCheckAt(tripId: string, now: Date, excludeCheckId?: string, store: NextCheckStore = prisma): Promise<void> {
    const nextCheckAt = await findNextCheckAt(tripId, now, excludeCheckId, store);
    // nextCheckAt is non-nullable in the existing schema. No end and no checks
    // means there is no lifecycle plan to synchronize.
    if (nextCheckAt) await store.monitoredTrip.update({ where: { id: tripId }, data: { nextCheckAt } });
}

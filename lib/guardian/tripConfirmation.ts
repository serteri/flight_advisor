// lib/guardian/tripConfirmation.ts
//
// Double opt-in: trips from the anonymous form start as PENDING_CONFIRMATION
// and nothing is monitored (no provider calls, no QStash checkpoints) until
// the subscriber opens the emailed magic link, which proves they own the
// address. Opening the link confirms the user's pending trips - as many as the
// plan allows (lib/guardian/freeLimit.ts): on Free, one monitored flight at a
// time. Pending trips beyond that are ARCHIVED, never monitored.

import { prisma } from '@/lib/prisma';
import { getUserPlan } from '@/lib/freemium/usage';
import { countHoldingTrips, planActivation } from '@/lib/guardian/freeLimit';
import { initializeTripMonitoring } from '@/lib/guardian/tripLifecycle';

export async function confirmPendingTrips(userId: string, now = new Date()): Promise<string[]> {
    const pending = await prisma.monitoredTrip.findMany({
        where: { userId, status: 'PENDING_CONFIRMATION' },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
    });
    if (pending.length === 0) return [];

    const plan = await getUserPlan(userId);
    const { activate: ids, rejected } = planActivation({
        isPro: plan === 'pro',
        holding: await countHoldingTrips(userId),
        pendingIdsOldestFirst: pending.map((trip) => trip.id),
    });

    if (rejected.length > 0) {
        console.warn(`[TripConfirmation] Free plan allows one monitored flight at a time - archiving ${rejected.length} extra pending trip(s) for user ${userId}`);
        await prisma.monitoredTrip.updateMany({
            where: { id: { in: rejected }, status: 'PENDING_CONFIRMATION' },
            data: { status: 'ARCHIVED' },
        });
    }
    if (ids.length === 0) return [];

    await prisma.monitoredTrip.updateMany({
        where: { id: { in: ids }, status: 'PENDING_CONFIRMATION' },
        data: { status: 'ACTIVE', confirmedAt: now, nextCheckAt: now },
    });

    for (const id of ids) {
        try {
            await initializeTripMonitoring(id, now);
        } catch (error) {
            // The trip is ACTIVE; a failed first lookup must not break login.
            console.error(`[TripConfirmation] Failed to start monitoring for trip ${id}:`, error);
        }
    }
    return ids;
}

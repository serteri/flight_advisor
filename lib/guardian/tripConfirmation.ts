// lib/guardian/tripConfirmation.ts
//
// Double opt-in: trips from the anonymous form start as PENDING_CONFIRMATION
// and nothing is monitored (no provider calls, no QStash checkpoints) until
// the subscriber opens the emailed magic link, which proves they own the
// address. Opening the link confirms every pending trip for that user.

import { prisma } from '@/lib/prisma';
import { initializeTripMonitoring } from '@/lib/guardian/tripLifecycle';

export async function confirmPendingTrips(userId: string, now = new Date()): Promise<string[]> {
    const pending = await prisma.monitoredTrip.findMany({
        where: { userId, status: 'PENDING_CONFIRMATION' },
        select: { id: true },
    });
    if (pending.length === 0) return [];

    const ids = pending.map((trip) => trip.id);
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

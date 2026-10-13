// lib/guardian/freeLimit.ts
//
// The one Free-plan rule for monitored flights, used by every entry point:
//
//   A Free user can have FREE_TIER_LIMITS.monitoredTrips (1) flight(s) being
//   monitored at the same time. "Being monitored" = ACTIVE or
//   PENDING_VERIFICATION. Completed, not-found, cancelled and archived trips
//   free the slot. Paid users are unlimited.
//
// Where it is enforced:
//  * POST /api/trips/monitor (signed-in users)  -> checkLimit('monitored_trip') -> 402
//  * Double opt-in confirmation (lib/guardian/tripConfirmation.ts) -> only as
//    many pending trips as fit are activated; the rest are ARCHIVED.
//
// POST /api/trips/track (anonymous form) deliberately does NOT answer "limit
// reached": that response would reveal whether an arbitrary email address is
// already registered. It always behaves the same; the limit is applied when the
// real inbox owner confirms, where nothing leaks to a third party. Submitting
// many flights for one address cannot get around it: confirming activates at
// most the free capacity, in submission order.

import { prisma } from '@/lib/prisma';
import { FREE_TIER_LIMITS } from '@/lib/freemium/limits';

export const FREE_MONITORED_FLIGHT_LIMIT: number = FREE_TIER_LIMITS.monitoredTrips;
export const LIMIT_HOLDING_STATUSES = ['ACTIVE', 'PENDING_VERIFICATION'] as const;

export interface ActivationPlan {
    activate: string[];
    rejected: string[];
}

// Pure: which pending trips (oldest first) a user may activate right now.
export function planActivation(input: {
    isPro: boolean;
    holding: number;
    pendingIdsOldestFirst: string[];
    limit?: number;
}): ActivationPlan {
    if (input.isPro) return { activate: [...input.pendingIdsOldestFirst], rejected: [] };
    const limit = input.limit ?? FREE_MONITORED_FLIGHT_LIMIT;
    const capacity = Math.max(0, limit - input.holding);
    return {
        activate: input.pendingIdsOldestFirst.slice(0, capacity),
        rejected: input.pendingIdsOldestFirst.slice(capacity),
    };
}

export async function countHoldingTrips(userId: string): Promise<number> {
    return prisma.monitoredTrip.count({
        where: { userId, status: { in: [...LIMIT_HOLDING_STATUSES] } },
    });
}

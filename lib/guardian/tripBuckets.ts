// lib/guardian/tripBuckets.ts
//
// One model for the Booked Trips page. CURRENT = what the user is waiting on or
// being monitored for; HISTORY = everything else. Display only: no status is
// changed and no record deleted.

export const CURRENT_TRIP_STATUSES = ['ACTIVE', 'PENDING_VERIFICATION', 'PENDING_CONFIRMATION'] as const;

export const isCurrentTrip = (status: string | null | undefined): boolean =>
    (CURRENT_TRIP_STATUSES as readonly string[]).includes(status ?? '');

export function splitTrips<T extends { status?: string | null }>(trips: readonly T[]): { current: T[]; history: T[] } {
    const current: T[] = [];
    const history: T[] = [];
    for (const trip of trips) (isCurrentTrip(trip.status) ? current : history).push(trip);
    return { current, history };
}

/** "Route being verified" only makes sense while the trip is still being set up. */
export const routeVerifyingApplies = (status: string | null | undefined): boolean => isCurrentTrip(status);

/** PNR chip text, or null when there is nothing to show (never "-", a bullet or "null"). */
export function pnrLabel(pnr: string | null | undefined): string | null {
    const value = typeof pnr === 'string' ? pnr.trim() : '';
    if (!value || value === '-' || value === '•' || /^(null|undefined)$/i.test(value)) return null;
    return value;
}

// lib/guardian/tripDisplay.ts
//
// User-facing wording for trip state — never a raw enum or "UNK ➝ UNK".
// Labels live in messages/*.json under TripDisplay (en/de/tr).

export const TRIP_STATUS_LABEL_KEYS = [
    'ACTIVE',
    'PENDING_CONFIRMATION',
    'PENDING_VERIFICATION',
    'FLIGHT_NOT_FOUND',
    'COMPLETED',
    'CANCELLED',
    'ARCHIVED',
] as const;

export type TripStatusLabelKey = (typeof TRIP_STATUS_LABEL_KEYS)[number] | 'UNKNOWN';

/** i18n key under TripDisplay.status for any status value (unknown → UNKNOWN). */
export function tripStatusLabelKey(status: string | null | undefined): TripStatusLabelKey {
    return (TRIP_STATUS_LABEL_KEYS as readonly string[]).includes(status ?? '')
        ? (status as TripStatusLabelKey)
        : 'UNKNOWN';
}

const isUnknownAirport = (code: string | null | undefined) => !code || !code.trim() || code.trim().toUpperCase() === 'UNK';

/**
 * "ORIG → DEST", or null while the route isn't resolved yet (either end UNK or
 * missing) — callers then show TripDisplay.routeVerifying.
 */
export function routeText(origin: string | null | undefined, destination: string | null | undefined, arrow = '→'): string | null {
    if (isUnknownAirport(origin) || isUnknownAirport(destination)) return null;
    return `${origin!.trim()} ${arrow} ${destination!.trim()}`;
}

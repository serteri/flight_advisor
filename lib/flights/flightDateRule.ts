// lib/flights/flightDateRule.ts
//
// Flight date rule for the tracking form — shared by the client form and
// /api/trips/track, no API call. Dates are calendar days (YYYY-MM-DD) compared
// in UTC:
//  - past: before yesterday (one day of slack for travellers in timezones ahead
//    of UTC, same as before),
//  - too far: more than MAX_DAYS_AHEAD days after today (schedules are rarely
//    published further out; AeroDataBox covers "up to 365 days" at best).

export const MAX_DAYS_AHEAD = 330;
const DAY_MS = 24 * 60 * 60 * 1000;

export type FlightDateError = 'INVALID_DATE' | 'DATE_PAST' | 'DATE_TOO_FAR';

const utcDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

export function validateFlightDate(value: string, now: Date = new Date()):
    { ok: true; date: Date } | { ok: false; code: FlightDateError } {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { ok: false, code: 'INVALID_DATE' };
    const date = new Date(`${value}T00:00:00.000Z`);
    // Rejects impossible dates like 2026-02-30 (which Date would roll over).
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return { ok: false, code: 'INVALID_DATE' };

    const today = utcDay(now);
    if (date.getTime() < today - DAY_MS) return { ok: false, code: 'DATE_PAST' };
    if (date.getTime() > today + MAX_DAYS_AHEAD * DAY_MS) return { ok: false, code: 'DATE_TOO_FAR' };
    return { ok: true, date };
}

// lib/guardian/checkTimeFormat.ts
//
// "15 Oct · 15:15" for a Guardian check time. Shown in the DEPARTURE airport's local
// time (the same clock as the flight times), derived from the segment's own
// UTC/local pair, so it is identical on server and client. Without that pair the
// time is shown in UTC and labelled as such, never in an unknown browser zone.

export interface CheckTimeReference {
    scheduledDepartureUtc?: Date | string | null;
    scheduledDepartureLocal?: string | null; // 'YYYY-MM-DDTHH:mm' airport wall clock
}

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** Offset (ms) of the departure airport from UTC, or null when it cannot be derived. */
export function airportOffsetMs(ref: CheckTimeReference | null | undefined): number | null {
    if (!ref?.scheduledDepartureUtc || !ref.scheduledDepartureLocal) return null;
    const m = ref.scheduledDepartureLocal.match(LOCAL_RE);
    const utcMs = new Date(ref.scheduledDepartureUtc).getTime();
    if (!m || Number.isNaN(utcMs)) return null;
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])) - utcMs;
}

export function formatCheckTime(runAt: Date | string, locale: string, ref?: CheckTimeReference | null): string {
    const at = new Date(runAt);
    if (Number.isNaN(at.getTime())) return '';
    const offset = airportOffsetMs(ref);
    const shifted = new Date(at.getTime() + (offset ?? 0));
    const intlLocale = dayFirstLocale(locale); // "15 Oct", not "Oct 15"
    const day = new Intl.DateTimeFormat(intlLocale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(shifted);
    const hh = String(shifted.getUTCHours()).padStart(2, '0');
    const mm = String(shifted.getUTCMinutes()).padStart(2, '0');
    return `${day} · ${hh}:${mm}${offset === null ? ' UTC' : ''}`;
}

/** English dates read "15 Oct 2026" (day first), matching the rest of the Guardian pages. */
export const dayFirstLocale = (locale: string): string => (/^en/i.test(locale) ? 'en-GB' : locale);

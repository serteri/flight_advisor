// lib/flights/legFormat.ts
//
// Display helpers for a flight leg in the sign-up form: airport-local time with
// a month NAME ("15 Oct 2026, 13:00"), and the airline name from the local code
// list (TK → Turkish Airlines) with fallbacks that never block anything.

import { AIRLINE_NAMES } from '@/lib/airline-names';

const MONTHS = {
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    tr: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
    de: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
} as const;

export type LegLocale = keyof typeof MONTHS;

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * 'YYYY-MM-DDTHH:mm' (airport wall clock) → "15 Oct 2026, 13:00". No time-zone
 * conversion happens here: the digits already are the airport's local time.
 */
export function formatLocalDateTime(local: string | null | undefined, locale: string = 'en'): string | null {
    const m = local?.match(LOCAL_RE);
    if (!m) return null;
    const month = MONTHS[(locale in MONTHS ? locale : 'en') as LegLocale][Number(m[2]) - 1];
    if (!month) return null;
    return `${Number(m[3])} ${month} ${m[1]}, ${m[4]}:${m[5]}`;
}

/** Local code list first, then the provider's name, then the bare code (never empty-blocking). */
export function airlineDisplayName(code: string | null | undefined, providerName?: string | null): string | null {
    const normalized = code?.trim().toUpperCase();
    if (normalized && AIRLINE_NAMES[normalized]) return AIRLINE_NAMES[normalized];
    return providerName?.trim() || normalized || null;
}

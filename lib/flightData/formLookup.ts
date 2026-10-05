// lib/flightData/formLookup.ts
//
// The sign-up form's "find my flight" step: number + date in, the provider's
// legs out. Protections, in order:
//   1. per-IP limit (10 / hour, hashed IP) — every request counts, cached or not
//   2. 6-hour DB cache per (flight number, date) — found AND not-found results
//   3. the monthly quota: when it is critical the lookup is skipped (FORM_LOOKUP
//      is only allowed below 95 %), and any provider failure is not an error
// None of the failure modes blocks the form: SKIPPED / RATE_LIMITED mean "carry
// on as before, verify after opt-in". Only a definitive NOT_FOUND blocks, and
// only close to departure (≤7 days — see lib/guardian/flightVerification.ts).
//
// Storage and the provider are injected so the logic is testable without them.

import type { FlightLegOption } from '@/lib/flightData/legs';
import type { FlightLegsResult } from '@/lib/flightData/client';
import { notFoundDecision } from '@/lib/guardian/flightVerification';

export const LOOKUP_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
export const LOOKUP_RATE_WINDOW_MS = 60 * 60 * 1000;
export const LOOKUP_LIMIT_PER_IP = 10;

export type CachedOutcome = 'FOUND' | 'NOT_FOUND';

export interface LookupCacheEntry {
    outcome: CachedOutcome;
    options: FlightLegOption[];
    fetchedAt: Date;
}

export interface FormLookupDeps {
    countRecentAttempts(ipHash: string, since: Date): Promise<number>;
    recordAttempt(ipHash: string, at: Date): Promise<void>;
    getCache(flightNumber: string, date: string): Promise<LookupCacheEntry | null>;
    putCache(flightNumber: string, date: string, entry: LookupCacheEntry): Promise<void>;
    lookupLegs(flightNumber: string, date: string): Promise<FlightLegsResult>;
}

export type FormLookupResponse =
    | { status: 'FOUND'; options: FlightLegOption[]; cached: boolean }
    // blocking: ≤7 days to departure — the number/date is probably wrong, don't submit.
    // Otherwise the schedule may simply not be published yet; submit is allowed.
    | { status: 'NOT_FOUND'; blocking: boolean; cached: boolean }
    // Carry on as today: no lookup happened (quota) or the provider failed.
    | { status: 'SKIPPED'; reason: 'QUOTA' | 'UNAVAILABLE' }
    | { status: 'RATE_LIMITED' };

/** Departure is only known as a date here; the lifecycle assumes 12:00 UTC for those. */
export const departureFromDate = (date: string): Date => new Date(`${date}T12:00:00.000Z`);

export const isCacheFresh = (entry: LookupCacheEntry, now: Date): boolean =>
    now.getTime() - entry.fetchedAt.getTime() < LOOKUP_CACHE_TTL_MS;

const fromEntry = (entry: LookupCacheEntry, date: string, now: Date): FormLookupResponse =>
    entry.outcome === 'FOUND'
        ? { status: 'FOUND', options: entry.options, cached: true }
        : { status: 'NOT_FOUND', blocking: notFoundDecision(departureFromDate(date), now) === 'DEFINITE', cached: true };

export async function runFormLookup(
    input: { flightNumber: string; date: string; ipHash: string | null; now?: Date },
    deps: FormLookupDeps,
): Promise<FormLookupResponse> {
    const now = input.now ?? new Date();
    const { flightNumber, date, ipHash } = input;

    if (ipHash) {
        const recent = await deps.countRecentAttempts(ipHash, new Date(now.getTime() - LOOKUP_RATE_WINDOW_MS));
        if (recent >= LOOKUP_LIMIT_PER_IP) return { status: 'RATE_LIMITED' };
        await deps.recordAttempt(ipHash, now);
    }

    try {
        const cached = await deps.getCache(flightNumber, date);
        if (cached && isCacheFresh(cached, now)) return fromEntry(cached, date, now);
    } catch (error) {
        console.error('[FormLookup] cache read failed, continuing without cache', error);
    }

    let result: FlightLegsResult;
    try {
        result = await deps.lookupLegs(flightNumber, date);
    } catch (error) {
        console.error('[FormLookup] provider lookup threw', error);
        return { status: 'SKIPPED', reason: 'UNAVAILABLE' };
    }

    const store = (entry: LookupCacheEntry) =>
        deps.putCache(flightNumber, date, entry).catch((error) => console.error('[FormLookup] cache write failed', error));

    if (result.ok) {
        await store({ outcome: 'FOUND', options: result.legs, fetchedAt: now });
        return { status: 'FOUND', options: result.legs, cached: false };
    }
    if (result.code === 'NOT_FOUND') {
        await store({ outcome: 'NOT_FOUND', options: [], fetchedAt: now });
        return { status: 'NOT_FOUND', blocking: notFoundDecision(departureFromDate(date), now) === 'DEFINITE', cached: false };
    }
    // Quota, credentials, HTTP error, timeout, bad flight number: never cached, never blocking.
    console.warn(`[FormLookup] ${flightNumber} ${date}: ${result.code} — form continues without verification`);
    return { status: 'SKIPPED', reason: result.code === 'QUOTA_BLOCKED' ? 'QUOTA' : 'UNAVAILABLE' };
}

// ── What /api/trips/track does with an earlier lookup ───────────────────────

export type SelectionCode = 'SEGMENT_REQUIRED' | 'INVALID_SEGMENT' | 'FLIGHT_NOT_FOUND';

export type SelectionResult =
    | { action: 'VERIFIED'; leg: FlightLegOption }
    | { action: 'UNVERIFIED' }                 // no usable lookup: create the trip as before
    | { action: 'BLOCK'; code: SelectionCode };

/**
 * The server never trusts route data from the client: it only takes the leg
 * KEY and resolves it against its own cached lookup.
 *  - no/expired lookup → UNVERIFIED (registration lookup happens at opt-in, as before)
 *  - NOT_FOUND ≤7 days → BLOCK; >7 days → UNVERIFIED (verified closer to departure)
 *  - FOUND, one leg → that leg; several legs → the user must have chosen one
 */
export function resolveFlightSelection(input: {
    cache: LookupCacheEntry | null;
    date: string;
    legKey?: string | null;
    now?: Date;
}): SelectionResult {
    const now = input.now ?? new Date();
    const { cache, legKey } = input;
    if (!cache || !isCacheFresh(cache, now)) return { action: 'UNVERIFIED' };

    if (cache.outcome === 'NOT_FOUND') {
        return notFoundDecision(departureFromDate(input.date), now) === 'DEFINITE'
            ? { action: 'BLOCK', code: 'FLIGHT_NOT_FOUND' }
            : { action: 'UNVERIFIED' };
    }

    if (legKey) {
        const leg = cache.options.find((o) => o.key === legKey);
        return leg ? { action: 'VERIFIED', leg } : { action: 'BLOCK', code: 'INVALID_SEGMENT' };
    }
    if (cache.options.length === 1) return { action: 'VERIFIED', leg: cache.options[0] };
    return { action: 'BLOCK', code: 'SEGMENT_REQUIRED' };
}

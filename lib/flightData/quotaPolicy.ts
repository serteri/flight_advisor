// lib/flightData/quotaPolicy.ts
//
// Pure quota rules for the flight-data provider (AeroDataBox). No I/O here so
// the thresholds and the checkpoint gating can be unit tested.

export type CheckKind =
    | 'REGISTRATION'       // one lookup when the trip is created (route + schedule)
    | 'DEP_MINUS_24H'
    | 'DEP_MINUS_3H'
    | 'DEP'
    | 'ARR_PLUS_1H'
    | 'ARR_PLUS_4H'
    | 'EXTRA_ARR_PLUS_1H'  // at most one, only when a ≥180 min delay looks likely
    | 'FORM_LOOKUP'        // "find my flight" step of the sign-up form (before double opt-in)
    | 'VERIFY_FLIGHT'      // far-future flight not found at registration: one re-check at departure −7 days
    | 'COMPLETE';          // marks the trip COMPLETED; never calls the provider

// Hard cap of provider calls per trip: 1 registration + 1 verification (far-
// future flights only) + 5 checkpoints + 1 extra.
export const MAX_CALLS_PER_TRIP = 8;
// Typical trip: registration + 5 checkpoints, no extra check.
export const EXPECTED_CALLS_PER_TRIP = 6;

export const DEFAULT_MONTHLY_QUOTA_UNITS = 600;
export const DEFAULT_UNITS_PER_CALL = 2;

export type QuotaLevel = 'OK' | 'SKIP_EARLY' | 'CRITICAL' | 'EXHAUSTED';

export const QUOTA_THRESHOLDS = [80, 95, 100] as const;

export interface QuotaConfig {
    monthlyQuotaUnits: number;
    unitsPerCall: number;
}

const positiveInt = (raw: string | undefined, fallback: number): number => {
    const value = Number.parseInt(String(raw ?? ''), 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
};

export function getQuotaConfig(env: Record<string, string | undefined> = process.env): QuotaConfig {
    return {
        monthlyQuotaUnits: positiveInt(env.AERODATABOX_MONTHLY_QUOTA, DEFAULT_MONTHLY_QUOTA_UNITS),
        unitsPerCall: positiveInt(env.AERODATABOX_UNITS_PER_CALL, DEFAULT_UNITS_PER_CALL),
    };
}

// Maximum provider calls per month under the configured quota.
export function getMonthlyCallCapacity(config: QuotaConfig): number {
    return Math.floor(config.monthlyQuotaUnits / config.unitsPerCall);
}

// Provider calls per month for N sign-up form submissions (docs/PHASE2_FLIGHT_LOOKUP.md).
//   form lookups : N × lookupsPerSubmission × (1 − cacheHitRate)   — made BEFORE opt-in
//   monitoring   : N × confirmRate × callsPerConfirmedTrip         — after opt-in
// The registration lookup at opt-in is replaced by the form lookup for trips whose leg
// was resolved there, so a confirmed trip needs one call fewer (5 instead of 6).
export function estimateMonthlyCalls(input: {
    submissions: number;
    lookupsPerSubmission?: number;   // >1: typo fixes, several legs tried
    cacheHitRate?: number;           // 0..1, same flight + date within 6 h
    confirmRate?: number;            // 0..1, share of submissions that open the email link
    callsPerConfirmedTrip?: number;  // 5 checkpoints (registration came from the form)
}): { formLookups: number; monitoring: number; total: number } {
    const lookups = input.lookupsPerSubmission ?? 1.3;
    const hit = input.cacheHitRate ?? 0;
    const confirm = input.confirmRate ?? 0.6;
    const perTrip = input.callsPerConfirmedTrip ?? EXPECTED_CALLS_PER_TRIP - 1;
    const formLookups = input.submissions * lookups * (1 - hit);
    const monitoring = input.submissions * confirm * perTrip;
    return { formLookups, monitoring, total: formLookups + monitoring };
}

// How many trips a month the quota can cover in the worst case (every trip
// uses all MAX_CALLS_PER_TRIP calls) and in the typical case.
export function getMonthlyTripCapacity(config: QuotaConfig): { worstCase: number; typical: number } {
    const calls = getMonthlyCallCapacity(config);
    return {
        worstCase: Math.floor(calls / MAX_CALLS_PER_TRIP),
        typical: Math.floor(calls / EXPECTED_CALLS_PER_TRIP),
    };
}

export interface QuotaUsageSnapshot {
    unitsUsed: number;
    headerLimit?: number | null;
    headerRemaining?: number | null;
}

// Fraction of the monthly quota consumed (0..1+). Provider headers win over
// our own counter because they include calls made outside this app.
export function computeUsageRatio(usage: QuotaUsageSnapshot, config: QuotaConfig): number {
    const { headerLimit, headerRemaining } = usage;
    if (typeof headerLimit === 'number' && headerLimit > 0 && typeof headerRemaining === 'number') {
        return Math.max(0, (headerLimit - headerRemaining) / headerLimit);
    }
    return usage.unitsUsed / config.monthlyQuotaUnits;
}

export function getQuotaLevel(ratio: number): QuotaLevel {
    if (ratio >= 1) return 'EXHAUSTED';
    if (ratio >= 0.95) return 'CRITICAL';
    if (ratio >= 0.8) return 'SKIP_EARLY';
    return 'OK';
}

// Highest threshold (80/95/100) reached by `ratio`, or 0.
export function reachedThreshold(ratio: number): number {
    let reached = 0;
    for (const threshold of QUOTA_THRESHOLDS) {
        if (ratio * 100 >= threshold) reached = threshold;
    }
    return reached;
}

// Whether a checkpoint may spend a provider call at the given quota level.
//   ≥80%  skip the departure −24h check
//   ≥95%  only the departure and arrival +4h checks remain
//   100%  no provider calls at all
export function isCheckAllowed(kind: CheckKind, level: QuotaLevel): boolean {
    if (kind === 'COMPLETE') return true;
    // A convenience lookup made before the visitor has confirmed anything: gives
    // way once the quota is critical so the remaining calls go to monitoring.
    if (kind === 'FORM_LOOKUP') return level === 'OK' || level === 'SKIP_EARLY';
    if (level === 'EXHAUSTED') return false;
    // VERIFY_FLIGHT decides whether the trip is monitored at all (one call).
    if (level === 'CRITICAL') return kind === 'DEP' || kind === 'ARR_PLUS_4H' || kind === 'VERIFY_FLIGHT';
    if (level === 'SKIP_EARLY') return kind !== 'DEP_MINUS_24H';
    return true;
}

// Reads RapidAPI rate-limit headers: x-ratelimit-<object>-limit/remaining.
// Prefers a "units" object when present, otherwise "requests".
export function parseRateLimitHeaders(headers: Headers | Record<string, string | null | undefined>):
    { kind: string; limit: number; remaining: number } | null {
    const entries: Array<[string, string]> = [];
    if (typeof (headers as Headers).forEach === 'function') {
        (headers as Headers).forEach((value, name) => entries.push([name.toLowerCase(), value]));
    } else {
        for (const [name, value] of Object.entries(headers)) {
            if (value != null) entries.push([name.toLowerCase(), String(value)]);
        }
    }

    const byObject = new Map<string, { limit?: number; remaining?: number }>();
    for (const [name, value] of entries) {
        const match = name.match(/^x-ratelimit-(.+)-(limit|remaining)$/);
        if (!match) continue;
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed)) continue;
        const current = byObject.get(match[1]) ?? {};
        current[match[2] as 'limit' | 'remaining'] = parsed;
        byObject.set(match[1], current);
    }

    const complete = [...byObject.entries()].filter(
        ([, v]) => typeof v.limit === 'number' && typeof v.remaining === 'number',
    );
    if (complete.length === 0) return null;

    const preferred = complete.find(([kind]) => kind.includes('unit'))
        ?? complete.find(([kind]) => kind.includes('request'))
        ?? complete[0];
    return { kind: preferred[0], limit: preferred[1].limit!, remaining: preferred[1].remaining! };
}

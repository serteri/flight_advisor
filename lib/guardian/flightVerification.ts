// lib/guardian/flightVerification.ts
//
// When is "the provider doesn't know this flight" definitive?
//
// AeroDataBox answers 204 No Content both for a flight that doesn't exist and
// for a real flight whose schedule the airline hasn't published yet (its spec
// lists 200/204/400/401/451/500/503 for /flights/number/{n}/{date}; schedules
// reach "up to 365 days in the future … depending on how far in the future
// airlines publish their schedules"). So NOT_FOUND is only accepted as final
// within VERIFY_DAYS_BEFORE days of departure:
//
//   ≤ 7 days to departure → DEFINITE → FLIGHT_NOT_FOUND flow (one email)
//   > 7 days              → DEFER    → PENDING_VERIFICATION, no email, a single
//                                        VERIFY_FLIGHT checkpoint at departure −7 days
//
// At that checkpoint: found → ACTIVE + the normal checkpoint plan; not found →
// FLIGHT_NOT_FOUND flow. Other lookup failures there (quota, HTTP) retry later.

import type { PlannedCheck } from '@/lib/guardian/checkpoints';

export const VERIFY_DAYS_BEFORE = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
export const VERIFY_RETRY_MS = 12 * 60 * 60 * 1000;

export type NotFoundDecision = 'DEFINITE' | 'DEFER';

export function notFoundDecision(departureUtc: Date, now: Date): NotFoundDecision {
    return departureUtc.getTime() - now.getTime() <= VERIFY_DAYS_BEFORE * DAY_MS ? 'DEFINITE' : 'DEFER';
}

/** The single verification checkpoint: departure − 7 days (never in the past). */
export function verificationCheck(departureUtc: Date, now: Date): PlannedCheck {
    const at = new Date(departureUtc.getTime() - VERIFY_DAYS_BEFORE * DAY_MS);
    return { kind: 'VERIFY_FLIGHT', runAt: at.getTime() > now.getTime() ? at : now };
}

/**
 * A VERIFY_FLIGHT check that couldn't reach a verdict (quota, HTTP error):
 * retry in 12 h while that is still before departure; otherwise give up on
 * verifying and monitor with the approximate plan (as before validation existed).
 */
export function verificationRetry(departureUtc: Date, now: Date): PlannedCheck | null {
    const next = new Date(now.getTime() + VERIFY_RETRY_MS);
    return next.getTime() < departureUtc.getTime() ? { kind: 'VERIFY_FLIGHT', runAt: next } : null;
}

export type VerifyOutcome =
    | { action: 'ACTIVATE' }                         // found → ACTIVE + normal plan
    | { action: 'NOT_FOUND' }                        // still not found at −7 days → FLIGHT_NOT_FOUND flow
    | { action: 'RETRY'; check: PlannedCheck }       // no verdict (quota/HTTP) → try again in 12 h
    | { action: 'ACTIVATE_APPROXIMATE' };            // no verdict and no time left / call cap → monitor anyway

/** What the VERIFY_FLIGHT checkpoint does with a lookup result (null = call cap reached). */
export function verifyCheckOutcome(
    result: { ok: true } | { ok: false; code: string } | null,
    departureUtc: Date,
    now: Date,
): VerifyOutcome {
    if (result === null) return { action: 'ACTIVATE_APPROXIMATE' };
    if (result.ok) return { action: 'ACTIVATE' };
    if (result.code === 'NOT_FOUND') return { action: 'NOT_FOUND' };
    const retry = verificationRetry(departureUtc, now);
    return retry ? { action: 'RETRY', check: retry } : { action: 'ACTIVATE_APPROXIMATE' };
}

export interface PendingVerificationDeps {
    /** ACTIVE → PENDING_VERIFICATION; true only if this call changed the status. */
    transitionToPending(tripId: string): Promise<boolean>;
    cancelRemainingChecks(tripId: string, excludeCheckId?: string): Promise<number>;
    scheduleChecks(tripId: string, checks: PlannedCheck[]): Promise<void>;
}

/** Far-future NOT_FOUND: park the trip, no email, one verification checkpoint. */
export async function deferVerification(
    tripId: string,
    departureUtc: Date,
    now: Date,
    deps: PendingVerificationDeps,
    options: { excludeCheckId?: string } = {},
): Promise<{ transitioned: boolean; check: PlannedCheck | null }> {
    if (!(await deps.transitionToPending(tripId))) return { transitioned: false, check: null };
    await deps.cancelRemainingChecks(tripId, options.excludeCheckId);
    const check = verificationCheck(departureUtc, now);
    await deps.scheduleChecks(tripId, [check]);
    console.log(`[Guardian] Trip ${tripId}: flight not found >${VERIFY_DAYS_BEFORE}d before departure → PENDING_VERIFICATION, re-check at ${check.runAt.toISOString()}`);
    return { transitioned: true, check };
}

export async function defaultPendingVerificationDeps(): Promise<PendingVerificationDeps> {
    const { prisma } = await import('@/lib/prisma');
    const { cancelPendingChecks, scheduleTripChecks } = await import('@/lib/guardian/scheduler');
    return {
        async transitionToPending(tripId) {
            const res = await prisma.monitoredTrip.updateMany({
                where: { id: tripId, status: 'ACTIVE' },
                data: { status: 'PENDING_VERIFICATION', lastCheckedAt: new Date() },
            });
            return res.count === 1;
        },
        cancelRemainingChecks: (tripId, excludeCheckId) => cancelPendingChecks(tripId, { excludeCheckId }),
        scheduleChecks: (tripId, checks) => scheduleTripChecks(tripId, checks),
    };
}

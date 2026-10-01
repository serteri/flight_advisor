// lib/guardian/checkpoints.ts
//
// Pure planning of event-driven monitoring checkpoints. A trip is checked at
// fixed points around its schedule instead of by a polling cron:
//
//   departure −24h, departure −3h, departure, arrival +1h, arrival +4h
//   (+ one EXTRA check at estimated arrival +1h when a ≥180 min delay looks likely)
//   (+ COMPLETE at scheduled arrival +48h — no provider call, closes the trip)

import type { CheckKind } from '@/lib/flightData/quotaPolicy';

const HOUR_MS = 60 * 60 * 1000;

export const COMPLETION_DELAY_MS = 48 * HOUR_MS;
// Estimated arrival this far past schedule triggers the single extra check.
export const EXTRA_CHECK_DELAY_THRESHOLD_MIN = 150;
// Provider schedule changes smaller than this do not trigger re-planning.
export const RESCHEDULE_TOLERANCE_MS = 15 * 60 * 1000;
// Used when the provider has not given us an arrival time yet.
export const FALLBACK_BLOCK_TIME_MS = 3 * HOUR_MS;

export interface PlannedCheck {
    kind: CheckKind;
    runAt: Date;
}

export interface TripSchedule {
    departureUtc: Date;
    arrivalUtc: Date;
    approximate: boolean; // true when times are guessed from the flight date only
}

const OFFSETS: Array<{ kind: CheckKind; anchor: 'dep' | 'arr'; offsetMs: number }> = [
    { kind: 'DEP_MINUS_24H', anchor: 'dep', offsetMs: -24 * HOUR_MS },
    { kind: 'DEP_MINUS_3H', anchor: 'dep', offsetMs: -3 * HOUR_MS },
    { kind: 'DEP', anchor: 'dep', offsetMs: 0 },
    { kind: 'ARR_PLUS_1H', anchor: 'arr', offsetMs: 1 * HOUR_MS },
    { kind: 'ARR_PLUS_4H', anchor: 'arr', offsetMs: 4 * HOUR_MS },
    { kind: 'COMPLETE', anchor: 'arr', offsetMs: COMPLETION_DELAY_MS },
];

// Resolves the schedule to plan against. Provider UTC times win; otherwise the
// stored flight date is used (midnight-only dates are assumed to depart 12:00 UTC).
export function resolveTripSchedule(input: {
    scheduledDepartureUtc?: Date | null;
    scheduledArrivalUtc?: Date | null;
    departureDate: Date;
    arrivalDate?: Date | null;
}): TripSchedule {
    if (input.scheduledDepartureUtc) {
        const arrival = input.scheduledArrivalUtc
            ?? new Date(input.scheduledDepartureUtc.getTime() + FALLBACK_BLOCK_TIME_MS);
        return {
            departureUtc: input.scheduledDepartureUtc,
            arrivalUtc: arrival,
            approximate: !input.scheduledArrivalUtc,
        };
    }

    const dep = new Date(input.departureDate.getTime());
    const isDateOnly = dep.getUTCHours() === 0 && dep.getUTCMinutes() === 0 && dep.getUTCSeconds() === 0;
    if (isDateOnly) dep.setUTCHours(12, 0, 0, 0);

    const arrivalCandidate = input.arrivalDate && input.arrivalDate.getTime() > dep.getTime() ? input.arrivalDate : null;
    return {
        departureUtc: dep,
        arrivalUtc: arrivalCandidate ?? new Date(dep.getTime() + FALLBACK_BLOCK_TIME_MS),
        approximate: true,
    };
}

export function monitoringEndsAt(schedule: TripSchedule): Date {
    return new Date(schedule.arrivalUtc.getTime() + COMPLETION_DELAY_MS);
}

// All regular checkpoints strictly in the future. Past points are skipped;
// COMPLETE is always kept (runs immediately if already due).
export function planCheckpoints(schedule: TripSchedule, now: Date): PlannedCheck[] {
    const planned: PlannedCheck[] = [];
    for (const { kind, anchor, offsetMs } of OFFSETS) {
        const base = anchor === 'dep' ? schedule.departureUtc : schedule.arrivalUtc;
        const runAt = new Date(base.getTime() + offsetMs);
        if (kind === 'COMPLETE') {
            planned.push({ kind, runAt: runAt.getTime() > now.getTime() ? runAt : now });
            continue;
        }
        if (runAt.getTime() > now.getTime()) {
            planned.push({ kind, runAt });
        }
    }
    return planned;
}

export function scheduleChanged(
    previous: { departureUtc: Date | null; arrivalUtc: Date | null },
    next: { departureUtc: Date | null; arrivalUtc: Date | null },
): boolean {
    const differs = (a: Date | null, b: Date | null) => {
        if (!b) return false; // provider gave nothing new
        if (!a) return true;  // first time we learn the time
        return Math.abs(a.getTime() - b.getTime()) >= RESCHEDULE_TOLERANCE_MS;
    };
    return differs(previous.departureUtc, next.departureUtc) || differs(previous.arrivalUtc, next.arrivalUtc);
}

// Returns when to run the single extra check, or null. Triggered only when the
// estimated arrival is ≥150 min after the scheduled arrival and it has not
// been used yet for this trip.
export function planExtraCheck(input: {
    scheduledArrivalUtc: Date | null;
    estimatedArrivalUtc: Date | null;
    now: Date;
    extraAlreadyPlanned: boolean;
}): Date | null {
    if (input.extraAlreadyPlanned) return null;
    if (!input.scheduledArrivalUtc || !input.estimatedArrivalUtc) return null;

    const delayMin = (input.estimatedArrivalUtc.getTime() - input.scheduledArrivalUtc.getTime()) / 60000;
    if (delayMin < EXTRA_CHECK_DELAY_THRESHOLD_MIN) return null;

    const runAt = new Date(input.estimatedArrivalUtc.getTime() + HOUR_MS);
    return runAt.getTime() > input.now.getTime() ? runAt : null;
}

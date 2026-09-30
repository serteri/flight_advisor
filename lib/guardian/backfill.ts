// lib/guardian/backfill.ts
//
// Pure decision logic for scripts/backfill-checkpoints.ts: which ACTIVE trips
// created before the QStash migration still need a checkpoint plan.

import { planCheckpoints, resolveTripSchedule, type PlannedCheck } from '@/lib/guardian/checkpoints';

export type BackfillAction =
    | 'SKIP_ALREADY_SCHEDULED' // a QStash message id exists → idempotent skip
    | 'SKIP_NO_SEGMENT'
    | 'PAST_ARRIVAL'           // scheduled arrival already passed → only --complete-past touches it
    | 'SCHEDULE';

export interface BackfillCandidate {
    hasScheduledMessage: boolean;
    segment: {
        departureDate: Date;
        arrivalDate: Date | null;
        scheduledDepartureUtc: Date | null;
        scheduledArrivalUtc: Date | null;
    } | null;
}

export interface BackfillDecision {
    action: BackfillAction;
    /** Future checkpoints only (past ones are never scheduled). Empty unless SCHEDULE. */
    checks: PlannedCheck[];
    arrivalUtc: Date | null;
}

// ── CLI modes ────────────────────────────────────────────────────────────────
// SCHEDULE      plan checkpoints for future ACTIVE trips (needs QStash to --apply)
// COMPLETE_PAST only mark ACTIVE trips whose arrival passed as COMPLETED —
//               no scheduling, no provider lookups, no QStash.
export type BackfillMode = 'SCHEDULE' | 'COMPLETE_PAST';

export type BackfillArgs =
    | { ok: true; mode: BackfillMode; apply: boolean }
    | { ok: false; reason: string };

export function parseBackfillArgs(args: string[]): BackfillArgs {
    const known = new Set(['--apply', '--dry-run', '--complete-past']);
    const unknown = args.filter((a) => !known.has(a));
    if (unknown.length) return { ok: false, reason: `Unknown argument(s): ${unknown.join(', ')}` };
    const apply = args.includes('--apply');
    if (apply && args.includes('--dry-run')) return { ok: false, reason: '--apply and --dry-run are mutually exclusive' };
    return { ok: true, mode: args.includes('--complete-past') ? 'COMPLETE_PAST' : 'SCHEDULE', apply };
}

/** Only scheduling writes need QStash; completing past trips never publishes. */
export function backfillNeedsQStash(mode: BackfillMode, apply: boolean): boolean {
    return mode === 'SCHEDULE' && apply;
}

export function classifyForBackfill(candidate: BackfillCandidate, now: Date): BackfillDecision {
    if (candidate.hasScheduledMessage) return { action: 'SKIP_ALREADY_SCHEDULED', checks: [], arrivalUtc: null };
    if (!candidate.segment) return { action: 'SKIP_NO_SEGMENT', checks: [], arrivalUtc: null };

    const schedule = resolveTripSchedule(candidate.segment);
    if (schedule.arrivalUtc.getTime() <= now.getTime()) {
        return { action: 'PAST_ARRIVAL', checks: [], arrivalUtc: schedule.arrivalUtc };
    }
    return { action: 'SCHEDULE', checks: planCheckpoints(schedule, now), arrivalUtc: schedule.arrivalUtc };
}

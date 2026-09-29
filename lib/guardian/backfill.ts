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

export function classifyForBackfill(candidate: BackfillCandidate, now: Date): BackfillDecision {
    if (candidate.hasScheduledMessage) return { action: 'SKIP_ALREADY_SCHEDULED', checks: [], arrivalUtc: null };
    if (!candidate.segment) return { action: 'SKIP_NO_SEGMENT', checks: [], arrivalUtc: null };

    const schedule = resolveTripSchedule(candidate.segment);
    if (schedule.arrivalUtc.getTime() <= now.getTime()) {
        return { action: 'PAST_ARRIVAL', checks: [], arrivalUtc: schedule.arrivalUtc };
    }
    return { action: 'SCHEDULE', checks: planCheckpoints(schedule, now), arrivalUtc: schedule.arrivalUtc };
}

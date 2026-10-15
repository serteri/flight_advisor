// lib/guardian/disruptionContent.ts
//
// ONE place that decides how a Guardian change is classified, described and
// what the user should do. The notifier (emails/SMS/push) and the trip page
// ("What changed" / "What should I do?") both use it, so the rules cannot drift.
//
// Pure: no database, no provider. Deterministic rule-based guidance, no AI, no
// legal advice. Unknown stays unknown: nothing is invented (causes, policies,
// alternative flights, gate or terminal values).

import { airlineActions, type AirlineActions } from '@/lib/guardian/airlineActions';

export type ChangeSeverity = 'INFO' | 'IMPORTANT' | 'CRITICAL';

// ── Product thresholds (not legal eligibility thresholds) ───────────────────

/** Arrival-delay buckets the worker fires events on (a new event only when a higher bucket is reached). */
export const DELAY_BUCKETS = [15, 30, 60, 120, 180, 240] as const;

export const getDelayBucket = (minutes: number): number => {
    let bucket = 0;
    for (const threshold of DELAY_BUCKETS) if (minutes >= threshold) bucket = threshold;
    return bucket;
};

export const DELAY_NOTIFY_MIN = 30;       // below: dashboard/history only
export const DELAY_CRITICAL_MIN = 120;
export const GATE_NOTIFY_WITHIN_HOURS = 6; // gate/terminal changes further out are history only
export const SCHEDULE_NOTIFY_MIN = 30;
export const SCHEDULE_CRITICAL_MIN = 180;

export type ChangeFacts =
    | { kind: 'DELAY'; minutes: number; previousMinutes: number }
    | { kind: 'CANCELLATION' }
    | { kind: 'GATE_CHANGE'; from: string | null; to: string | null; which: 'departure' | 'arrival'; hoursToDeparture: number | null }
    | { kind: 'TERMINAL_CHANGE'; from: string | null; to: string | null; hoursToDeparture: number | null }
    | { kind: 'SCHEDULE_CHANGE'; shiftMinutes: number; from?: string | null; to?: string | null; airportOrDateChanged?: boolean };

export interface FlightIdentity {
    flightNumber: string | null;      // "QF549"
    airlineCode: string | null;       // "QF"
    airlineName?: string | null;      // "Qantas"
    origin: string | null;
    destination: string | null;
}

export const flightLabel = (flight: FlightIdentity): string => flight.flightNumber || 'your flight';
export const routeLabel = (flight: FlightIdentity): string | null =>
    flight.origin && flight.destination ? `${flight.origin} → ${flight.destination}` : null;

// ── Severity ────────────────────────────────────────────────────────────────

export function classifyChange(facts: ChangeFacts): ChangeSeverity {
    switch (facts.kind) {
        case 'CANCELLATION':
            return 'CRITICAL';
        case 'DELAY':
            if (facts.minutes >= DELAY_CRITICAL_MIN) return 'CRITICAL';
            return facts.minutes >= DELAY_NOTIFY_MIN ? 'IMPORTANT' : 'INFO';
        case 'GATE_CHANGE':
        case 'TERMINAL_CHANGE':
            // Unknown timing is not assumed to be urgent.
            return facts.hoursToDeparture !== null && facts.hoursToDeparture >= 0 && facts.hoursToDeparture <= GATE_NOTIFY_WITHIN_HOURS
                ? 'IMPORTANT' : 'INFO';
        case 'SCHEDULE_CHANGE': {
            const shift = Math.abs(facts.shiftMinutes);
            if (facts.airportOrDateChanged || shift >= SCHEDULE_CRITICAL_MIN) return 'CRITICAL';
            return shift >= SCHEDULE_NOTIFY_MIN ? 'IMPORTANT' : 'INFO';
        }
    }
}

/**
 * Should this change reach the user? Severity must be IMPORTANT+, and a delay must be a
 * MATERIAL step beyond what the user was already told (a higher bucket than before),
 * so an unchanged or barely changed delay never produces a second email.
 */
export function isNotifiable(facts: ChangeFacts): boolean {
    if (classifyChange(facts) === 'INFO') return false;
    if (facts.kind === 'DELAY') return getDelayBucket(facts.minutes) > getDelayBucket(facts.previousMinutes);
    return true;
}

// ── What changed ────────────────────────────────────────────────────────────

export interface ChangeDescription {
    headline: string;     // "Arrival delay detected"
    whatChanged: string;  // one plain sentence
    before: string | null;
    now: string | null;
    delta: string | null;
}

const min = (n: number) => `${n} minute${n === 1 ? '' : 's'}`;

export function describeChange(facts: ChangeFacts, flight: FlightIdentity): ChangeDescription {
    const f = flightLabel(flight);
    switch (facts.kind) {
        case 'DELAY':
            return {
                headline: 'Arrival delay detected',
                whatChanged: `${f} is now expected to arrive ${min(facts.minutes)} later than scheduled.`,
                before: facts.previousMinutes > 0 ? `${min(facts.previousMinutes)} late` : 'On schedule',
                now: `${min(facts.minutes)} late`,
                delta: `+${min(facts.minutes)}`,
            };
        case 'CANCELLATION':
            return {
                headline: 'Flight cancellation detected',
                whatChanged: `${f} is now reported as cancelled.`,
                before: null,
                now: 'Cancelled',
                delta: null,
            };
        case 'GATE_CHANGE': {
            const which = facts.which === 'arrival' ? 'Arrival' : 'Departure';
            const known = facts.from && facts.to;
            return {
                headline: `${which} gate changed`,
                whatChanged: known
                    ? `${which} gate changed from ${facts.from} to ${facts.to}.`
                    : facts.to ? `${which} gate is now ${facts.to}.` : `${which} gate information changed.`,
                before: facts.from,
                now: facts.to,
                delta: null,
            };
        }
        case 'TERMINAL_CHANGE': {
            const known = facts.from && facts.to;
            return {
                headline: 'Terminal changed',
                whatChanged: known ? `Departure terminal changed from ${facts.from} to ${facts.to}.` : facts.to ? `Departure terminal is now ${facts.to}.` : 'Departure terminal information changed.',
                before: facts.from,
                now: facts.to,
                delta: null,
            };
        }
        case 'SCHEDULE_CHANGE': {
            const shift = Math.abs(facts.shiftMinutes);
            const direction = facts.shiftMinutes < 0 ? 'earlier' : 'later';
            return {
                headline: 'Schedule changed',
                whatChanged: facts.from && facts.to
                    ? `Scheduled departure changed from ${facts.from} to ${facts.to}.`
                    : `Scheduled departure moved ${min(shift)} ${direction}.`,
                before: facts.from ?? null,
                now: facts.to ?? null,
                delta: `${facts.shiftMinutes < 0 ? '-' : '+'}${min(shift)}`,
            };
        }
    }
}

// ── What should I do? ───────────────────────────────────────────────────────

export interface ActionGuidance {
    required: boolean;      // does the user need to do something now?
    summary: string;        // short state for the dashboard card
    steps: string[];        // plain, deterministic guidance
}

export function actionGuidance(facts: ChangeFacts | null, airlineName?: string | null): ActionGuidance {
    const named = airlineName?.trim() || null;
    const theApp = named ? `the ${named} app` : "your airline's app";
    const withAirline = named ?? 'your airline';
    if (!facts) return { required: false, summary: 'No action needed', steps: ['No action needed. FlightAgent will keep monitoring this flight.'] };
    switch (facts.kind) {
        case 'CANCELLATION':
            return {
                required: true,
                summary: 'Rebooking recommended',
                steps: [
                    named ? `Open the ${named} Manage Booking page or app and review rebooking or refund options.` : "Open your airline's Manage Booking page or app and review rebooking or refund options.",
                    'Keep your booking confirmation.',
                    'Keep receipts for reasonable additional expenses.',
                ],
            };
        case 'DELAY':
            if (facts.minutes >= 60) {
                return {
                    required: true,
                    summary: 'Check airline update',
                    steps: [
                        `Check the latest departure time and rebooking options with ${withAirline}.`,
                        'Keep receipts for additional expenses.',
                    ],
                };
            }
            if (facts.minutes >= DELAY_NOTIFY_MIN) {
                return {
                    required: true,
                    summary: 'Check airline update',
                    steps: [`Check ${theApp} before leaving for the airport. FlightAgent will continue monitoring.`],
                };
            }
            return { required: false, summary: 'No action needed', steps: ['No action needed yet. Keep your original airport arrival plan.'] };
        case 'GATE_CHANGE':
            return {
                required: true,
                summary: 'Gate changed: verify before boarding',
                steps: [facts.to ? 'Use the new gate shown above and confirm it again on airport displays when you arrive.' : 'Confirm your gate on airport displays when you arrive.'],
            };
        case 'TERMINAL_CHANGE':
            return {
                required: true,
                summary: 'Terminal changed: verify before travelling',
                steps: [`Allow extra time to reach the new terminal and verify the terminal in ${theApp}.`],
            };
        case 'SCHEDULE_CHANGE':
            return {
                required: classifyChange(facts) !== 'INFO',
                summary: classifyChange(facts) !== 'INFO' ? 'Check airline update' : 'No action needed',
                steps: [`Check the new time in ${theApp} and adjust your airport plans if needed.`],
            };
    }
}

// ── Compensation wording (existing hedged language; never standalone) ──────

export interface CompensationLike {
    regime?: string | null;
    status?: string | null;
    amount?: number | null;
    currency?: string | null;
}

/** Only for a meaningful disruption AND a LIKELY_ELIGIBLE engine result. NOT_ELIGIBLE / NEEDS_INFO / NONE add nothing. */
export function compensationNote(facts: ChangeFacts, assessment: CompensationLike | null | undefined): string | null {
    if (!assessment || assessment.status !== 'LIKELY_ELIGIBLE') return null;
    if (classifyChange(facts) === 'INFO') return null;
    if (facts.kind !== 'DELAY' && facts.kind !== 'CANCELLATION') return null;
    const scheme = !assessment.regime || assessment.regime === 'NONE' ? 'EU261/UK261' : assessment.regime;
    const amount = assessment.amount != null && assessment.currency ? ` (potentially ${assessment.currency} ${assessment.amount})` : '';
    return `FlightAgent currently estimates that this disruption may qualify for compensation under ${scheme}${amount}. The airline may claim extraordinary circumstances. This is not legal advice.`;
}

// ── Subject line (human, never an internal severity label) ─────────────────

export function emailSubject(facts: ChangeFacts, flight: FlightIdentity): string {
    const f = flightLabel(flight);
    switch (facts.kind) {
        case 'CANCELLATION': return `${f} has been cancelled`;
        case 'DELAY': return `${f} delayed by ${min(facts.minutes)}`;
        case 'GATE_CHANGE': return facts.to ? `${f} gate changed to ${facts.to}` : `${f} gate changed`;
        case 'TERMINAL_CHANGE': return facts.to ? `${f} terminal changed to ${facts.to}` : `${f} terminal changed`;
        case 'SCHEDULE_CHANGE': return `${f} schedule changed`;
    }
}

export type { AirlineActions };
export { airlineActions };

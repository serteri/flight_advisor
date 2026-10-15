// lib/guardian/tripPresentation.ts
//
// Presentation logic for the Guardian dashboard and trip page. It only READS
// what the monitoring engine already stored (TripSnapshot, ScheduledTripCheck,
// AlertEvent); it does not change what gets checked, stored or sent.
//
// Principles:
//  - "flight status" (what the airline/provider says) and "Guardian status"
//    (is our monitoring running) are separate.
//  - nothing is "On time" / "No change" until a real provider observation exists.
//  - nothing is derived from a hard-coded interval.


import { classifyChange, type ChangeFacts } from '@/lib/guardian/disruptionContent';
import { factsFromAlertEvent, type StoredAlertEvent } from '@/lib/guardian/notificationPolicy';

export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// ── Checkpoint labels (from ScheduledTripCheck.kind, never guessed from time gaps) ──

export const CHECK_KIND_LABEL_KEYS = {
    DEP_MINUS_24H: 'dep24',
    DEP_MINUS_3H: 'dep3',
    DEP: 'dep',
    ARR_PLUS_1H: 'arr1',
    ARR_PLUS_4H: 'arr4',
    EXTRA_ARR_PLUS_1H: 'arrExtra',
    VERIFY_FLIGHT: 'verify',
} as const;

export type CheckKindLabelKey = (typeof CHECK_KIND_LABEL_KEYS)[keyof typeof CHECK_KIND_LABEL_KEYS];

/** i18n key (GuardianV2.checkKind.*) for a check kind; null for kinds users should not see (COMPLETE, unknown). */
export function checkKindLabelKey(kind: string | null | undefined): CheckKindLabelKey | null {
    return (CHECK_KIND_LABEL_KEYS as Record<string, CheckKindLabelKey>)[kind ?? ''] ?? null;
}

export interface ScheduledCheckLike {
    kind: string;
    runAt: Date | string;
    status: string;
}

export interface NextCheck {
    runAt: Date;
    labelKey: CheckKindLabelKey | null;
}

/**
 * The next Guardian check: the earliest still-SCHEDULED provider check.
 * COMPLETE only closes the trip (no provider call) and is never "the next check".
 * No scheduled row → null ("Not scheduled yet"); trip.nextCheckAt is not used as a
 * fallback because it starts as "now" at creation.
 */
export function nextScheduledCheck(checks: readonly ScheduledCheckLike[] | null | undefined): NextCheck | null {
    let best: { runAt: Date; kind: string } | null = null;
    for (const check of checks ?? []) {
        if (check.status !== 'SCHEDULED' || check.kind === 'COMPLETE') continue;
        const runAt = new Date(check.runAt);
        if (Number.isNaN(runAt.getTime())) continue;
        if (!best || runAt.getTime() < best.runAt.getTime()) best = { runAt, kind: check.kind };
    }
    return best ? { runAt: best.runAt, labelKey: checkKindLabelKey(best.kind) } : null;
}

/** Earliest next check across several trips. */
export function earliestNextCheck(perTrip: ReadonlyArray<NextCheck | null>): NextCheck | null {
    let best: NextCheck | null = null;
    for (const next of perTrip) if (next && (!best || next.runAt.getTime() < best.runAt.getTime())) best = next;
    return best;
}

/**
 * The monitoring plan as the code actually scheduled it: ordered label keys of the
 * trip's regular checkpoints (any status, so past checks stay listed). Falls back to
 * the standard plan only when no check rows exist yet.
 */
export const STANDARD_PLAN_KEYS: CheckKindLabelKey[] = ['dep24', 'dep3', 'dep', 'arr1', 'arr4'];
const PLAN_ORDER: CheckKindLabelKey[] = ['dep24', 'dep3', 'dep', 'arr1', 'arrExtra', 'arr4'];

export function monitoringPlanKeys(checks: readonly Pick<ScheduledCheckLike, 'kind' | 'status'>[] | null | undefined): CheckKindLabelKey[] {
    const found = new Set<CheckKindLabelKey>();
    for (const check of checks ?? []) {
        if (check.status === 'CANCELLED') continue;
        const key = checkKindLabelKey(check.kind);
        if (key && key !== 'verify' && key !== 'arrExtra') found.add(key);
    }
    if (found.size === 0) return STANDARD_PLAN_KEYS;
    return PLAN_ORDER.filter((key) => found.has(key));
}

// ── Flight status vs Guardian status ────────────────────────────────────────

export interface SnapshotLike {
    status?: string | null;
    delayMinutes?: number | null;
    dataQuality?: string | null;
}

export interface TripStateLike {
    status?: string | null;
    lastCheckedAt?: Date | string | null;
    snapshot?: SnapshotLike | null;
}

/** A real provider observation exists: the worker sets dataQuality away from its initial UNKNOWN only after one. */
export function hasVerifiedObservation(trip: TripStateLike): boolean {
    const quality = (trip.snapshot?.dataQuality ?? 'UNKNOWN').toUpperCase();
    return Boolean(trip.lastCheckedAt) && (quality === 'HIGH' || quality === 'LOW');
}

export type FlightState = 'NOT_VERIFIED' | 'UNABLE_TO_VERIFY' | 'ON_TIME' | 'DELAYED' | 'CANCELLED';

export function flightState(trip: TripStateLike): FlightState {
    if (!hasVerifiedObservation(trip)) return 'NOT_VERIFIED';
    const status = (trip.snapshot?.status ?? '').toUpperCase();
    if (status.includes('CANCEL')) return 'CANCELLED';
    if ((trip.snapshot?.delayMinutes ?? 0) > 0 || status === 'DELAYED') return 'DELAYED';
    if (status === 'ON_TIME' && (trip.snapshot?.dataQuality ?? '').toUpperCase() === 'HIGH') return 'ON_TIME';
    return 'UNABLE_TO_VERIFY';
}

export type CheckSummary =
    | { kind: 'NEVER' }                       // "Not checked yet"
    | { kind: 'ATTEMPTED'; at: Date }         // a check ran but produced no verified result
    | { kind: 'VERIFIED'; at: Date };

export function lastCheckSummary(trip: TripStateLike): CheckSummary {
    if (!trip.lastCheckedAt) return { kind: 'NEVER' };
    const at = new Date(trip.lastCheckedAt);
    if (Number.isNaN(at.getTime())) return { kind: 'NEVER' };
    return hasVerifiedObservation(trip) ? { kind: 'VERIFIED', at } : { kind: 'ATTEMPTED', at };
}

export type GuardianStatus = 'MONITORING_ACTIVE' | 'WAITING_FIRST_CHECK' | 'VERIFYING' | 'CONFIRMATION' | 'NOT_MONITORING';

export function guardianStatus(trip: TripStateLike): GuardianStatus {
    switch (trip.status) {
        case 'ACTIVE': return hasVerifiedObservation(trip) ? 'MONITORING_ACTIVE' : 'WAITING_FIRST_CHECK';
        case 'PENDING_VERIFICATION': return 'VERIFYING';
        case 'PENDING_CONFIRMATION': return 'CONFIRMATION';
        default: return 'NOT_MONITORING';
    }
}

export type ScheduleState = 'WAITING' | 'CHANGED' | 'NO_CHANGE';

/** "No changes" only after at least one verified observation was compared with the baseline. */
export function scheduleState(trip: TripStateLike, hasScheduleChangeEvent: boolean): ScheduleState {
    if (hasScheduleChangeEvent) return 'CHANGED';
    return hasVerifiedObservation(trip) ? 'NO_CHANGE' : 'WAITING';
}

// ── Event priority (presentation only) ──────────────────────────────────────

export type EventPriority = 'CRITICAL' | 'IMPORTANT' | 'INFO';

const SYSTEM_EVENT_TYPES = new Set(['PROVIDER_UNAVAILABLE', 'CHECK_DELAYED', 'MONITORING_RECOVERED', 'MONITORING_STALE', 'STATUS_UNAVAILABLE']);
const FLIGHT_CHANGE_TYPES = new Set(['DELAY_DETECTED', 'CANCELLATION_DETECTED', 'GATE_CHANGE', 'TERMINAL_CHANGE', 'CONNECTION_RISK', 'EQUIPMENT_CHANGE']);
const SCHEDULE_CHANGE_TYPES = new Set(['GATE_CHANGE', 'TERMINAL_CHANGE']);

export const isSystemEventType = (eventType: string | null | undefined): boolean => SYSTEM_EVENT_TYPES.has(eventType ?? '');
export const isFlightChangeEventType = (eventType: string | null | undefined): boolean => FLIGHT_CHANGE_TYPES.has(eventType ?? '');
export const isScheduleChangeEventType = (eventType: string | null | undefined): boolean => SCHEDULE_CHANGE_TYPES.has(eventType ?? '');

export function eventPriority(eventType: string | null | undefined, severity: string | null | undefined): EventPriority {
    const level = (severity ?? '').toUpperCase();
    if (eventType === 'CANCELLATION_DETECTED') return 'CRITICAL';
    if (eventType === 'DELAY_DETECTED') return level === 'HIGH' || level === 'CRITICAL' ? 'CRITICAL' : 'IMPORTANT';
    if (isFlightChangeEventType(eventType)) return 'IMPORTANT';
    return 'INFO';
}

export type HistoryGroup = 'FLIGHT_CHANGE' | 'SYSTEM' | 'NOTIFICATION';
export const historyGroup = (eventType: string | null | undefined): HistoryGroup =>
    isSystemEventType(eventType) ? 'SYSTEM' : 'FLIGHT_CHANGE';

// ── Monitoring delayed / recovered ──────────────────────────────────────────

export interface SystemEventLike {
    eventType: string;
    detectedAt: Date | string;
}

/**
 * Is a monitoring delay currently unresolved? Only the latest system event counts:
 * a later MONITORING_RECOVERED means healthy, whatever came before it. A delay never
 * needs action from the user; FlightAgent retries on its own.
 */
export function monitoringDelayState(events: readonly SystemEventLike[]): 'DELAYED' | 'HEALTHY' {
    let latest: SystemEventLike | null = null;
    for (const event of events) {
        if (!isSystemEventType(event.eventType)) continue;
        if (!latest || new Date(event.detectedAt).getTime() > new Date(latest.detectedAt).getTime()) latest = event;
    }
    return latest && latest.eventType !== 'MONITORING_RECOVERED' ? 'DELAYED' : 'HEALTHY';
}

// ── Legacy GuardianAlert rows on the current-trip card ───────────────────────

export type LegacyAlertKind = 'FLIGHT' | 'SYSTEM' | 'LEGACY';
const LEGACY_ALERT_TYPES = ['PRICE', 'SEAT', 'UPGRADE', 'AWARD', 'BACKUP', 'AMENITY', 'ROUTE'];

export function legacyAlertKind(type: string | null | undefined): LegacyAlertKind {
    const value = (type ?? '').toUpperCase();
    if (isSystemEventType(value)) return 'SYSTEM';
    if (LEGACY_ALERT_TYPES.some((prefix) => value.startsWith(prefix))) return 'LEGACY';
    return 'FLIGHT';
}

/** "Action required" only when the alert is a flight problem that carries an action or is critical. */
export function legacyAlertNeedsAction(alert: { type?: string | null; severity?: string | null; actionLabel?: string | null }): boolean {
    if (legacyAlertKind(alert.type) !== 'FLIGHT') return false;
    return Boolean(alert.actionLabel) || (alert.severity ?? '').toUpperCase() === 'CRITICAL';
}

// ── Dashboard KPI row ───────────────────────────────────────────────────────

export const CHANGES_WINDOW_MS = 7 * ONE_DAY_MS;

export interface KpiEventLike {
    eventType: string;
    state?: string | null;
    detectedAt: Date | string;
    sentAt?: Date | string | null;
    deliveredAt?: Date | string | null;
}

export interface KpiTripLike extends TripStateLike {
    alertEvents?: readonly KpiEventLike[] | null;
}

const isSuppressed = (event: KpiEventLike) => (event.state ?? '').toUpperCase() === 'SUPPRESSED';

/**
 * TRIPS WITH CHANGES: current (ACTIVE) trips whose verified snapshot is delayed/cancelled,
 * or that have a non-suppressed flight-change event (delay, cancellation, gate, terminal,
 * connection, equipment) detected in the last 7 days. System events, legacy price alerts
 * and suppressed events never count.
 */
export function tripHasChanges(trip: KpiTripLike, now: Date = new Date()): boolean {
    if (trip.status !== 'ACTIVE') return false;
    const state = flightState(trip);
    if (state === 'DELAYED' || state === 'CANCELLED') return true;
    return (trip.alertEvents ?? []).some((event) =>
        isFlightChangeEventType(event.eventType)
        && !isSuppressed(event)
        && now.getTime() - new Date(event.detectedAt).getTime() <= CHANGES_WINDOW_MS);
}

/**
 * ALERTS SENT: flight-change notifications actually sent (sentAt or deliveredAt set,
 * not suppressed) for the given current trips. Route/price events and system events
 * are not counted because they are filtered by event type and by the trips passed in.
 */
export function alertsSentCount(trips: readonly KpiTripLike[]): number {
    let count = 0;
    for (const trip of trips) {
        for (const event of trip.alertEvents ?? []) {
            if (isFlightChangeEventType(event.eventType) && !isSuppressed(event) && (event.sentAt || event.deliveredAt)) count++;
        }
    }
    return count;
}

// ── Passenger rights ────────────────────────────────────────────────────────

/** No EU/UK261 regime → neutral rights copy instead of "Not covered / Not eligible". */
export const usesNeutralRightsCopy = (regime: string | null | undefined): boolean => !regime || regime === 'NONE';

// ── Latest meaningful change ("What changed" / "What should I do?") ─────────


export const GATE_CHANGE_RELEVANT_MS = 3 * ONE_DAY_MS;

export interface ChangeTripLike extends TripStateLike {
    alertEvents?: readonly StoredAlertEvent[] | null;
}

/**
 * The latest change worth telling the user about, or null ("No material changes detected").
 *  - delay: only while the verified snapshot still shows a delay (current minutes win over the event's)
 *  - cancellation: when the snapshot or an event says cancelled
 *  - gate / terminal: recent events only
 * Suppressed events and anything classified INFO are not material.
 */
export function latestMeaningfulChange(trip: ChangeTripLike, now: Date = new Date()): { facts: ChangeFacts; detectedAt: Date } | null {
    const state = flightState(trip);
    const events = [...(trip.alertEvents ?? [])]
        .filter((event) => (event.state ?? '').toUpperCase() !== 'SUPPRESSED')
        .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());

    for (const event of events) {
        let facts = factsFromAlertEvent(event);
        if (!facts) continue;
        const detectedAt = new Date(event.detectedAt);
        if (facts.kind === 'DELAY') {
            if (state !== 'DELAYED') continue;
            facts = { ...facts, minutes: Math.max(trip.snapshot?.delayMinutes ?? 0, 0) || facts.minutes };
        } else if (facts.kind === 'CANCELLATION') {
            if (state === 'ON_TIME' || state === 'DELAYED') continue;
        } else if (now.getTime() - detectedAt.getTime() > GATE_CHANGE_RELEVANT_MS) {
            continue;
        }
        if (classifyChange(facts) === 'INFO' && facts.kind !== 'GATE_CHANGE' && facts.kind !== 'TERMINAL_CHANGE') continue;
        return { facts, detectedAt };
    }
    return null;
}

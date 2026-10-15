// lib/guardian/notificationPolicy.ts
//
// The single decision "does this Guardian event deserve a user notification, and
// what does it say?". An event is never emailed merely because it exists:
//
//   NOTIFY (when IMPORTANT/CRITICAL):  meaningful delay, cancellation, gate or
//                                      terminal change near departure, material
//                                      schedule change.
//   SILENT (history/admin only):       data issues, provider retries, recoveries,
//                                      equipment changes, small delays, far-off gate
//                                      changes, no-change observations and any event
//                                      without a specific mapping.
//
// Pure and deterministic (no I/O). The notifier executes the decision.

import {
    actionGuidance,
    airlineActions,
    classifyChange,
    compensationNote,
    describeChange,
    emailSubject,
    flightLabel,
    isNotifiable,
    routeLabel,
    type AirlineActions,
    type ChangeFacts,
    type CompensationLike,
    type FlightIdentity,
} from '@/lib/guardian/disruptionContent';

export interface PolicyEvent {
    type: string;
    subType?: string;
    previous?: unknown;
    current?: unknown;
}

export type NotificationSeverity = 'IMPORTANT' | 'CRITICAL';

export type NotificationDecision =
    | {
        notify: true;
        severity: NotificationSeverity;
        facts: ChangeFacts;
        flight: FlightIdentity;
        airline: AirlineActions;
        subject: string;
        headline: string;
        whatChanged: string;
        before: string | null;
        now: string | null;
        delta: string | null;
        actionRequired: boolean;
        steps: string[];
        compensation: string | null;
        smsText: string;
        pushText: string;
    }
    | { notify: false; severity: 'INFO'; reason: string };

export const NO_MAPPING_REASON = 'No user-meaningful notification mapping';

const rec = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
const str = (value: unknown): string | null => {
    const text = typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
    return text ? text : null;
};
const num = (value: unknown): number | null => {
    const n = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : NaN;
    return Number.isFinite(n) ? n : null;
};

export function flightIdentityFromEvent(event: PolicyEvent): FlightIdentity {
    const current = rec(event.current);
    const airlineCode = str(current.airlineCode)?.toUpperCase() ?? null;
    const number = str(current.flightNumber)?.toUpperCase() ?? null;
    return {
        flightNumber: airlineCode && number ? `${airlineCode}${number}` : null,
        airlineCode,
        origin: str(current.origin)?.toUpperCase() ?? null,
        destination: str(current.destination)?.toUpperCase() ?? null,
    };
}

/** "45min" / "0min" / 45 → 45 */
const previousMinutes = (value: unknown): number => {
    const n = typeof value === 'string' ? Number.parseInt(value, 10) : num(value);
    return n !== null && Number.isFinite(n) && n > 0 ? n : 0;
};

/** Event → classified change facts, or null when the event has no user-meaningful mapping. */
export function factsFromEvent(event: PolicyEvent): ChangeFacts | null {
    const current = rec(event.current);
    switch (event.type) {
        case 'DELAY': {
            const minutes = num(current.delayMinutes);
            if (minutes === null || minutes <= 0) return null;
            return { kind: 'DELAY', minutes, previousMinutes: previousMinutes(event.previous) };
        }
        case 'CANCELLED':
            return { kind: 'CANCELLATION' };
        case 'GATE_CHANGE': {
            const previous = rec(event.previous);
            const sub = (event.subType ?? '').toLowerCase();
            const hours = num(current.hoursToDeparture);
            if (sub.includes('terminal')) {
                return { kind: 'TERMINAL_CHANGE', from: str(previous.terminal), to: str(current.terminal), hoursToDeparture: hours };
            }
            const arrivalOnly = sub.includes('arrival') && !sub.includes('both');
            return arrivalOnly
                ? { kind: 'GATE_CHANGE', which: 'arrival', from: str(previous.arrivalGate), to: str(current.arrivalGate), hoursToDeparture: hours }
                : { kind: 'GATE_CHANGE', which: 'departure', from: str(previous.departureGate), to: str(current.departureGate), hoursToDeparture: hours };
        }
        default:
            // DATA_ISSUE, EQUIPMENT_CHANGE, anything unmapped
            return null;
    }
}

export function decideNotification(event: PolicyEvent, compensation?: CompensationLike | null): NotificationDecision {
    const facts = factsFromEvent(event);
    if (!facts) return { notify: false, severity: 'INFO', reason: NO_MAPPING_REASON };

    const severity = classifyChange(facts);
    if (severity === 'INFO') return { notify: false, severity: 'INFO', reason: `Below notification threshold (${facts.kind})` };
    if (!isNotifiable(facts)) return { notify: false, severity: 'INFO', reason: 'No material change since the last notification' };

    const flight = flightIdentityFromEvent(event);
    const airline = airlineActions(flight.airlineCode);
    const described = describeChange(facts, flight);
    const guidance = actionGuidance(facts, airline.airlineName);
    const subject = emailSubject(facts, flight);
    return {
        notify: true,
        severity,
        facts,
        flight: { ...flight, airlineName: airline.airlineName },
        airline,
        subject,
        headline: described.headline,
        whatChanged: described.whatChanged,
        before: described.before,
        now: described.now,
        delta: described.delta,
        actionRequired: guidance.required,
        steps: guidance.steps,
        compensation: compensationNote(facts, compensation),
        smsText: `${subject}. ${guidance.steps[0] ?? ''}`.trim(),
        pushText: `${subject}. ${guidance.steps[0] ?? ''}`.trim(),
    };
}

// ── Rendering ───────────────────────────────────────────────────────────────

export const escapeHtml = (value: string): string =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

type Notify = Extract<NotificationDecision, { notify: true }>;

export function renderEmailText(decision: Notify, tripUrl: string): string {
    const route = routeLabel(decision.flight);
    const lines: string[] = [[flightLabel(decision.flight), route].filter(Boolean).join(' · '), '', decision.headline, ''];
    if (decision.before) lines.push(`Before: ${decision.before}`);
    if (decision.now) lines.push(`Now: ${decision.now}`);
    if (decision.delta) lines.push(`Change: ${decision.delta}`);
    lines.push('', 'What changed', decision.whatChanged, '', 'What to do');
    for (const step of decision.steps) lines.push(`- ${step}`);
    if (decision.compensation) lines.push('', 'Possible compensation', decision.compensation);
    lines.push('', `View trip details: ${tripUrl}`);
    if (decision.airline.supportUrl && decision.airline.supportLabel) lines.push(`${decision.airline.supportLabel}: ${decision.airline.supportUrl}`);
    lines.push('', 'FlightAgent continues to monitor this flight. Flight data comes from data providers and can differ from the airline\'s own announcements.');
    return lines.join('\n');
}

export function renderEmailHtml(decision: Notify, tripUrl: string): string {
    const e = escapeHtml;
    const route = routeLabel(decision.flight);
    const row = (label: string, value: string | null) => value
        ? `<tr><td style="padding:2px 16px 2px 0;color:#64748b;">${e(label)}</td><td style="padding:2px 0;font-weight:bold;color:#0f172a;">${e(value)}</td></tr>` : '';
    const accent = decision.severity === 'CRITICAL' ? '#b91c1c' : '#b45309';
    const steps = decision.steps.map((step) => `<li style="margin:4px 0;">${e(step)}</li>`).join('');
    const airlineLink = decision.airline.supportUrl && decision.airline.supportLabel
        ? `<a href="${e(decision.airline.supportUrl)}" style="display:inline-block;margin-left:8px;color:#0f172a;border:1px solid #cbd5e1;padding:10px 18px;border-radius:4px;text-decoration:none;">${e(decision.airline.supportLabel)}</a>` : '';
    return `<div style="font-family:Arial,sans-serif;max-width:560px;padding:20px;border:1px solid #e2e8f0;border-radius:8px;color:#334155;">
<p style="margin:0;font-size:14px;color:#64748b;">${e([flightLabel(decision.flight), route].filter(Boolean).join(' · '))}</p>
<h2 style="margin:8px 0 12px;color:${accent};">${e(decision.headline)}</h2>
<table style="font-size:15px;border-collapse:collapse;margin-bottom:12px;">${row('Before', decision.before)}${row('Now', decision.now)}${row('Change', decision.delta)}</table>
<p style="font-size:15px;margin:0 0 12px;">${e(decision.whatChanged)}</p>
<h3 style="margin:16px 0 4px;font-size:15px;color:#0f172a;">What to do</h3>
<ul style="margin:0 0 12px;padding-left:20px;font-size:15px;">${steps}</ul>
${decision.compensation ? `<h3 style="margin:16px 0 4px;font-size:15px;color:#0f172a;">Possible compensation</h3><p style="font-size:14px;margin:0 0 12px;">${e(decision.compensation)}</p>` : ''}
<p style="margin:16px 0;"><a href="${e(tripUrl)}" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 18px;border-radius:4px;text-decoration:none;">View trip details</a>${airlineLink}</p>
<p style="font-size:12px;color:#94a3b8;margin:0;">FlightAgent continues to monitor this flight. Flight data comes from data providers and can differ from the airline's own announcements.</p>
</div>`;
}

// ── From a stored AlertEvent back to change facts (trip page / dashboard card) ──

export interface StoredAlertEvent {
    eventType: string;
    state?: string | null;
    detectedAt: Date | string;
    payload?: unknown;
}

/** AlertEvent row (lifecycle type + stored payload) → the same ChangeFacts the notifier used. */
export function factsFromAlertEvent(event: StoredAlertEvent): ChangeFacts | null {
    const payload = rec(event.payload);
    const eventKey = typeof payload.eventId === 'string' ? payload.eventId : '';
    const subType = eventKey.split(':')[2] ?? '';
    const base = { previous: payload.previous, current: payload.current, subType };
    switch (event.eventType) {
        case 'DELAY_DETECTED': return factsFromEvent({ type: 'DELAY', ...base });
        case 'CANCELLATION_DETECTED': return factsFromEvent({ type: 'CANCELLED', ...base });
        case 'GATE_CHANGE': return factsFromEvent({ type: 'GATE_CHANGE', ...base });
        case 'TERMINAL_CHANGE': return factsFromEvent({ type: 'GATE_CHANGE', ...base, subType: 'terminal' });
        default: return null;
    }
}

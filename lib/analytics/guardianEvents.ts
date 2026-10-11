// lib/analytics/guardianEvents.ts
//
// Server-side GA4 events for the Guardian funnel (the existing analytics
// platform - GA4 - through its Measurement Protocol, because most of these
// moments happen on the server: opt-in, QStash checks, alert sends).
//
// Privacy rules enforced here, not left to callers:
//  - only whitelisted event names and snake_case parameter names;
//  - parameter values are short strings / numbers / booleans, and a string
//    that contains "@" is dropped;
//  - parameter names that suggest personal data (email, name, passenger,
//    passport, booking reference, phone, ...) are dropped;
//  - client_id is a fresh random id per event - no user, trip or session is
//    ever identified.
//
// Nothing is sent unless VERCEL_ENV=production AND GA4_API_SECRET is set.
// A failure never reaches the caller: analytics must not break Guardian.

import { randomUUID } from 'node:crypto';
import { GA_MEASUREMENT_ID } from '@/lib/analytics/ga';

export const GUARDIAN_EVENTS = [
    'guardian_form_submitted',
    'guardian_confirmation_sent',
    'guardian_confirmed',
    'guardian_monitoring_started',
    'guardian_check_completed',
    'guardian_disruption_detected',
    'guardian_alert_sent',
    'guardian_compensation_evaluated',
    'guardian_claim_letter_generated',
] as const;
export type GuardianEventName = (typeof GUARDIAN_EVENTS)[number];

export type GuardianEventParams = Record<string, string | number | boolean | null | undefined>;

const PARAM_NAME = /^[a-z][a-z0-9_]{0,39}$/;
// A parameter is personal when any '_'-separated word of its name is one of
// these, or its name contains a clearly personal fragment.
const PII_WORDS = new Set(['email', 'mail', 'name', 'names', 'phone', 'ip', 'token', 'secret', 'password', 'address', 'ticket', 'pnr', 'signature', 'dob']);
const PII_FRAGMENTS = ['email', 'passenger', 'passport', 'booking', 'reference', 'surname'];
const isPiiName = (key: string) => key.split('_').some((w) => PII_WORDS.has(w)) || PII_FRAGMENTS.some((f) => key.includes(f));
const MAX_STRING = 60;

export function sanitizeGuardianParams(params: GuardianEventParams = {}): Record<string, string | number | boolean> {
    const out: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(params)) {
        if (!PARAM_NAME.test(key) || isPiiName(key)) continue;
        if (typeof value === 'number') {
            if (Number.isFinite(value)) out[key] = value;
        } else if (typeof value === 'boolean') {
            out[key] = value;
        } else if (typeof value === 'string') {
            if (value.includes('@')) continue;
            out[key] = value.slice(0, MAX_STRING);
        }
    }
    return out;
}

export function buildGuardianEventBody(name: GuardianEventName, params?: GuardianEventParams, clientId = randomUUID()) {
    if (!(GUARDIAN_EVENTS as readonly string[]).includes(name)) {
        throw new Error(`Unknown Guardian analytics event: ${name}`);
    }
    return { client_id: clientId, events: [{ name, params: sanitizeGuardianParams(params) }] };
}

export function isGuardianAnalyticsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
    return env.VERCEL_ENV === 'production' && Boolean(env.GA4_API_SECRET?.trim());
}

// Fire-and-forget. Resolves (never rejects) once the attempt is over.
export async function trackGuardianEvent(name: GuardianEventName, params?: GuardianEventParams): Promise<void> {
    try {
        if (!isGuardianAnalyticsEnabled()) return;
        const body = buildGuardianEventBody(name, params);
        const url = `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${encodeURIComponent(process.env.GA4_API_SECRET!.trim())}`;
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(3000),
        });
    } catch (error) {
        console.warn(`[Analytics] ${name} not sent:`, (error as Error)?.message ?? error);
    }
}

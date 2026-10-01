// lib/guardian/trackRateLimit.ts
//
// Abuse limits for the anonymous "track my flight" form. State lives in the
// MonitoredTrip rows themselves (subscriberEmail / requestIpHash + createdAt),
// so it works across serverless instances without Redis.
//
// The client IP is never stored in clear: only an HMAC keyed with the auth
// secret, enough to count requests from the same address.

import { createHmac } from 'node:crypto';

export const TRACK_RATE_WINDOW_MS = 60 * 60 * 1000;
export const TRACK_LIMIT_PER_EMAIL = 3;
export const TRACK_LIMIT_PER_IP = 10;

export type TrackRateDecision =
    | { allowed: true }
    | { allowed: false; reason: 'EMAIL_LIMIT' | 'IP_LIMIT' };

export function evaluateTrackRateLimit(counts: { emailRecent: number; ipRecent: number | null }): TrackRateDecision {
    if (counts.emailRecent >= TRACK_LIMIT_PER_EMAIL) return { allowed: false, reason: 'EMAIL_LIMIT' };
    if (counts.ipRecent !== null && counts.ipRecent >= TRACK_LIMIT_PER_IP) return { allowed: false, reason: 'IP_LIMIT' };
    return { allowed: true };
}

/** First hop of x-forwarded-for (set by Vercel), else x-real-ip. */
export function clientIpFromHeaders(headers: Headers): string | null {
    const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    if (forwarded) return forwarded;
    const real = headers.get('x-real-ip')?.trim();
    return real || null;
}

export function hashRequestIp(ip: string | null, secret: string | undefined): string | null {
    if (!ip || !secret) return null;
    return createHmac('sha256', secret).update(`track-ip:${ip}`).digest('hex');
}

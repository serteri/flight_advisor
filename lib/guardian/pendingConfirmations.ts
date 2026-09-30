// lib/guardian/pendingConfirmations.ts
//
// Pure selection logic for scripts/send-pending-confirmations.ts: which
// waitlist sign-ups (PENDING_CONFIRMATION trips saved while email delivery was
// off) get their one-time confirmation email once EMAIL_DELIVERY_READY=true.
//
// One email per address: opening the link confirms every pending trip of that
// user (lib/guardian/tripConfirmation.ts), so the first trip's flight is used
// for the subject and the link opens that trip.
//
// One-time without a schema change: an address that already has ANY LoginToken
// is skipped. Waitlist mode never creates tokens, the script creates the token
// before sending, and expired tokens are not cleaned up — so a second run finds
// the token and does not email that address again.

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PendingTripRow {
    id: string;
    subscriberEmail: string | null;
    consentGiven: boolean;
    createdAt: Date;
    segment: { airlineCode: string; flightNumber: string; departureDate: Date } | null;
}

export interface ConfirmationGroup {
    email: string;
    tripIds: string[];
    firstTripId: string;
    flightNumber: string;
}

export type SkipReason = 'NO_EMAIL' | 'NO_CONSENT' | 'FLIGHT_PASSED' | 'ALREADY_HAS_TOKEN';

export interface ConfirmationPlan {
    send: ConfirmationGroup[];
    skipped: Array<{ tripId: string; email: string | null; reason: SkipReason }>;
}

export function planPendingConfirmations(
    trips: PendingTripRow[],
    emailsWithAnyToken: Set<string>,
    now: Date,
): ConfirmationPlan {
    const skipped: ConfirmationPlan['skipped'] = [];
    const groups = new Map<string, ConfirmationGroup>();

    const ordered = [...trips].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    for (const trip of ordered) {
        const email = trip.subscriberEmail?.trim().toLowerCase() || null;
        if (!email) { skipped.push({ tripId: trip.id, email, reason: 'NO_EMAIL' }); continue; }
        if (!trip.consentGiven) { skipped.push({ tripId: trip.id, email, reason: 'NO_CONSENT' }); continue; }
        // Same one-day slack as the form: a flight that is over needs no alerts.
        if (!trip.segment || trip.segment.departureDate.getTime() < now.getTime() - DAY_MS) {
            skipped.push({ tripId: trip.id, email, reason: 'FLIGHT_PASSED' });
            continue;
        }
        if (emailsWithAnyToken.has(email)) { skipped.push({ tripId: trip.id, email, reason: 'ALREADY_HAS_TOKEN' }); continue; }

        const group = groups.get(email);
        if (group) {
            group.tripIds.push(trip.id);
        } else {
            groups.set(email, {
                email,
                tripIds: [trip.id],
                firstTripId: trip.id,
                flightNumber: `${trip.segment.airlineCode}${trip.segment.flightNumber}`,
            });
        }
    }
    return { send: [...groups.values()], skipped };
}

/** a***@domain — script output never prints full addresses. */
export function maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    return domain ? `${local.slice(0, 1)}***@${domain}` : '***';
}

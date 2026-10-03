// lib/guardian/flightNotFound.ts
//
// Flight validation. Whenever the flight-data provider says the flight does
// not exist (lookup code NOT_FOUND) — at opt-in confirmation (registration
// lookup) or at any checkpoint — the trip leaves monitoring:
//
//   ACTIVE → FLIGHT_NOT_FOUND, remaining checkpoints cancelled, queued alert
//   emails suppressed, and exactly ONE "we couldn't find your flight" email.
//
// Exactly-once comes from the conditional status update: only the call that
// actually moves the trip out of ACTIVE sends the email, so two concurrent
// checks (or a retried QStash delivery) can't send two. Other lookup failures
// (quota, HTTP errors, timeouts) are NOT treated as "not found".

import type { FlightLookupResult } from '@/lib/flightData/client';

export function isFlightNotFound(result: FlightLookupResult | null | undefined): boolean {
    return Boolean(result && !result.ok && result.code === 'NOT_FOUND');
}

export interface FlightNotFoundDeps {
    /** ACTIVE → FLIGHT_NOT_FOUND; true only if this call changed the status. */
    transitionToNotFound(tripId: string): Promise<boolean>;
    cancelRemainingChecks(tripId: string, excludeCheckId?: string): Promise<number>;
    suppressQueuedAlerts(tripId: string): Promise<number>;
    loadRecipient(tripId: string): Promise<{ email: string; flightNumber: string; flightDate: Date } | null>;
    sendNotFoundEmail(input: { tripId: string; email: string; flightNumber: string; flightDate: Date }): Promise<{ success: boolean; error?: string }>;
    recordEmailError(tripId: string, error: string): Promise<void>;
}

export interface FlightNotFoundOutcome {
    transitioned: boolean;
    cancelledChecks: number;
    suppressedAlerts: number;
    emailSent: boolean;
}

export async function handleFlightNotFound(
    tripId: string,
    deps: FlightNotFoundDeps,
    options: { excludeCheckId?: string; source: 'REGISTRATION' | 'CHECKPOINT' },
): Promise<FlightNotFoundOutcome> {
    const transitioned = await deps.transitionToNotFound(tripId);
    if (!transitioned) {
        // Already handled (or the trip isn't ACTIVE): no side effects, no second email.
        return { transitioned: false, cancelledChecks: 0, suppressedAlerts: 0, emailSent: false };
    }

    const cancelledChecks = await deps.cancelRemainingChecks(tripId, options.excludeCheckId);
    const suppressedAlerts = await deps.suppressQueuedAlerts(tripId);
    console.warn(`[Guardian] Trip ${tripId}: flight not found by provider (${options.source}) → FLIGHT_NOT_FOUND; ${cancelledChecks} checks cancelled, ${suppressedAlerts} queued alerts suppressed`);

    let emailSent = false;
    const recipient = await deps.loadRecipient(tripId);
    if (recipient) {
        // The trip has already left monitoring; a send failure (or exception) is
        // recorded on the trip and must not fail the checkpoint or be retried.
        let result: { success: boolean; error?: string };
        try {
            result = await deps.sendNotFoundEmail({ tripId, ...recipient });
        } catch (error: any) {
            result = { success: false, error: error?.message || String(error) };
        }
        emailSent = result.success;
        if (!result.success) {
            console.error(`[Guardian] Trip ${tripId}: flight-not-found email failed: ${result.error}`);
            await deps.recordEmailError(tripId, result.error || 'Unknown email delivery failure');
        }
    } else {
        console.warn(`[Guardian] Trip ${tripId}: no recipient for the flight-not-found email`);
    }
    return { transitioned, cancelledChecks, suppressedAlerts, emailSent };
}

/** Prisma-backed dependencies (imported lazily so the pure logic stays testable). */
export async function defaultFlightNotFoundDeps(): Promise<FlightNotFoundDeps> {
    const { prisma } = await import('@/lib/prisma');
    const { cancelPendingChecks } = await import('@/lib/guardian/scheduler');
    const { sendFlightNotFoundEmail } = await import('@/lib/email/sender');
    return {
        async transitionToNotFound(tripId) {
            const res = await prisma.monitoredTrip.updateMany({
                where: { id: tripId, status: 'ACTIVE' },
                data: { status: 'FLIGHT_NOT_FOUND', lastCheckedAt: new Date() },
            });
            return res.count === 1;
        },
        cancelRemainingChecks: (tripId, excludeCheckId) => cancelPendingChecks(tripId, { excludeCheckId }),
        async suppressQueuedAlerts(tripId) {
            const res = await prisma.alertNotificationDelivery.updateMany({
                where: { status: { in: ['QUEUED', 'RETRYING'] }, alertEvent: { tripId } },
                data: { status: 'SUPPRESSED' },
            });
            return res.count;
        },
        async loadRecipient(tripId) {
            const trip = await prisma.monitoredTrip.findUnique({
                where: { id: tripId },
                select: {
                    subscriberEmail: true,
                    user: { select: { email: true } },
                    segments: { orderBy: { segmentOrder: 'asc' }, take: 1, select: { airlineCode: true, flightNumber: true, departureDate: true } },
                },
            });
            const segment = trip?.segments[0];
            const email = trip?.subscriberEmail || trip?.user?.email;
            if (!trip || !segment || !email) return null;
            return { email, flightNumber: `${segment.airlineCode}${segment.flightNumber}`, flightDate: segment.departureDate };
        },
        sendNotFoundEmail: ({ tripId, email, flightNumber, flightDate }) =>
            sendFlightNotFoundEmail(email, flightNumber, flightDate, tripId),
        async recordEmailError(tripId, error) {
            await prisma.monitoredTrip.update({ where: { id: tripId }, data: { lastEmailError: error, lastEmailErrorAt: new Date() } });
        },
    };
}

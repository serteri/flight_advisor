// services/notifications/guardianNotifier.ts
import { randomUUID } from "node:crypto";

import { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { GuardianEvent } from "@/workers/guardianWorker";

// Helper sleep mapping
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const DELIVERY_LEASE_MS = 5 * 60 * 1000;

type DeliveryChannel = 'EMAIL' | 'SMS';

type DeliveryClaim =
    | { kind: 'claimed'; deliveryId: string; claimId: string }
    | { kind: 'skip'; reason: 'already-finalized' | 'claimed-by-other-worker' | 'stale-processing' };

// ── CHANNEL ABSTRACTIONS (MOCK ADAPTERS) ──

async function sendEmail(email: string, subject: string, content: string): Promise<void> {
    console.log(`[MAILER] 📧 Dispatching to ${email}: "${subject}" -> ${content}`);
    if (Math.random() < 0.2) throw new Error("Mock Email Delivery Timeout");
}

async function sendSMS(phone: string, content: string): Promise<void> {
    console.log(`[SMS]    📱 Dispatching to ${phone}: ${content}`);
    if (Math.random() < 0.2) throw new Error("Mock SMS Carrier Rejected");
}

// ── ATOMIC LOCKING & RETRY STRATEGY ENVELOPE ──

async function claimNotificationDelivery(
    eventId: string,
    tripId: string,
    channel: DeliveryChannel,
    channelKey: string
): Promise<DeliveryClaim> {
    const now = new Date();
    const claimId = randomUUID();
    const processingLeaseExpiresAt = new Date(now.getTime() + DELIVERY_LEASE_MS);

    try {
        const delivery = await prisma.notificationDelivery.create({
            data: {
                eventId,
                tripId,
                channel,
                status: 'processing',
                claimedAt: now,
                processingLeaseId: claimId,
                processingLeaseExpiresAt,
                attemptCount: 1,
                lastError: null
            }
        });

        return { kind: 'claimed', deliveryId: delivery.id, claimId };
    } catch (error) {
        const existingDelivery = await prisma.notificationDelivery.findUnique({
            where: { eventId_channel: { eventId, channel } },
            select: {
                id: true,
                status: true,
                processingLeaseExpiresAt: true
            }
        });

        if (!existingDelivery) {
            throw error;
        }

        if (existingDelivery.status === 'failed') {
            const reclaimed = await prisma.notificationDelivery.updateMany({
                where: {
                    id: existingDelivery.id,
                    status: 'failed'
                },
                data: {
                    tripId,
                    status: 'processing',
                    claimedAt: now,
                    processingLeaseId: claimId,
                    processingLeaseExpiresAt,
                    attemptCount: { increment: 1 },
                    lastError: null
                }
            });

            if (reclaimed.count > 0) {
                return { kind: 'claimed', deliveryId: existingDelivery.id, claimId };
            }

            console.log(`🔒 [NOTIFIER] Claim raced on ${channelKey}. Another worker won the retry lease.`);
            return { kind: 'skip', reason: 'claimed-by-other-worker' };
        }

        if (existingDelivery.status === 'processing') {
            if (existingDelivery.processingLeaseExpiresAt && existingDelivery.processingLeaseExpiresAt <= now) {
                console.warn(`⚠️ [NOTIFIER] Stale processing record detected for ${channelKey}. Skipping automatic retry to avoid duplicate delivery.`);
                return { kind: 'skip', reason: 'stale-processing' };
            }

            console.log(`🔒 [NOTIFIER] Active claim already exists for ${channelKey}.`);
            return { kind: 'skip', reason: 'claimed-by-other-worker' };
        }

        return { kind: 'skip', reason: 'already-finalized' };
    }
}

async function markDeliverySent(deliveryId: string, claimId: string) {
    await prisma.notificationDelivery.updateMany({
        where: {
            id: deliveryId,
            status: 'processing',
            processingLeaseId: claimId
        },
        data: {
            status: 'sent',
            sentAt: new Date(),
            claimedAt: null,
            processingLeaseId: null,
            processingLeaseExpiresAt: null,
            lastError: null
        }
    });
}

async function markDeliveryFailed(deliveryId: string, claimId: string, errorMessage: string) {
    await prisma.notificationDelivery.updateMany({
        where: {
            id: deliveryId,
            status: 'processing',
            processingLeaseId: claimId
        },
        data: {
            status: 'failed',
            claimedAt: null,
            processingLeaseId: null,
            processingLeaseExpiresAt: null,
            lastError: errorMessage
        }
    });
}

async function persistSkippedDelivery(eventId: string, tripId: string, channel: DeliveryChannel) {
    const finalizedAt = new Date();

    try {
        await prisma.notificationDelivery.create({
            data: {
                eventId,
                tripId,
                channel,
                status: 'skipped',
                sentAt: finalizedAt
            }
        });
        return;
    } catch {
        await prisma.notificationDelivery.updateMany({
            where: { eventId, channel, status: 'failed' },
            data: {
                tripId,
                status: 'skipped',
                sentAt: finalizedAt,
                claimedAt: null,
                processingLeaseId: null,
                processingLeaseExpiresAt: null,
                lastError: null
            }
        });
    }
}

async function attemptDispatch(
    dispatchFn: () => Promise<void>,
    channelKey: string,
    eventId: string,
    tripId: string,
    channel: DeliveryChannel,
    maxRetries = 2
): Promise<void> {
    const claim = await claimNotificationDelivery(eventId, tripId, channel, channelKey);

    if (claim.kind === 'skip') {
        return;
    }

    // 2. DISPATCH & SYNC
    for (let currentAttempt = 0; currentAttempt <= maxRetries; currentAttempt++) {
        try {
            await dispatchFn();
            await markDeliverySent(claim.deliveryId, claim.claimId);
            return;
        } catch (err: any) {
            if (currentAttempt === maxRetries) {
                console.error(`🚨 [NOTIFIER] Complete delivery failure for ${channelKey} after ${maxRetries} retries: ${err.message}`);
                await markDeliveryFailed(claim.deliveryId, claim.claimId, err.message);
                return; // Suppress throwing to avoid cascading loop failures. Handled gracefully.
            }
            const backoffMs = currentAttempt === 0 ? 1000 : 3000;
            console.warn(`⏳ [NOTIFIER] ${channelKey} retry ${currentAttempt + 1}/${maxRetries} failing... Backing off for ${backoffMs}ms`);
            await sleep(backoffMs);
        }
    }
}

// ── EVENT CONTENT MAPPING ──

interface FormattedMessage {
    subject: string;
    body: string;
}

const mapEventToMessage = (event: GuardianEvent): FormattedMessage => {
    switch (event.type) {
        case 'DELAY':
            return {
                subject: 'Flight Delay Notice',
                body: `Your flight has been updated. ${event.current}. We recommend keeping a close eye on the terminal boards.`
            };
        case 'CANCELLED':
            return {
                subject: 'URGENT: Flight Cancelled',
                body: `URGENT: Your monitored flight has been CANCELLED. Please contact your airline immediately.`
            };
        case 'DATA_ISSUE':
            return {
                subject: 'Live Tracking Warning',
                body: `Our automated tracking stream is experiencing data latency. Please verify flight details directly with your airline.`
            };
        case 'GATE_CHANGE':
            return {
                subject: 'Gate Change Detected',
                body: `Your departure gate has been updated. Please check the terminal displays upon arrival.`
            };
        default:
            return {
                subject: 'Trip Protection Update',
                body: 'There has been a change detected on your monitored trip.'
            };
    }
};

// ── CORE NOTIFICATION DISPATCHER ──

export async function notifyGuardianEvent(event: GuardianEvent, user: User | null): Promise<void> {
    if (!user) {
        console.warn(`[NOTIFIER] Validation fault: User missing from Trip boundary. Skipping dispatch.`);
        return;
    }

    const eventId = event.eventId || `${event.tripId}:${event.type}`;
    const { subject, body } = mapEventToMessage(event);
    const notifications: Promise<void>[] = [];

    // 1. Queue Email Dispatch safely via Dedup Envelope
    if (user.email) {
        const emailKey = `${eventId}:EMAIL`;
        notifications.push(attemptDispatch(
            () => sendEmail(user.email!, subject, body),
            emailKey,
            eventId,
            event.tripId,
            'EMAIL'
        ));
    }

    // 2. Queue SMS Dispatch securely mapping severities
    const requiresSMS = event.severity === 'high' || event.severity === 'medium';
    if (requiresSMS) {
        const smsKey = `${eventId}:SMS`;

        if (user.phoneNumber) {
            notifications.push(attemptDispatch(
                () => sendSMS(user.phoneNumber!, body),
                smsKey,
                eventId,
                event.tripId,
                'SMS'
            ));
        } else if (event.severity === 'high') {
            console.warn(`[NOTIFIER] Mandatory SMS degraded safely: User lacks a configured phoneNumber!`);
            await persistSkippedDelivery(eventId, event.tripId, 'SMS');
        }
    }

    // 3. Executing Delivery Matrix Non-Blocking
    const results = await Promise.allSettled(notifications);

    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
        console.error(`[NOTIFIER] Notice: Isolated Delivery Matrix degraded resolving ${failures.length} exceptions tracking gracefully.`);
    }
}

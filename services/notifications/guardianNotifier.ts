// services/notifications/guardianNotifier.ts
import { randomUUID } from "node:crypto";

import { Prisma, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ChannelResponse } from "@/services/notifications/types";
import { EmailChannel } from "@/services/notifications/channels/email";
import { SmsChannel } from "@/services/notifications/channels/sms";
import { GuardianEvent } from "@/workers/guardianWorker";

// Helper sleep mapping
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const DELIVERY_LEASE_MS = 5 * 60 * 1000;
const STALE_PROCESSING_MS = 5 * 60 * 1000;
const MAX_STALE_RECLAIM_ATTEMPTS = 2;

type DeliveryChannel = 'EMAIL' | 'SMS';

type DeliveryClaim =
    | { kind: 'claimed'; deliveryId: string; claimId: string; mode: 'new' | 'failed' | 'stale-reclaimed' }
    | { kind: 'skip'; reason: 'already-finalized' | 'claimed-by-other-worker' | 'stale-processing' };

function isStaleProcessing(updatedAt: Date, leaseExpiresAt: Date | null, now: Date) {
    const staleCutoff = now.getTime() - STALE_PROCESSING_MS;
    const leaseExpired = !leaseExpiresAt || leaseExpiresAt.getTime() <= now.getTime();

    return leaseExpired && updatedAt.getTime() <= staleCutoff;
}

async function reclaimStaleProcessingDelivery(
    eventId: string,
    tripId: string,
    channel: DeliveryChannel,
    claimId: string,
    now: Date
) {
    const staleCutoff = new Date(now.getTime() - STALE_PROCESSING_MS);
    const processingLeaseExpiresAt = new Date(now.getTime() + DELIVERY_LEASE_MS);

    const reclaimedRows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        UPDATE "NotificationDelivery"
        SET
            "tripId" = ${tripId},
            "claimedAt" = ${now},
            "processingLeaseId" = ${claimId},
            "processingLeaseExpiresAt" = ${processingLeaseExpiresAt},
            "attemptCount" = "attemptCount" + 1,
            "lastError" = 'Recovered stale processing claim',
            "sentAt" = NULL,
            "updatedAt" = ${now}
        WHERE
            "eventId" = ${eventId}
            AND "channel" = ${channel}
            AND "status" = 'processing'
            AND "updatedAt" < ${staleCutoff}
            AND "attemptCount" < ${MAX_STALE_RECLAIM_ATTEMPTS}
            AND (
                "processingLeaseExpiresAt" IS NULL
                OR "processingLeaseExpiresAt" <= ${now}
            )
        RETURNING "id"
    `);

    return reclaimedRows[0] ?? null;
}

const emailChannel = EmailChannel.getInstance();
const smsChannel = SmsChannel.getInstance();

type Eu261Assessment = {
    eligible: true | false | 'unknown';
    reason: string;
    compensationRange: 'EUR_250' | 'EUR_400' | 'EUR_600' | null;
    confidence: 'low' | 'medium';
};

const getEu261Assessment = (event: GuardianEvent): Eu261Assessment | null => {
    const assessment = (event.current as any)?.eu261Assessment;
    if (!assessment || typeof assessment !== 'object') return null;
    return assessment as Eu261Assessment;
};

const formatEu261Hint = (assessment: Eu261Assessment | null): string => {
    if (!assessment) return '';

    const compText = assessment.compensationRange
        ? ` Potential compensation band: ${assessment.compensationRange.replace('EUR_', 'EUR ')}.`
        : '';

    if (assessment.eligible === true) {
        return ` EU261 check: likely eligible (${assessment.confidence} confidence).${compText}`;
    }

    if (assessment.eligible === false) {
        return ` EU261 check: currently appears out of scope (${assessment.confidence} confidence).`;
    }

    return ` EU261 check: scope is currently unclear (${assessment.confidence} confidence).`;
};

async function sendGuardianEmail(to: string, subject: string, body: string, tripId: string, eu261Assessment: Eu261Assessment | null): Promise<ChannelResponse> {
    const result = await emailChannel.send(to, {
        userId: 'guardian-system',
        tripId,
        type: 'DISRUPTION',
        title: subject,
        message: body,
        priority: 'CRITICAL',
        data: eu261Assessment ? { eu261Assessment } : undefined,
    });

    return {
        success: result.success,
        providerMessageId: result.id,
        channel: 'EMAIL',
        error: result.success ? undefined : 'EMAIL channel unavailable or provider rejected request',
    };
}

async function sendGuardianSMS(to: string, body: string, tripId: string, eu261Assessment: Eu261Assessment | null): Promise<ChannelResponse> {
    const result = await smsChannel.send(to, {
        userId: 'guardian-system',
        tripId,
        type: 'DISRUPTION',
        title: 'Trip Protection Alert',
        message: body,
        priority: 'CRITICAL',
        data: eu261Assessment ? { eu261Assessment } : undefined,
    });

    return {
        success: result.success,
        providerMessageId: result.id,
        channel: 'SMS',
        error: result.success ? undefined : 'SMS channel unavailable or provider rejected request',
    };
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

        return { kind: 'claimed', deliveryId: delivery.id, claimId, mode: 'new' };
    } catch (error) {
        const existingDelivery = await prisma.notificationDelivery.findUnique({
            where: { eventId_channel: { eventId, channel } },
            select: {
                id: true,
                status: true,
                processingLeaseExpiresAt: true,
                updatedAt: true,
                attemptCount: true
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
                return { kind: 'claimed', deliveryId: existingDelivery.id, claimId, mode: 'failed' };
            }

            console.log(`🔒 [NOTIFIER] Claim raced on ${channelKey}. Another worker won the retry lease.`);
            return { kind: 'skip', reason: 'claimed-by-other-worker' };
        }

        if (existingDelivery.status === 'processing') {
            if (isStaleProcessing(existingDelivery.updatedAt, existingDelivery.processingLeaseExpiresAt, now)) {
                if (existingDelivery.attemptCount >= MAX_STALE_RECLAIM_ATTEMPTS) {
                    console.warn(`⚠️ [NOTIFIER] Stale processing row for ${channelKey} already consumed its safe reclaim attempt.`);
                    return { kind: 'skip', reason: 'stale-processing' };
                }

                const reclaimed = await reclaimStaleProcessingDelivery(eventId, tripId, channel, claimId, now);

                if (reclaimed) {
                    console.warn(`♻️ [NOTIFIER] Reclaimed stale processing row for ${channelKey}.`);
                    return { kind: 'claimed', deliveryId: reclaimed.id, claimId, mode: 'stale-reclaimed' };
                }

                console.log(`🔒 [NOTIFIER] Stale reclaim raced on ${channelKey}. Another worker won the claim.`);
                return { kind: 'skip', reason: 'claimed-by-other-worker' };
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
    dispatchFn: () => Promise<ChannelResponse>,
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

    const maxAttempts = claim.mode === 'stale-reclaimed' ? 1 : maxRetries + 1;

    // 2. DISPATCH & SYNC
    for (let currentAttempt = 0; currentAttempt < maxAttempts; currentAttempt++) {
        try {
            const result = await dispatchFn();
            if (!result.success) {
                throw new Error(result.error || `${channel} provider returned unsuccessful response`);
            }
            await markDeliverySent(claim.deliveryId, claim.claimId);
            return;
        } catch (err: any) {
            if (currentAttempt === maxAttempts - 1) {
                console.error(`🚨 [NOTIFIER] Complete delivery failure for ${channelKey} after ${maxAttempts} attempt(s): ${err.message}`);
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
    const eu261Hint = formatEu261Hint(getEu261Assessment(event));

    switch (event.type) {
        case 'DELAY':
            return {
                subject: 'Flight Delay Notice',
                body: `Your flight has been updated. We recommend keeping a close eye on the terminal boards.${eu261Hint}`
            };
        case 'CANCELLED':
            return {
                subject: 'URGENT: Flight Cancelled',
                body: `URGENT: Your monitored flight has been CANCELLED. Please contact your airline immediately.${eu261Hint}`
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
    const eu261Assessment = getEu261Assessment(event);
    const { subject, body } = mapEventToMessage(event);
    const notifications: Promise<void>[] = [];

    // 1. Queue Email Dispatch safely via Dedup Envelope
    if (user.email) {
        const emailKey = `${eventId}:EMAIL`;
        notifications.push(attemptDispatch(
            () => sendGuardianEmail(user.email!, subject, body, event.tripId, eu261Assessment),
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
                () => sendGuardianSMS(user.phoneNumber!, body, event.tripId, eu261Assessment),
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

// services/notifications/guardianNotifier.ts
import { randomUUID } from "node:crypto";

import { Prisma, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ChannelResponse } from "@/services/notifications/types";
import { EmailChannel } from "@/services/notifications/channels/email";
import { SmsChannel } from "@/services/notifications/channels/sms";
import { NotificationProviderManager } from "@/services/notifications/providers";
import type { GuardianEvent } from "@/workers/guardianWorker";
import type { CompensationResult } from "@/lib/compensation/engine";
import {
    AlertDeliveryChannel,
    queueAlertDelivery,
    recordDeliveryAttemptStart,
    recordDeliveryFailure,
    recordDeliverySuccess,
    recordSkippedDelivery,
} from "@/lib/alertLifecycle";
import { appUrl } from "@/lib/config/runtimeEnv";
import { decideNotification, renderEmailHtml, renderEmailText } from "@/lib/guardian/notificationPolicy";

// Helper sleep mapping
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const DELIVERY_LEASE_MS = 5 * 60 * 1000;
const STALE_PROCESSING_MS = 5 * 60 * 1000;
const MAX_STALE_RECLAIM_ATTEMPTS = 2;

type DeliveryChannel = 'EMAIL' | 'SMS' | 'PUSH';

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
const providerManager = NotificationProviderManager.getInstance();
// Result of lib/compensation/engine.ts attached by the worker as event.current.compensation.
type Eu261Assessment = CompensationResult;

const getEu261Assessment = (event: GuardianEvent): Eu261Assessment | null => {
    const assessment = (event.current as any)?.compensation;
    if (!assessment || typeof assessment !== 'object' || typeof assessment.status !== 'string') return null;
    return assessment as Eu261Assessment;
};

async function sendGuardianEmail(
    to: string,
    subject: string,
    text: string,
    html: string,
    tripId: string,
    eu261Assessment: Eu261Assessment | null,
): Promise<ChannelResponse> {
    const result = await emailChannel.send(to, {
        userId: 'guardian-system',
        tripId,
        type: 'DISRUPTION',
        title: subject,
        message: text,
        priority: 'CRITICAL',
        data: { html, ...(eu261Assessment ? { eu261Assessment } : {}) },
    });

    return {
        success: result.success,
        providerMessageId: result.id,
        channel: 'EMAIL',
        error: result.success ? undefined : (result.error || 'EMAIL channel unavailable or provider rejected request'),
    };
}

async function sendGuardianSMS(to: string, body: string, tripId: string, eu261Assessment: Eu261Assessment | null): Promise<ChannelResponse> {
    const result = await smsChannel.send(to, {
        userId: 'guardian-system',
        tripId,
        type: 'DISRUPTION',
        title: 'FlightAgent flight alert',
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

async function sendGuardianPush(userId: string, title: string, body: string, tripId: string, eventId: string): Promise<ChannelResponse> {
    const result = await providerManager.sendPush({
        userId,
        title,
        body,
        data: {
            tripId,
            eventId,
            source: 'guardian',
        },
    });

    return {
        success: result.success,
        providerMessageId: result.providerMessageId,
        channel: 'PUSH',
        error: result.error,
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
    alertEventId?: string,
    maxRetries = 2
): Promise<void> {
    const claim = await claimNotificationDelivery(eventId, tripId, channel, channelKey);
    const lifecycleDelivery = alertEventId
        ? await queueAlertDelivery(alertEventId, channel as AlertDeliveryChannel, maxRetries + 1)
        : null;

    if (claim.kind === 'skip') {
        if (alertEventId) {
            await recordSkippedDelivery(alertEventId, channel as AlertDeliveryChannel, claim.reason);
        }
        return;
    }

    const maxAttempts = claim.mode === 'stale-reclaimed' ? 1 : maxRetries + 1;

    // 2. DISPATCH & SYNC
    for (let currentAttempt = 0; currentAttempt < maxAttempts; currentAttempt++) {
        try {
            if (lifecycleDelivery) {
                await recordDeliveryAttemptStart(lifecycleDelivery.id);
            }
            const result = await dispatchFn();
            if (!result.success) {
                throw new Error(result.error || `${channel} provider returned unsuccessful response`);
            }
            await markDeliverySent(claim.deliveryId, claim.claimId);
            if (lifecycleDelivery) {
                await recordDeliverySuccess(lifecycleDelivery.id, result.providerMessageId);
            }
            return;
        } catch (err: any) {
            if (currentAttempt === maxAttempts - 1) {
                console.error(`🚨 [NOTIFIER] Complete delivery failure for ${channelKey} after ${maxAttempts} attempt(s): ${err.message}`);
                await markDeliveryFailed(claim.deliveryId, claim.claimId, err.message);
                if (lifecycleDelivery) {
                    await recordDeliveryFailure(lifecycleDelivery.id, err.message);
                }
                return; // Suppress throwing to avoid cascading loop failures. Handled gracefully.
            }
            if (lifecycleDelivery) {
                await recordDeliveryFailure(lifecycleDelivery.id, err.message);
            }
            const backoffMs = currentAttempt === 0 ? 1000 : 3000;
            console.warn(`⏳ [NOTIFIER] ${channelKey} retry ${currentAttempt + 1}/${maxRetries} failing... Backing off for ${backoffMs}ms`);
            await sleep(backoffMs);
        }
    }
}

// ── CORE NOTIFICATION DISPATCHER ──
//
// Whether and what to send is decided by lib/guardian/notificationPolicy.ts.
// Events without a user-meaningful mapping are recorded as SKIPPED with a reason
// (history/admin keep them); they are never emailed, texted or pushed.

export async function notifyGuardianEvent(event: GuardianEvent, user: User | null): Promise<void> {
    if (!user) {
        console.warn(`[NOTIFIER] Validation fault: User missing from Trip boundary. Skipping dispatch.`);
        return;
    }

    const eventId = event.eventId || `${event.tripId}:${event.type}`;
    const eu261Assessment = getEu261Assessment(event);
    const decision = decideNotification(event, eu261Assessment);

    if (!decision.notify) {
        console.log(`[NOTIFIER] No user notification for ${event.type} (trip ${event.tripId}): ${decision.reason}`);
        await persistSkippedDelivery(eventId, event.tripId, 'EMAIL');
        if (event.alertEventId) {
            await recordSkippedDelivery(event.alertEventId, 'EMAIL', decision.reason);
        }
        return;
    }

    const notifications: Promise<void>[] = [];
    const tripUrl = appUrl(`/dashboard/guardian/${event.tripId}`);

    // 1. Email (IMPORTANT and CRITICAL) via the dedup envelope
    if (user.email) {
        notifications.push(attemptDispatch(
            () => sendGuardianEmail(user.email!, decision.subject, renderEmailText(decision, tripUrl), renderEmailHtml(decision, tripUrl), event.tripId, eu261Assessment),
            `${eventId}:EMAIL`,
            eventId,
            event.tripId,
            'EMAIL',
            event.alertEventId
        ));
    }

    // 2. SMS stays short and CRITICAL only
    if (decision.severity === 'CRITICAL') {
        const smsKey = `${eventId}:SMS`;

        if (user.phoneNumber) {
            notifications.push(attemptDispatch(
                () => sendGuardianSMS(user.phoneNumber!, decision.smsText, event.tripId, eu261Assessment),
                smsKey,
                eventId,
                event.tripId,
                'SMS',
                event.alertEventId
            ));
        } else {
            console.warn(`[NOTIFIER] Mandatory SMS degraded safely: User lacks a configured phoneNumber!`);
            await persistSkippedDelivery(eventId, event.tripId, 'SMS');
            if (event.alertEventId) {
                await recordSkippedDelivery(event.alertEventId, 'SMS', 'User lacks a configured phoneNumber');
            }
        }
    }

    // 3. Optional push channel when the user has a push token
    if (user.pushToken) {
        notifications.push(attemptDispatch(
            () => sendGuardianPush(user.id, decision.subject, decision.pushText, event.tripId, eventId),
            `${eventId}:PUSH`,
            eventId,
            event.tripId,
            'PUSH',
            event.alertEventId
        ));
    }

    // 4. Executing Delivery Matrix Non-Blocking
    const results = await Promise.allSettled(notifications);

    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
        console.error(`[NOTIFIER] Notice: Isolated Delivery Matrix degraded resolving ${failures.length} exceptions tracking gracefully.`);
    }
}

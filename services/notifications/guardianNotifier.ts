// services/notifications/guardianNotifier.ts
import { randomUUID } from "node:crypto";

import { Prisma, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ChannelResponse } from "@/services/notifications/types";
import { EmailChannel } from "@/services/notifications/channels/email";
import { SmsChannel } from "@/services/notifications/channels/sms";
import { NotificationProviderManager } from "@/services/notifications/providers";
import { GuardianEvent } from "@/workers/guardianWorker";
import {
    AlertDeliveryChannel,
    queueAlertDelivery,
    recordDeliveryAttemptStart,
    recordDeliveryFailure,
    recordDeliverySuccess,
    recordSkippedDelivery,
} from "@/lib/alertLifecycle";

// Helper sleep mapping
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const DELIVERY_LEASE_MS = 5 * 60 * 1000;
const STALE_PROCESSING_MS = 5 * 60 * 1000;
const MAX_STALE_RECLAIM_ATTEMPTS = 2;

type DeliveryChannel = 'EMAIL' | 'SMS' | 'PUSH';
type NotificationSeverityLabel = 'HIGH' | 'MEDIUM' | 'LOW';

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
const LOW_SEVERITY_THROTTLE_MS = 6 * 60 * 60 * 1000;

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

// ── EVENT CONTENT MAPPING ──

interface FormattedMessage {
    severityLabel: NotificationSeverityLabel;
    title: string;
    shortSummary: string;
    reason: string;
    actionHint: string;
    confidenceTone?: string;
    emailSubject: string;
    emailBody: string;
    smsBody: string;
    pushBody: string;
}

const getFlightContext = (event: GuardianEvent): { routeText: string; flightText: string } => {
    const current = (event.current || {}) as Record<string, unknown>;
    const origin = String(current.origin || '').trim().toUpperCase();
    const destination = String(current.destination || '').trim().toUpperCase();
    const airlineCode = String(current.airlineCode || '').trim().toUpperCase();
    const flightNumber = String(current.flightNumber || '').trim().toUpperCase();
    const routeText = origin && destination ? `${origin} to ${destination}` : 'your monitored route';
    const flightText = airlineCode && flightNumber ? `${airlineCode}${flightNumber}` : 'your monitored flight';
    return { routeText, flightText };
};

const deriveSeverityLabel = (event: GuardianEvent, eu261Assessment: Eu261Assessment | null): NotificationSeverityLabel => {
    const subType = String(event.subType || '').toLowerCase();

    if (
        event.type === 'CANCELLED' ||
        event.type === 'GATE_CHANGE' ||
        event.type === 'DELAY' ||
        eu261Assessment?.eligible === true
    ) {
        return 'HIGH';
    }

    if (
        event.type === 'DATA_ISSUE' ||
        subType.includes('risk') ||
        subType.includes('schedule') ||
        subType.includes('connection')
    ) {
        return 'MEDIUM';
    }

    return 'LOW';
};

const shouldUseLowConfidenceTone = (event: GuardianEvent, eu261Assessment: Eu261Assessment | null): boolean => {
    if (event.type === 'DATA_ISSUE') return true;
    return eu261Assessment?.confidence === 'low' || eu261Assessment?.eligible === 'unknown';
};

const buildEmailBody = (message: Omit<FormattedMessage, 'emailBody' | 'smsBody' | 'pushBody' | 'emailSubject'>): string => {
    const toneSuffix = message.confidenceTone ? `\n\nConfidence note: ${message.confidenceTone}` : '';
    return [
        `Severity: ${message.severityLabel}`,
        `Summary: ${message.shortSummary}`,
        `Reason: ${message.reason}`,
        `Action: ${message.actionHint}`,
        toneSuffix ? toneSuffix.trim() : '',
    ].filter(Boolean).join('\n');
};

const mapEventToMessage = (event: GuardianEvent): FormattedMessage => {
    const eu261Assessment = getEu261Assessment(event);
    const eu261Hint = formatEu261Hint(eu261Assessment);
    const severityLabel = deriveSeverityLabel(event, eu261Assessment);
    const lowConfidenceTone = shouldUseLowConfidenceTone(event, eu261Assessment)
        ? 'This signal is preliminary and may change after the next verification cycle.'
        : undefined;
    const { routeText, flightText } = getFlightContext(event);

    if (event.type === 'DELAY') {
        const delayMinutes = Number((event.current as any)?.delayMinutes || 0);
        const title = `Flight delayed by ${delayMinutes || 'unknown'} minutes`;
        const shortSummary = delayMinutes > 0
            ? `${flightText} is now delayed by ${delayMinutes} minutes.`
            : `${flightText} delay signal detected.`;
        const reason = `You are receiving this alert because periodic monitoring detected delayed status for ${flightText} on ${routeText}.${eu261Hint}`;
        const actionHint = 'Check rebooking options and monitor further periodic updates.';
        const emailSubject = `[${severityLabel}] ${title}`;
        const emailBody = buildEmailBody({
            severityLabel,
            title,
            shortSummary,
            reason,
            actionHint,
            confidenceTone: lowConfidenceTone,
        });
        return {
            severityLabel,
            title,
            shortSummary,
            reason,
            actionHint,
            confidenceTone: lowConfidenceTone,
            emailSubject,
            emailBody,
            smsBody: `${title}. ${actionHint}`,
            pushBody: `${title}. ${actionHint}`,
        };
    }

    if (event.type === 'CANCELLED') {
        const title = 'Flight cancellation detected';
        const shortSummary = `${flightText} is now marked as cancelled.`;
        const reason = `You are receiving this alert because the latest monitoring check identified a possible cancellation for ${flightText} on ${routeText}.${eu261Hint}`;
        const actionHint = 'Contact the airline for rebooking confirmation and keep this notification for claim support.';
        const emailSubject = `[${severityLabel}] ${title}`;
        const emailBody = buildEmailBody({
            severityLabel,
            title,
            shortSummary,
            reason,
            actionHint,
            confidenceTone: lowConfidenceTone,
        });
        return {
            severityLabel,
            title,
            shortSummary,
            reason,
            actionHint,
            confidenceTone: lowConfidenceTone,
            emailSubject,
            emailBody,
            smsBody: `${title}. ${actionHint}`,
            pushBody: `${title}. ${actionHint}`,
        };
    }

    if (event.type === 'GATE_CHANGE') {
        const departureGate = (event.current as any)?.departureGate || 'unknown';
        const title = `Gate change detected${departureGate !== 'unknown' ? `: ${departureGate}` : ''}`;
        const shortSummary = `${flightText} has a gate update.`;
        const reason = `You are receiving this alert because the latest check identified changed gate information for ${flightText} on ${routeText}.`;
        const actionHint = 'Head to airport displays and confirm your terminal/gate before boarding.';
        const emailSubject = `[${severityLabel}] ${title}`;
        const emailBody = buildEmailBody({
            severityLabel,
            title,
            shortSummary,
            reason,
            actionHint,
            confidenceTone: lowConfidenceTone,
        });
        return {
            severityLabel,
            title,
            shortSummary,
            reason,
            actionHint,
            confidenceTone: lowConfidenceTone,
            emailSubject,
            emailBody,
            smsBody: `${title}. ${actionHint}`,
            pushBody: `${title}. ${actionHint}`,
        };
    }

    if (event.type === 'DATA_ISSUE') {
        const title = 'Monitoring confidence reduced';
        const shortSummary = 'Monitoring currently has low-confidence status data.';
        const reason = `You are receiving this alert because provider status data for ${flightText} is currently delayed or unavailable.`;
        const actionHint = 'Monitor updates and verify critical changes directly with the airline.';
        const emailSubject = `[${severityLabel}] ${title}`;
        const emailBody = buildEmailBody({
            severityLabel,
            title,
            shortSummary,
            reason,
            actionHint,
            confidenceTone: lowConfidenceTone,
        });
        return {
            severityLabel,
            title,
            shortSummary,
            reason,
            actionHint,
            confidenceTone: lowConfidenceTone,
            emailSubject,
            emailBody,
            smsBody: `${title}. ${actionHint}`,
            pushBody: `${title}. ${actionHint}`,
        };
    }

    const title = 'Trip monitoring update';
    const shortSummary = 'Guardian detected a minor update.';
    const reason = 'You are receiving this update because your booked trip is actively monitored.';
    const actionHint = 'No immediate action required. Keep monitoring for major changes.';
    const emailSubject = `[${severityLabel}] ${title}`;
    const emailBody = buildEmailBody({
        severityLabel,
        title,
        shortSummary,
        reason,
        actionHint,
        confidenceTone: lowConfidenceTone,
    });
    return {
        severityLabel,
        title,
        shortSummary,
        reason,
        actionHint,
        confidenceTone: lowConfidenceTone,
        emailSubject,
        emailBody,
        smsBody: `${title}. ${actionHint}`,
        pushBody: `${title}. ${actionHint}`,
    };
};

async function shouldThrottleLowSeverity(tripId: string, channel: DeliveryChannel, now: Date): Promise<boolean> {
    const cutoff = new Date(now.getTime() - LOW_SEVERITY_THROTTLE_MS);
    const recent = await prisma.notificationDelivery.findFirst({
        where: {
            tripId,
            channel,
            status: 'sent',
            sentAt: {
                gte: cutoff,
            },
        },
        select: { id: true },
        orderBy: { sentAt: 'desc' },
    });

    return Boolean(recent);
}

// ── CORE NOTIFICATION DISPATCHER ──

export async function notifyGuardianEvent(event: GuardianEvent, user: User | null): Promise<void> {
    if (!user) {
        console.warn(`[NOTIFIER] Validation fault: User missing from Trip boundary. Skipping dispatch.`);
        return;
    }

    const eventId = event.eventId || `${event.tripId}:${event.type}`;
    const eu261Assessment = getEu261Assessment(event);
    const formatted = mapEventToMessage(event);
    const notifications: Promise<void>[] = [];
    const now = new Date();

    // 1. Queue Email Dispatch safely via Dedup Envelope
    if (user.email) {
        const emailKey = `${eventId}:EMAIL`;
        const throttleLow = formatted.severityLabel === 'LOW' && await shouldThrottleLowSeverity(event.tripId, 'EMAIL', now);
        if (throttleLow) {
            await persistSkippedDelivery(eventId, event.tripId, 'EMAIL');
            if (event.alertEventId) {
                await recordSkippedDelivery(event.alertEventId, 'EMAIL', 'Low severity notification throttled');
            }
        } else {
            notifications.push(attemptDispatch(
                () => sendGuardianEmail(user.email!, formatted.emailSubject, formatted.emailBody, event.tripId, eu261Assessment),
                emailKey,
                eventId,
                event.tripId,
                'EMAIL',
                event.alertEventId
            ));
        }
    }

    // 2. SMS stays short + urgent only
    const requiresSMS = formatted.severityLabel === 'HIGH';
    if (requiresSMS) {
        const smsKey = `${eventId}:SMS`;

        if (user.phoneNumber) {
            notifications.push(attemptDispatch(
                () => sendGuardianSMS(user.phoneNumber!, formatted.smsBody, event.tripId, eu261Assessment),
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

    // 3. Optional push channel: short + actionable when user has push token
    if (user.pushToken) {
        const pushKey = `${eventId}:PUSH`;
        const throttleLow = formatted.severityLabel === 'LOW' && await shouldThrottleLowSeverity(event.tripId, 'PUSH', now);
        if (throttleLow) {
            await persistSkippedDelivery(eventId, event.tripId, 'PUSH');
            if (event.alertEventId) {
                await recordSkippedDelivery(event.alertEventId, 'PUSH', 'Low severity notification throttled');
            }
        } else {
            notifications.push(attemptDispatch(
                () => sendGuardianPush(user.id, formatted.title, formatted.pushBody, event.tripId, eventId),
                pushKey,
                eventId,
                event.tripId,
                'PUSH',
                event.alertEventId
            ));
        }
    }

    // 4. Executing Delivery Matrix Non-Blocking
    const results = await Promise.allSettled(notifications);

    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
        console.error(`[NOTIFIER] Notice: Isolated Delivery Matrix degraded resolving ${failures.length} exceptions tracking gracefully.`);
    }
}

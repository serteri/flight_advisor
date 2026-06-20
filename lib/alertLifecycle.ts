import { createHash } from 'node:crypto';

import {
  AlertDeliveryChannel,
  AlertDeliveryStatus,
  AlertLifecycleState,
  AlertSourceType,
  MonitoringEventType,
  Prisma,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';

export {
  AlertDeliveryChannel,
  AlertDeliveryStatus,
  AlertLifecycleState,
  AlertSourceType,
  MonitoringEventType,
};

export const ALERT_LIFECYCLE_STATES: AlertLifecycleState[] = [
  'DETECTED',
  'QUEUED',
  'SENT',
  'DELIVERED',
  'FAILED',
  'RETRYING',
  'EXPIRED',
  'SUPPRESSED',
];

export const MONITORING_EVENT_TAXONOMY = {
  routeTracking: ['PRICE_DROP', 'PRICE_SPIKE', 'TARGET_PRICE_REACHED', 'ROUTE_STALE'],
  guardian: [
    'DELAY_DETECTED',
    'CANCELLATION_DETECTED',
    'GATE_CHANGE',
    'TERMINAL_CHANGE',
    'CONNECTION_RISK',
    'STATUS_UNAVAILABLE',
    'MONITORING_STALE',
    'EQUIPMENT_CHANGE',
  ],
  system: ['PROVIDER_UNAVAILABLE', 'CHECK_DELAYED', 'MONITORING_RECOVERED'],
} satisfies Record<string, MonitoringEventType[]>;

const DEFAULT_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const STALE_COOLDOWN_MS = 12 * 60 * 60 * 1000;

const COOLDOWN_BY_EVENT: Partial<Record<MonitoringEventType, number>> = {
  PRICE_DROP: 3 * 60 * 60 * 1000,
  PRICE_SPIKE: 3 * 60 * 60 * 1000,
  TARGET_PRICE_REACHED: 6 * 60 * 60 * 1000,
  ROUTE_STALE: STALE_COOLDOWN_MS,
  STATUS_UNAVAILABLE: STALE_COOLDOWN_MS,
  MONITORING_STALE: STALE_COOLDOWN_MS,
  PROVIDER_UNAVAILABLE: 2 * 60 * 60 * 1000,
  CHECK_DELAYED: 2 * 60 * 60 * 1000,
  MONITORING_RECOVERED: 30 * 60 * 1000,
};

export type AlertSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface MonitoringAlertInput {
  userId?: string | null;
  routeId?: string | null;
  watchedFlightId?: string | null;
  tripId?: string | null;
  sourceType: AlertSourceType;
  sourceId: string;
  eventType: MonitoringEventType;
  severity: AlertSeverity | string;
  title: string;
  message: string;
  fingerprintParts: unknown[];
  payload?: Prisma.InputJsonValue;
  detectedAt?: Date;
  cooldownMs?: number;
  expiresAt?: Date | null;
}

export interface MonitoringAlertResult {
  alertId: string;
  state: AlertLifecycleState;
  suppressed: boolean;
  suppressedById?: string | null;
}

export function buildAlertFingerprint(parts: unknown[]): string {
  const normalized = JSON.stringify(parts.map((part) => {
    if (part instanceof Date) return part.toISOString();
    if (typeof part === 'string') return part.trim().toUpperCase();
    return part ?? null;
  }));

  return createHash('sha1').update(normalized).digest('hex').slice(0, 16);
}

export function getAlertCooldownMs(eventType: MonitoringEventType): number {
  return COOLDOWN_BY_EVENT[eventType] ?? DEFAULT_COOLDOWN_MS;
}

export function getRetryDelayMs(attempt: number): number {
  const cappedAttempt = Math.max(1, Math.min(attempt, 5));
  return Math.min(60 * 60 * 1000, 2 ** (cappedAttempt - 1) * 60 * 1000);
}

export function nextRetryAt(now: Date, attempt: number): Date {
  return new Date(now.getTime() + getRetryDelayMs(attempt));
}

export async function recordMonitoringEvent(input: MonitoringAlertInput): Promise<MonitoringAlertResult> {
  const now = input.detectedAt ?? new Date();
  const fingerprint = buildAlertFingerprint(input.fingerprintParts);
  const fingerprintKey = `${input.sourceType}:${input.sourceId}:${input.eventType}:${fingerprint}`;
  const cooldownMs = input.cooldownMs ?? getAlertCooldownMs(input.eventType);
  const cooldownCutoff = new Date(now.getTime() - cooldownMs);

  const recentActive = await prisma.alertEvent.findFirst({
    where: {
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      eventType: input.eventType,
      fingerprint,
      state: { notIn: ['EXPIRED', 'SUPPRESSED'] },
      detectedAt: { gte: cooldownCutoff },
    },
    select: { id: true, cooldownUntil: true },
    orderBy: { detectedAt: 'desc' },
  });

  if (recentActive) {
    const suppressed = await prisma.alertEvent.create({
      data: {
        userId: input.userId ?? null,
        routeId: input.routeId ?? null,
        watchedFlightId: input.watchedFlightId ?? null,
        tripId: input.tripId ?? null,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        eventType: input.eventType,
        state: 'SUPPRESSED',
        severity: String(input.severity).toUpperCase(),
        fingerprint,
        fingerprintKey,
        title: input.title,
        message: input.message,
        payload: input.payload ?? Prisma.JsonNull,
        cooldownUntil: recentActive.cooldownUntil ?? new Date(now.getTime() + cooldownMs),
        suppressedById: recentActive.id,
        suppressionReason: 'Duplicate event fingerprint inside cooldown window',
        detectedAt: now,
        expiresAt: input.expiresAt ?? null,
      },
      select: { id: true, state: true, suppressedById: true },
    });

    return {
      alertId: suppressed.id,
      state: suppressed.state,
      suppressed: true,
      suppressedById: suppressed.suppressedById,
    };
  }

  const alert = await prisma.alertEvent.create({
    data: {
      userId: input.userId ?? null,
      routeId: input.routeId ?? null,
      watchedFlightId: input.watchedFlightId ?? null,
      tripId: input.tripId ?? null,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      eventType: input.eventType,
      state: 'DETECTED',
      severity: String(input.severity).toUpperCase(),
      fingerprint,
      fingerprintKey,
      title: input.title,
      message: input.message,
      payload: input.payload ?? Prisma.JsonNull,
      cooldownUntil: new Date(now.getTime() + cooldownMs),
      detectedAt: now,
      expiresAt: input.expiresAt ?? null,
    },
    select: { id: true, state: true },
  });

  return { alertId: alert.id, state: alert.state, suppressed: false };
}

export async function markAlertQueued(alertEventId: string) {
  await prisma.alertEvent.updateMany({
    where: { id: alertEventId, state: { in: ['DETECTED', 'RETRYING'] } },
    data: { state: 'QUEUED', queuedAt: new Date() },
  });
}

export async function markAlertExpired(alertEventId: string) {
  await prisma.alertEvent.updateMany({
    where: { id: alertEventId, state: { notIn: ['DELIVERED', 'SENT', 'EXPIRED'] } },
    data: { state: 'EXPIRED', expiresAt: new Date() },
  });
}

export async function markAlertRecovered(alertEventId: string) {
  await prisma.alertEvent.updateMany({
    where: { id: alertEventId },
    data: { recoveredAt: new Date() },
  });
}

export async function queueAlertDelivery(alertEventId: string, channel: AlertDeliveryChannel, maxAttempts = 4) {
  await markAlertQueued(alertEventId);

  return prisma.alertNotificationDelivery.create({
    data: {
      alertEventId,
      channel,
      status: 'QUEUED',
      maxAttempts,
      nextRetryAt: new Date(),
    },
  });
}

export async function recordDeliveryAttemptStart(deliveryId: string, expectedAttempt?: number) {
  const now = new Date();

  if (expectedAttempt !== undefined) {
    const claimed = await prisma.alertNotificationDelivery.updateMany({
      where: {
        id: deliveryId,
        status: { in: ['QUEUED', 'RETRYING'] },
        attempt: expectedAttempt,
        OR: [
          { nextRetryAt: null },
          { nextRetryAt: { lte: now } },
        ],
      },
      data: {
        status: 'RETRYING',
        attempt: { increment: 1 },
        attemptedAt: now,
      },
    });

    if (claimed.count === 0) return null;

    return prisma.alertNotificationDelivery.findUnique({ where: { id: deliveryId } });
  }

  return prisma.alertNotificationDelivery.update({
    where: { id: deliveryId },
    data: {
      status: 'RETRYING',
      attempt: { increment: 1 },
      attemptedAt: now,
    },
  });
}

export async function recordDeliverySuccess(deliveryId: string, providerMessageId?: string | null) {
  const now = new Date();
  const delivery = await prisma.alertNotificationDelivery.update({
    where: { id: deliveryId },
    data: {
      status: 'SENT',
      providerMessageId: providerMessageId ?? null,
      sentAt: now,
      nextRetryAt: null,
      lastError: null,
    },
    select: { alertEventId: true },
  });

  await prisma.alertEvent.update({
    where: { id: delivery.alertEventId },
    data: {
      state: 'SENT',
      sentAt: now,
      failedAt: null,
    },
  });
}

export async function recordDeliveryFailure(deliveryId: string, errorMessage: string) {
  const now = new Date();
  const current = await prisma.alertNotificationDelivery.findUnique({
    where: { id: deliveryId },
    select: { alertEventId: true, attempt: true, maxAttempts: true },
  });

  if (!current) return;

  const exhausted = current.attempt >= current.maxAttempts;
  const status: AlertDeliveryStatus = exhausted ? 'FAILED' : 'RETRYING';

  await prisma.alertNotificationDelivery.update({
    where: { id: deliveryId },
    data: {
      status,
      lastError: errorMessage,
      failedAt: exhausted ? now : null,
      nextRetryAt: exhausted ? null : nextRetryAt(now, current.attempt),
    },
  });

  await prisma.alertEvent.update({
    where: { id: current.alertEventId },
    data: {
      state: exhausted ? 'FAILED' : 'RETRYING',
      failedAt: now,
    },
  });
}

export async function recordSkippedDelivery(alertEventId: string, channel: AlertDeliveryChannel, reason: string) {
  await prisma.alertNotificationDelivery.create({
    data: {
      alertEventId,
      channel,
      status: 'SUPPRESSED',
      lastError: reason,
      attemptedAt: new Date(),
    },
  });
}

export async function expireDueAlertEvents(now = new Date()) {
  return prisma.alertEvent.updateMany({
    where: {
      expiresAt: { lte: now },
      state: { notIn: ['DELIVERED', 'SENT', 'EXPIRED', 'SUPPRESSED'] },
    },
    data: {
      state: 'EXPIRED',
      failedAt: null,
      updatedAt: now,
    },
  });
}

export async function getAlertHistoryForTrip(tripId: string, take = 25) {
  return prisma.alertEvent.findMany({
    where: { tripId },
    include: { deliveries: { orderBy: { createdAt: 'asc' } } },
    orderBy: { detectedAt: 'desc' },
    take,
  });
}

export async function getAlertHistoryForRoute(routeId: string, take = 25) {
  return prisma.alertEvent.findMany({
    where: { routeId },
    include: { deliveries: { orderBy: { createdAt: 'asc' } } },
    orderBy: { detectedAt: 'desc' },
    take,
  });
}

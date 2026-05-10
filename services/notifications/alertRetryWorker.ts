import { prisma } from '@/lib/prisma';
import {
  recordDeliveryAttemptStart,
  recordDeliveryFailure,
  recordDeliverySuccess,
} from '@/lib/alertLifecycle';
import { EmailChannel } from '@/services/notifications/channels/email';
import { SmsChannel } from '@/services/notifications/channels/sms';
import { NotificationProviderManager } from '@/services/notifications/providers';
import { recordGuardianMetric } from '@/services/healthMetrics';
import type { NotificationPayload } from '@/services/notifications/types';

const emailChannel = EmailChannel.getInstance();
const smsChannel = SmsChannel.getInstance();
const providerManager = NotificationProviderManager.getInstance();

const toNotificationType = (eventType: string): NotificationPayload['type'] => {
  if (eventType.includes('GATE')) return 'GATE_CHANGE';
  if (eventType.includes('PRICE') || eventType.includes('TARGET')) return 'PRICE_DROP';
  if (eventType.includes('SCHEDULE') || eventType.includes('TERMINAL')) return 'SCHEDULE_CHANGE';
  return 'DISRUPTION';
};

export async function processPendingAlertRetries(now = new Date(), take = 25) {
  const retryable = await prisma.alertNotificationDelivery.findMany({
    where: {
      status: 'RETRYING',
      nextRetryAt: { lte: now },
    },
    include: {
      alertEvent: {
        include: {
          user: true,
        },
      },
    },
    orderBy: { nextRetryAt: 'asc' },
    take,
  });

  let attempted = 0;
  let succeeded = 0;
  let failed = 0;

  for (const delivery of retryable.filter((item) => item.attempt < item.maxAttempts)) {
    const user = delivery.alertEvent.user;
    attempted += 1;

    try {
      const claimed = await recordDeliveryAttemptStart(delivery.id, delivery.attempt);
      if (!claimed) {
        continue;
      }
      const title = delivery.alertEvent.title;
      const message = `${delivery.alertEvent.message} Notification delivery retried.`;

      let result: { success: boolean; id?: string; providerMessageId?: string; error?: string };

      if (delivery.channel === 'EMAIL') {
        if (!user?.email) throw new Error('Retry skipped: user email is not configured');
        result = await emailChannel.send(user.email, {
          userId: user.id,
          tripId: delivery.alertEvent.tripId ?? undefined,
          type: toNotificationType(delivery.alertEvent.eventType),
          title,
          message,
          priority: delivery.alertEvent.severity === 'HIGH' || delivery.alertEvent.severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
        });
      } else if (delivery.channel === 'SMS') {
        if (!user?.phoneNumber) throw new Error('Retry skipped: user phone number is not configured');
        result = await smsChannel.send(user.phoneNumber, {
          userId: user.id,
          tripId: delivery.alertEvent.tripId ?? undefined,
          type: toNotificationType(delivery.alertEvent.eventType),
          title,
          message,
          priority: 'CRITICAL',
        });
      } else {
        if (!user?.pushToken) throw new Error('Retry skipped: push token is not configured');
        result = await providerManager.sendPush({
          userId: user.id,
          title,
          body: message,
          data: {
            alertEventId: delivery.alertEventId,
            sourceType: delivery.alertEvent.sourceType,
          },
        });
      }

      if (!result.success) {
        throw new Error(result.error || `${delivery.channel} retry provider returned unsuccessful response`);
      }

      await recordDeliverySuccess(delivery.id, result.providerMessageId ?? result.id ?? null);
      succeeded += 1;

      if (delivery.alertEvent.tripId) {
        recordGuardianMetric({
          tripId: delivery.alertEvent.tripId,
          eventType: 'NOTIFICATION_RETRYING',
          eventSeverity: delivery.alertEvent.severity,
          notificationAttempted: true,
          notificationSucceeded: true,
          channel: delivery.channel,
          timestamp: new Date(),
        });
      }

    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      await recordDeliveryFailure(delivery.id, message);

      if (delivery.alertEvent.tripId) {
        recordGuardianMetric({
          tripId: delivery.alertEvent.tripId,
          eventType: 'NOTIFICATION_RETRYING',
          eventSeverity: delivery.alertEvent.severity,
          notificationAttempted: true,
          notificationSucceeded: false,
          channel: delivery.channel,
          timestamp: new Date(),
        });
      }
    }
  }

  return { attempted, succeeded, failed };
}

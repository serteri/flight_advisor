CREATE TYPE "AlertLifecycleState" AS ENUM (
  'DETECTED',
  'QUEUED',
  'SENT',
  'DELIVERED',
  'FAILED',
  'RETRYING',
  'EXPIRED',
  'SUPPRESSED'
);

CREATE TYPE "MonitoringEventType" AS ENUM (
  'PRICE_DROP',
  'PRICE_SPIKE',
  'TARGET_PRICE_REACHED',
  'ROUTE_STALE',
  'DELAY_DETECTED',
  'CANCELLATION_DETECTED',
  'GATE_CHANGE',
  'TERMINAL_CHANGE',
  'CONNECTION_RISK',
  'STATUS_UNAVAILABLE',
  'MONITORING_STALE',
  'PROVIDER_UNAVAILABLE',
  'CHECK_DELAYED',
  'MONITORING_RECOVERED'
);

CREATE TYPE "AlertSourceType" AS ENUM (
  'ROUTE_WATCH',
  'WATCHED_FLIGHT',
  'MONITORED_TRIP',
  'SYSTEM'
);

CREATE TYPE "AlertDeliveryChannel" AS ENUM (
  'EMAIL',
  'SMS',
  'PUSH'
);

CREATE TYPE "AlertDeliveryStatus" AS ENUM (
  'QUEUED',
  'SENT',
  'DELIVERED',
  'FAILED',
  'RETRYING',
  'SUPPRESSED'
);

CREATE TABLE "AlertEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "routeId" TEXT,
  "watchedFlightId" TEXT,
  "tripId" TEXT,
  "sourceType" "AlertSourceType" NOT NULL,
  "sourceId" TEXT NOT NULL,
  "eventType" "MonitoringEventType" NOT NULL,
  "state" "AlertLifecycleState" NOT NULL DEFAULT 'DETECTED',
  "severity" TEXT NOT NULL DEFAULT 'INFO',
  "fingerprint" TEXT NOT NULL,
  "fingerprintKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "payload" JSONB,
  "cooldownUntil" TIMESTAMP(3),
  "suppressedById" TEXT,
  "suppressionReason" TEXT,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "queuedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "recoveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AlertEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AlertNotificationDelivery" (
  "id" TEXT NOT NULL,
  "alertEventId" TEXT NOT NULL,
  "channel" "AlertDeliveryChannel" NOT NULL,
  "status" "AlertDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 4,
  "providerMessageId" TEXT,
  "lastError" TEXT,
  "nextRetryAt" TIMESTAMP(3),
  "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "attemptedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AlertNotificationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AlertEvent_userId_detectedAt_idx" ON "AlertEvent"("userId", "detectedAt");
CREATE INDEX "AlertEvent_sourceType_sourceId_eventType_detectedAt_idx" ON "AlertEvent"("sourceType", "sourceId", "eventType", "detectedAt");
CREATE INDEX "AlertEvent_state_detectedAt_idx" ON "AlertEvent"("state", "detectedAt");
CREATE INDEX "AlertEvent_fingerprintKey_detectedAt_idx" ON "AlertEvent"("fingerprintKey", "detectedAt");
CREATE INDEX "AlertNotificationDelivery_alertEventId_idx" ON "AlertNotificationDelivery"("alertEventId");
CREATE INDEX "AlertNotificationDelivery_status_nextRetryAt_idx" ON "AlertNotificationDelivery"("status", "nextRetryAt");
CREATE INDEX "AlertNotificationDelivery_channel_status_idx" ON "AlertNotificationDelivery"("channel", "status");

ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_watchedFlightId_fkey" FOREIGN KEY ("watchedFlightId") REFERENCES "WatchedFlight"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "MonitoredTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlertNotificationDelivery" ADD CONSTRAINT "AlertNotificationDelivery_alertEventId_fkey" FOREIGN KEY ("alertEventId") REFERENCES "AlertEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

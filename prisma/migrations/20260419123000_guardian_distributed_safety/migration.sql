ALTER TABLE "MonitoredTrip"
    ADD COLUMN IF NOT EXISTS "processingLeaseId" TEXT,
    ADD COLUMN IF NOT EXISTS "processingLeaseExpiresAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "MonitoredTrip_status_nextCheckAt_processingLeaseExpiresAt_idx"
    ON "MonitoredTrip"("status", "nextCheckAt", "processingLeaseExpiresAt");

CREATE TABLE IF NOT EXISTS "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "processingLeaseId" TEXT,
    "processingLeaseExpiresAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "NotificationDelivery"
    ADD COLUMN IF NOT EXISTS "claimedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "processingLeaseId" TEXT,
    ADD COLUMN IF NOT EXISTS "processingLeaseExpiresAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "attemptCount" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "lastError" TEXT,
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "NotificationDelivery"
    ALTER COLUMN "sentAt" DROP NOT NULL,
    ALTER COLUMN "sentAt" DROP DEFAULT;

CREATE UNIQUE INDEX IF NOT EXISTS "NotificationDelivery_eventId_channel_key"
    ON "NotificationDelivery"("eventId", "channel");

CREATE INDEX IF NOT EXISTS "NotificationDelivery_tripId_idx"
    ON "NotificationDelivery"("tripId");

CREATE INDEX IF NOT EXISTS "NotificationDelivery_status_processingLeaseExpiresAt_idx"
    ON "NotificationDelivery"("status", "processingLeaseExpiresAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'NotificationDelivery_tripId_fkey'
    ) THEN
        ALTER TABLE "NotificationDelivery"
            ADD CONSTRAINT "NotificationDelivery_tripId_fkey"
            FOREIGN KEY ("tripId") REFERENCES "MonitoredTrip"("id")
            ON DELETE CASCADE
            ON UPDATE CASCADE;
    END IF;
END $$;

-- Step 2 of 2. Run after docs/phase1_schema_1_enum.sql has succeeded.
-- AlterTable
ALTER TABLE "MonitoredTrip" ADD COLUMN     "apiCallsUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "lastEmailError" TEXT,
ADD COLUMN     "lastEmailErrorAt" TIMESTAMP(3),
ADD COLUMN     "monitoringEndsAt" TIMESTAMP(3),
ADD COLUMN     "requestIpHash" TEXT,
ADD COLUMN     "routeUnknown" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "LoginToken" ADD COLUMN     "emailError" TEXT;

-- AlterTable
ALTER TABLE "FlightSegment" ADD COLUMN     "scheduledArrivalUtc" TIMESTAMP(3),
ADD COLUMN     "scheduledDepartureUtc" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ScheduledTripCheck" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL,
    "messageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledTripCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiQuotaState" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "callsUsed" INTEGER NOT NULL DEFAULT 0,
    "unitsUsed" INTEGER NOT NULL DEFAULT 0,
    "headerLimit" INTEGER,
    "headerRemaining" INTEGER,
    "headerKind" TEXT,
    "lastAlertThreshold" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiQuotaState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduledTripCheck_tripId_status_idx" ON "ScheduledTripCheck"("tripId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ApiQuotaState_provider_period_key" ON "ApiQuotaState"("provider", "period");

-- CreateIndex
CREATE INDEX "MonitoredTrip_subscriberEmail_createdAt_idx" ON "MonitoredTrip"("subscriberEmail", "createdAt");

-- CreateIndex
CREATE INDEX "MonitoredTrip_requestIpHash_createdAt_idx" ON "MonitoredTrip"("requestIpHash", "createdAt");

-- AddForeignKey
ALTER TABLE "ScheduledTripCheck" ADD CONSTRAINT "ScheduledTripCheck_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "MonitoredTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;


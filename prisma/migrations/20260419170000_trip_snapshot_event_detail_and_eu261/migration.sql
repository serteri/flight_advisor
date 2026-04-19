-- Enrich TripSnapshot with event-level detail and EU261 skeleton eligibility
ALTER TABLE "TripSnapshot"
ADD COLUMN IF NOT EXISTS "statusDetail" TEXT,
ADD COLUMN IF NOT EXISTS "gateDetail" TEXT,
ADD COLUMN IF NOT EXISTS "lastEventId" TEXT,
ADD COLUMN IF NOT EXISTS "eu261Eligible" BOOLEAN NOT NULL DEFAULT false;

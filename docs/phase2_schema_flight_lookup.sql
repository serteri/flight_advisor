-- Phase 2 schema: "find my flight" step of the sign-up form.
-- NOT APPLIED. Matches `prisma migrate diff` from origin/phase-2:prisma/schema.prisma.
--
-- Additive only (one nullable column, two new tables); no data change, safe to
-- re-run only after checking nothing exists yet (plain CREATE/ADD, no IF NOT EXISTS).
--
-- APPLY BEFORE DEPLOYING the code: Prisma selects every MonitoredTrip column, so
-- code that knows "flightVerifiedAt" fails ALL trip queries on a database
-- without it. The two enum values from docs/phase2_schema_flight_not_found.sql
-- are a separate prerequisite of the flight-validation work.

ALTER TABLE "MonitoredTrip" ADD COLUMN "flightVerifiedAt" TIMESTAMP(3);

CREATE TABLE "FlightLookupCache" (
    "id" TEXT NOT NULL,
    "flightNumber" TEXT NOT NULL,
    "flightDate" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FlightLookupCache_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FlightLookupAttempt" (
    "id" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FlightLookupAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FlightLookupCache_fetchedAt_idx" ON "FlightLookupCache"("fetchedAt");
CREATE UNIQUE INDEX "FlightLookupCache_flightNumber_flightDate_key" ON "FlightLookupCache"("flightNumber", "flightDate");
CREATE INDEX "FlightLookupAttempt_ipHash_createdAt_idx" ON "FlightLookupAttempt"("ipHash", "createdAt");

CREATE TABLE "FlightLeg" (
  "id" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "flightNumber" TEXT NOT NULL,
  "origin" TEXT NOT NULL,
  "destination" TEXT NOT NULL,
  "scheduledDep" TIMESTAMP(3) NOT NULL,
  "scheduledArr" TIMESTAMP(3) NOT NULL,
  "actualDep" TIMESTAMP(3),
  "actualArr" TIMESTAMP(3),
  "carrier" TEXT NOT NULL,
  "distanceKm" INTEGER,
  "regulationZone" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FlightLeg_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CompensationClaim" ADD COLUMN "flightLegId" TEXT;
ALTER TABLE "CompensationClaim" ADD COLUMN "eligibilityStatus" TEXT;
ALTER TABLE "CompensationClaim" ADD COLUMN "regulation" TEXT;
ALTER TABLE "CompensationClaim" ADD COLUMN "estimatedAmount" INTEGER;
ALTER TABLE "CompensationClaim" ADD COLUMN "delayMinutes" INTEGER;
ALTER TABLE "CompensationClaim" ADD COLUMN "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "CompensationClaim" ALTER COLUMN "monitorId" DROP NOT NULL;
ALTER TABLE "CompensationClaim" ALTER COLUMN "type" DROP NOT NULL;

CREATE INDEX "FlightLeg_tripId_idx" ON "FlightLeg"("tripId");
CREATE INDEX "FlightLeg_origin_destination_idx" ON "FlightLeg"("origin", "destination");
CREATE INDEX "FlightLeg_flightNumber_scheduledDep_idx" ON "FlightLeg"("flightNumber", "scheduledDep");
CREATE INDEX "FlightLeg_regulationZone_idx" ON "FlightLeg"("regulationZone");
CREATE UNIQUE INDEX "CompensationClaim_flightLegId_key" ON "CompensationClaim"("flightLegId");
CREATE INDEX "CompensationClaim_flightLegId_idx" ON "CompensationClaim"("flightLegId");
CREATE INDEX "CompensationClaim_eligibilityStatus_idx" ON "CompensationClaim"("eligibilityStatus");

ALTER TABLE "FlightLeg" ADD CONSTRAINT "FlightLeg_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "MonitoredTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompensationClaim" ADD CONSTRAINT "CompensationClaim_flightLegId_fkey" FOREIGN KEY ("flightLegId") REFERENCES "FlightLeg"("id") ON DELETE CASCADE ON UPDATE CASCADE;

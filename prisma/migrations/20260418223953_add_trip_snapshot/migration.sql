-- CreateTable
CREATE TABLE "TripSnapshot" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "delayMinutes" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "departureGate" TEXT,
    "arrivalGate" TEXT,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TripSnapshot_tripId_key" ON "TripSnapshot"("tripId");

-- AddForeignKey
ALTER TABLE "TripSnapshot" ADD CONSTRAINT "TripSnapshot_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "MonitoredTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

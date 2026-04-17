-- Flight DNA fields for richer analytics and decisioning
ALTER TABLE "FlightSearchRecord"
ADD COLUMN "airlineName" TEXT,
ADD COLUMN "airlineCode" TEXT,
ADD COLUMN "stops" INTEGER,
ADD COLUMN "totalDurationMinutes" INTEGER,
ADD COLUMN "layoverAirports" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "departureTime" TIMESTAMP(3),
ADD COLUMN "arrivalTime" TIMESTAMP(3);

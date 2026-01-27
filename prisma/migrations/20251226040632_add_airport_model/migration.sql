-- CreateEnum
CREATE TYPE "AirportType" AS ENUM ('DOMESTIC', 'INTERNATIONAL', 'REGIONAL');

-- CreateTable
CREATE TABLE "Airport" (
    "id" TEXT NOT NULL,
    "iata" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "ranking" DOUBLE PRECISION NOT NULL DEFAULT 99.9,
    "type" "AirportType" NOT NULL DEFAULT 'INTERNATIONAL',

    CONSTRAINT "Airport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Airport_iata_key" ON "Airport"("iata");

-- CreateIndex
CREATE INDEX "Airport_city_idx" ON "Airport"("city");

-- CreateIndex
CREATE INDEX "Airport_name_idx" ON "Airport"("name");

-- CreateIndex
CREATE INDEX "Airport_iata_idx" ON "Airport"("iata");

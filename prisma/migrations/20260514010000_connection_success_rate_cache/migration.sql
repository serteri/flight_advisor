CREATE TABLE "ConnectionCache" (
  "id" TEXT NOT NULL,
  "flightIdent" TEXT NOT NULL,
  "analysisDate" DATE NOT NULL,
  "historyData" JSONB NOT NULL,
  "onTimeRate" DOUBLE PRECISION NOT NULL,
  "sampleSize" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ConnectionCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConnectionCache_flightIdent_analysisDate_key" ON "ConnectionCache"("flightIdent", "analysisDate");
CREATE INDEX "ConnectionCache_expiresAt_idx" ON "ConnectionCache"("expiresAt");

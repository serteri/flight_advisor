/*
  Warnings:

  - A unique constraint covering the columns `[stripeCustomerId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "MonitorType" AS ENUM ('UPGRADE_SNIPER', 'DISRUPTION_HUNTER', 'EMPTY_SEAT', 'SCHEDULE_GUARDIAN', 'AMENITY_WATCHDOG');

-- CreateEnum
CREATE TYPE "MonitorStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'TRIGGERED');

-- CreateEnum
CREATE TYPE "ClaimType" AS ENUM ('DELAY', 'CANCELLATION', 'AMENITY');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'REJECTED');

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isPremium" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notificationTone" TEXT NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "pushToken" TEXT,
ADD COLUMN     "stripeCurrentPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripePriceId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT,
ADD COLUMN     "subscriptionPlan" TEXT NOT NULL DEFAULT 'FREE',
ADD COLUMN     "subscriptionStatus" TEXT,
ADD COLUMN     "telegramId" TEXT,
ADD COLUMN     "trialEndsAt" TIMESTAMP(3),
ADD COLUMN     "trialReminderSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RouteStatistics" (
    "id" TEXT NOT NULL,
    "originCode" TEXT NOT NULL,
    "destinationCode" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "minPrice" DOUBLE PRECISION NOT NULL,
    "maxPrice" DOUBLE PRECISION NOT NULL,
    "avgPrice" DOUBLE PRECISION NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RouteStatistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "originCode" TEXT NOT NULL,
    "destinationCode" TEXT NOT NULL,
    "departureDate" TIMESTAMP(3) NOT NULL,
    "bestPrice" DOUBLE PRECISION,
    "bestDuration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlightSearchRecord" (
    "id" TEXT NOT NULL,
    "flightNumber" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "departureDate" TIMESTAMP(3) NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "provider" TEXT NOT NULL,
    "rawResponse" JSONB,
    "cacheStatus" TEXT DEFAULT 'SUCCESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlightSearchRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchAnalytics" (
    "id" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "departureDate" TIMESTAMP(3) NOT NULL,
    "minPrice" DOUBLE PRECISION NOT NULL,
    "avgPrice" DOUBLE PRECISION NOT NULL,
    "foundMinPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "foundAvgPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "provider" TEXT NOT NULL,
    "searchTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "selectionAction" TEXT,
    "selectionVariant" TEXT,
    "decisionRecommendation" TEXT,
    "decisionConfidence" INTEGER,
    "selectedPrice" DOUBLE PRECISION,

    CONSTRAINT "SearchAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteInsight" (
    "id" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "departureDate" TIMESTAMP(3) NOT NULL,
    "searchCount" INTEGER NOT NULL DEFAULT 0,
    "lastMinPrice" DOUBLE PRECISION NOT NULL,
    "lastAvgPrice" DOUBLE PRECISION NOT NULL,
    "avgPriceRoute" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "observedMinPrice" DOUBLE PRECISION NOT NULL,
    "observedMaxPrice" DOUBLE PRECISION NOT NULL,
    "rollingAvgPrice" DOUBLE PRECISION NOT NULL,
    "recommendedBookingWindowDays" INTEGER,
    "lastObservedDaysToDeparture" INTEGER,
    "bookingWindowPattern" JSONB,
    "volatility" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastSearchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RouteInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlightSelectionEvent" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "flightId" TEXT,
    "flightNumber" TEXT,
    "provider" TEXT,
    "origin" TEXT,
    "destination" TEXT,
    "departureDate" TIMESTAMP(3),
    "selectedPrice" DOUBLE PRECISION,
    "selectedScore" DOUBLE PRECISION,
    "competitorPrice" DOUBLE PRECISION,
    "competitorScore" DOUBLE PRECISION,
    "rank" INTEGER,
    "totalResults" INTEGER,
    "currency" TEXT,
    "experimentId" TEXT,
    "variantId" TEXT,
    "decisionRecommendation" TEXT,
    "decisionConfidence" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlightSelectionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "airline" TEXT,
    "origin" TEXT,
    "destination" TEXT,
    "departureDate" TIMESTAMP(3),
    "flightId" TEXT,
    "provider" TEXT,
    "selectedPrice" DOUBLE PRECISION,
    "selectedScore" DOUBLE PRECISION,
    "competitorPrice" DOUBLE PRECISION,
    "competitorScore" DOUBLE PRECISION,
    "isDirect" BOOLEAN NOT NULL DEFAULT false,
    "isNight" BOOLEAN NOT NULL DEFAULT false,
    "departureHour" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchedFlight" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "flightNumber" TEXT NOT NULL,
    "airline" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "departureDate" TIMESTAMP(3) NOT NULL,
    "initialPrice" DOUBLE PRECISION NOT NULL,
    "currentPrice" DOUBLE PRECISION,
    "priceHistory" JSONB,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastChecked" TIMESTAMP(3),
    "totalDuration" INTEGER,
    "stops" INTEGER,
    "segments" JSONB,
    "layovers" JSONB,
    "baggageWeight" INTEGER,
    "cabin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WatchedFlight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Monitor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pnr" TEXT,
    "flightNumber" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "MonitorType" NOT NULL,
    "status" "MonitorStatus" NOT NULL DEFAULT 'ACTIVE',
    "targetPrice" DOUBLE PRECISION,
    "originalSchedule" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Monitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompensationClaim" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "type" "ClaimType" NOT NULL,
    "amount" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "ClaimStatus" NOT NULL DEFAULT 'DRAFT',
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompensationClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitoredTrip" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pnr" TEXT NOT NULL,
    "routeLabel" TEXT NOT NULL,
    "originalPrice" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "ticketClass" TEXT NOT NULL,
    "fareBasis" TEXT,
    "isRefundable" BOOLEAN NOT NULL DEFAULT false,
    "targetUpgradePrice" DOUBLE PRECISION,
    "watchPrice" BOOLEAN NOT NULL DEFAULT true,
    "watchDelay" BOOLEAN NOT NULL DEFAULT true,
    "watchUpgrade" BOOLEAN NOT NULL DEFAULT false,
    "watchSeat" BOOLEAN NOT NULL DEFAULT false,
    "watchSchedule" BOOLEAN NOT NULL DEFAULT true,
    "status" "TripStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastCheckedAt" TIMESTAMP(3),
    "nextCheckAt" TIMESTAMP(3) NOT NULL,
    "checkFrequency" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitoredTrip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Passenger" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "age" INTEGER,

    CONSTRAINT "Passenger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlightSegment" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "segmentOrder" INTEGER NOT NULL DEFAULT 0,
    "airlineCode" TEXT NOT NULL,
    "flightNumber" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "departureDate" TIMESTAMP(3) NOT NULL,
    "arrivalDate" TIMESTAMP(3) NOT NULL,
    "aircraftType" TEXT,
    "userSeat" TEXT,
    "cabinClass" TEXT,

    CONSTRAINT "FlightSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuardianAlert" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "segmentId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "potentialValue" TEXT,
    "actionLabel" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuardianAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlightOption" (
    "id" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "airline" TEXT NOT NULL,
    "flightNumber" TEXT NOT NULL,
    "departureTime" TIMESTAMP(3) NOT NULL,
    "arrivalTime" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "stops" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "score" DOUBLE PRECISION DEFAULT 0,
    "scoreReason" TEXT,
    "amenities" JSONB,
    "policies" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlightOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experiment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "experimentType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "targetMetric" TEXT NOT NULL,
    "minSampleSize" INTEGER NOT NULL DEFAULT 100,
    "variants" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Experiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "experimentId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "assigned" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExperimentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionAccuracy" (
    "id" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "departureDate" TIMESTAMP(3) NOT NULL,
    "decisionType" TEXT NOT NULL,
    "decisionConfidence" INTEGER NOT NULL,
    "priceAtDecision" DOUBLE PRECISION NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL,
    "evaluatedAt" TIMESTAMP(3),
    "priceAtEvaluation" DOUBLE PRECISION,
    "priceChange" DOUBLE PRECISION,
    "priceChangePercent" DOUBLE PRECISION,
    "isAccurate" BOOLEAN,
    "accuracyScore" INTEGER,
    "eventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DecisionAccuracy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionConfig" (
    "id" TEXT NOT NULL,
    "decisionType" TEXT NOT NULL,
    "priceThresholdMin" DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    "priceThresholdMax" DOUBLE PRECISION NOT NULL DEFAULT 0.30,
    "timePressureWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "volatilitySensitivity" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "trendClarityWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    "safetyBounds" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "DecisionConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionPerformanceMetric" (
    "id" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "dateWindow" TIMESTAMP(3) NOT NULL,
    "decisionType" TEXT NOT NULL,
    "shownCount" INTEGER NOT NULL DEFAULT 0,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "bookCount" INTEGER NOT NULL DEFAULT 0,
    "trackCount" INTEGER NOT NULL DEFAULT 0,
    "ignoreCount" INTEGER NOT NULL DEFAULT 0,
    "clickRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conversionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trackRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ignoreRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgAccuracyScore" INTEGER,
    "accurateCount" INTEGER NOT NULL DEFAULT 0,
    "experimentId" TEXT,
    "variantId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DecisionPerformanceMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RouteStatistics_originCode_destinationCode_idx" ON "RouteStatistics"("originCode", "destinationCode");

-- CreateIndex
CREATE UNIQUE INDEX "RouteStatistics_originCode_destinationCode_month_key" ON "RouteStatistics"("originCode", "destinationCode", "month");

-- CreateIndex
CREATE INDEX "FlightSearchRecord_origin_destination_departureDate_idx" ON "FlightSearchRecord"("origin", "destination", "departureDate");

-- CreateIndex
CREATE INDEX "FlightSearchRecord_flightNumber_departureDate_idx" ON "FlightSearchRecord"("flightNumber", "departureDate");

-- CreateIndex
CREATE INDEX "FlightSearchRecord_provider_cacheStatus_createdAt_idx" ON "FlightSearchRecord"("provider", "cacheStatus", "createdAt");

-- CreateIndex
CREATE INDEX "FlightSearchRecord_createdAt_idx" ON "FlightSearchRecord"("createdAt");

-- CreateIndex
CREATE INDEX "SearchAnalytics_origin_destination_departureDate_idx" ON "SearchAnalytics"("origin", "destination", "departureDate");

-- CreateIndex
CREATE INDEX "SearchAnalytics_provider_searchTimestamp_idx" ON "SearchAnalytics"("provider", "searchTimestamp");

-- CreateIndex
CREATE INDEX "SearchAnalytics_searchTimestamp_idx" ON "SearchAnalytics"("searchTimestamp");

-- CreateIndex
CREATE INDEX "SearchAnalytics_selectionVariant_selectionAction_idx" ON "SearchAnalytics"("selectionVariant", "selectionAction");

-- CreateIndex
CREATE INDEX "RouteInsight_origin_destination_idx" ON "RouteInsight"("origin", "destination");

-- CreateIndex
CREATE INDEX "RouteInsight_departureDate_lastSearchedAt_idx" ON "RouteInsight"("departureDate", "lastSearchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RouteInsight_origin_destination_departureDate_key" ON "RouteInsight"("origin", "destination", "departureDate");

-- CreateIndex
CREATE INDEX "FlightSelectionEvent_action_createdAt_idx" ON "FlightSelectionEvent"("action", "createdAt");

-- CreateIndex
CREATE INDEX "FlightSelectionEvent_origin_destination_departureDate_idx" ON "FlightSelectionEvent"("origin", "destination", "departureDate");

-- CreateIndex
CREATE INDEX "FlightSelectionEvent_experimentId_variantId_idx" ON "FlightSelectionEvent"("experimentId", "variantId");

-- CreateIndex
CREATE INDEX "FlightSelectionEvent_decisionRecommendation_idx" ON "FlightSelectionEvent"("decisionRecommendation");

-- CreateIndex
CREATE INDEX "UserPreference_userId_createdAt_idx" ON "UserPreference"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserPreference_origin_destination_departureDate_idx" ON "UserPreference"("origin", "destination", "departureDate");

-- CreateIndex
CREATE INDEX "UserPreference_isDirect_isNight_createdAt_idx" ON "UserPreference"("isDirect", "isNight", "createdAt");

-- CreateIndex
CREATE INDEX "WatchedFlight_userId_idx" ON "WatchedFlight"("userId");

-- CreateIndex
CREATE INDEX "WatchedFlight_origin_destination_idx" ON "WatchedFlight"("origin", "destination");

-- CreateIndex
CREATE INDEX "WatchedFlight_departureDate_idx" ON "WatchedFlight"("departureDate");

-- CreateIndex
CREATE INDEX "WatchedFlight_status_idx" ON "WatchedFlight"("status");

-- CreateIndex
CREATE INDEX "Monitor_userId_idx" ON "Monitor"("userId");

-- CreateIndex
CREATE INDEX "Monitor_status_idx" ON "Monitor"("status");

-- CreateIndex
CREATE INDEX "CompensationClaim_monitorId_idx" ON "CompensationClaim"("monitorId");

-- CreateIndex
CREATE INDEX "MonitoredTrip_userId_idx" ON "MonitoredTrip"("userId");

-- CreateIndex
CREATE INDEX "MonitoredTrip_status_nextCheckAt_idx" ON "MonitoredTrip"("status", "nextCheckAt");

-- CreateIndex
CREATE INDEX "Passenger_tripId_idx" ON "Passenger"("tripId");

-- CreateIndex
CREATE INDEX "FlightSegment_tripId_idx" ON "FlightSegment"("tripId");

-- CreateIndex
CREATE INDEX "Experiment_status_idx" ON "Experiment"("status");

-- CreateIndex
CREATE INDEX "Experiment_startDate_endDate_idx" ON "Experiment"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "ExperimentAssignment_experimentId_idx" ON "ExperimentAssignment"("experimentId");

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentAssignment_userId_experimentId_key" ON "ExperimentAssignment"("userId", "experimentId");

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentAssignment_sessionId_experimentId_key" ON "ExperimentAssignment"("sessionId", "experimentId");

-- CreateIndex
CREATE INDEX "DecisionAccuracy_decisionType_isAccurate_idx" ON "DecisionAccuracy"("decisionType", "isAccurate");

-- CreateIndex
CREATE INDEX "DecisionAccuracy_origin_destination_idx" ON "DecisionAccuracy"("origin", "destination");

-- CreateIndex
CREATE INDEX "DecisionAccuracy_createdAt_idx" ON "DecisionAccuracy"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DecisionConfig_decisionType_key" ON "DecisionConfig"("decisionType");

-- CreateIndex
CREATE INDEX "DecisionConfig_decisionType_idx" ON "DecisionConfig"("decisionType");

-- CreateIndex
CREATE INDEX "DecisionPerformanceMetric_origin_destination_idx" ON "DecisionPerformanceMetric"("origin", "destination");

-- CreateIndex
CREATE INDEX "DecisionPerformanceMetric_dateWindow_idx" ON "DecisionPerformanceMetric"("dateWindow");

-- CreateIndex
CREATE INDEX "DecisionPerformanceMetric_experimentId_idx" ON "DecisionPerformanceMetric"("experimentId");

-- CreateIndex
CREATE UNIQUE INDEX "DecisionPerformanceMetric_origin_destination_dateWindow_dec_key" ON "DecisionPerformanceMetric"("origin", "destination", "dateWindow", "decisionType");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchedFlight" ADD CONSTRAINT "WatchedFlight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Monitor" ADD CONSTRAINT "Monitor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompensationClaim" ADD CONSTRAINT "CompensationClaim_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitoredTrip" ADD CONSTRAINT "MonitoredTrip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Passenger" ADD CONSTRAINT "Passenger_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "MonitoredTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightSegment" ADD CONSTRAINT "FlightSegment_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "MonitoredTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianAlert" ADD CONSTRAINT "GuardianAlert_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "MonitoredTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentAssignment" ADD CONSTRAINT "ExperimentAssignment_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentAssignment" ADD CONSTRAINT "ExperimentAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

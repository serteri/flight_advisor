-- CreateEnum
CREATE TYPE "CabinClass" AS ENUM ('ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST');

-- CreateEnum
CREATE TYPE "AirportType" AS ENUM ('DOMESTIC', 'INTERNATIONAL', 'REGIONAL');

-- CreateEnum
CREATE TYPE "MonitorType" AS ENUM ('UPGRADE_SNIPER', 'DISRUPTION_HUNTER', 'EMPTY_SEAT', 'SCHEDULE_GUARDIAN', 'AMENITY_WATCHDOG');

-- CreateEnum
CREATE TYPE "MonitorStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'TRIGGERED');

-- CreateEnum
CREATE TYPE "ClaimType" AS ENUM ('DELAY', 'CANCELLATION', 'AMENITY');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'REJECTED');

-- CreateEnum
CREATE TYPE "AlertLifecycleState" AS ENUM ('DETECTED', 'QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'RETRYING', 'EXPIRED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "MonitoringEventType" AS ENUM ('PRICE_DROP', 'PRICE_SPIKE', 'TARGET_PRICE_REACHED', 'ROUTE_STALE', 'DELAY_DETECTED', 'CANCELLATION_DETECTED', 'GATE_CHANGE', 'TERMINAL_CHANGE', 'CONNECTION_RISK', 'STATUS_UNAVAILABLE', 'MONITORING_STALE', 'PROVIDER_UNAVAILABLE', 'CHECK_DELAYED', 'MONITORING_RECOVERED');

-- CreateEnum
CREATE TYPE "AlertSourceType" AS ENUM ('ROUTE_WATCH', 'WATCHED_FLIGHT', 'MONITORED_TRIP', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AlertDeliveryChannel" AS ENUM ('EMAIL', 'SMS', 'PUSH');

-- CreateEnum
CREATE TYPE "AlertDeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'RETRYING', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "stripeCurrentPeriodEnd" TIMESTAMP(3),
    "subscriptionStatus" TEXT,
    "trialEndsAt" TIMESTAMP(3),
    "trialReminderSentAt" TIMESTAMP(3),
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "subscriptionPlan" TEXT NOT NULL DEFAULT 'FREE',
    "notificationTone" TEXT NOT NULL DEFAULT 'STANDARD',
    "phoneNumber" TEXT,
    "telegramId" TEXT,
    "pushToken" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Route" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originCode" TEXT NOT NULL,
    "destinationCode" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "tripType" TEXT NOT NULL DEFAULT 'ONE_WAY',
    "cabin" "CabinClass" NOT NULL DEFAULT 'ECONOMY',
    "maxStops" INTEGER,
    "targetPrice" DOUBLE PRECISION,
    "baggageRequired" BOOLEAN,
    "preferredAirlines" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "trendStatus" TEXT DEFAULT 'UNKNOWN',
    "timingSignal" TEXT DEFAULT 'WATCH_CLOSELY',
    "timingReason" TEXT,
    "latestSnapshotAt" TIMESTAMP(3),
    "lastSignalAt" TIMESTAMP(3),
    "currentPrice" DOUBLE PRECISION,
    "stats_mean" DOUBLE PRECISION,
    "stats_stdDev" DOUBLE PRECISION,
    "stats_lastUpdated" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceSnapshot" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'Skyscanner',
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" DOUBLE PRECISION,
    "explanation" TEXT,
    "duration" INTEGER,
    "stops" INTEGER,

    CONSTRAINT "PriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertLog" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "oldPrice" DOUBLE PRECISION,
    "newPrice" DOUBLE PRECISION,
    "dropPercent" DOUBLE PRECISION,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Airport" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isMajor" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Airport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

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
    "airlineName" TEXT,
    "airlineCode" TEXT,
    "stops" INTEGER,
    "totalDurationMinutes" INTEGER,
    "layoverAirports" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "departureTime" TIMESTAMP(3),
    "arrivalTime" TIMESTAMP(3),
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
    "monitorId" TEXT,
    "flightLegId" TEXT,
    "type" "ClaimType",
    "amount" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "ClaimStatus" NOT NULL DEFAULT 'DRAFT',
    "details" JSONB,
    "eligibilityStatus" TEXT,
    "regulation" TEXT,
    "estimatedAmount" INTEGER,
    "delayMinutes" INTEGER,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
    "processingLeaseId" TEXT,
    "processingLeaseExpiresAt" TIMESTAMP(3),
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

-- CreateTable
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
CREATE TABLE "AlertEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "routeId" TEXT,
    "watchedFlightId" TEXT,
    "tripId" TEXT,
    "sourceType" "AlertSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "eventType" "MonitoringEventType" NOT NULL,
    "state" "AlertLifecycleState" NOT NULL DEFAULT 'DETECTED',
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "fingerprint" TEXT NOT NULL,
    "fingerprintKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "cooldownUntil" TIMESTAMP(3),
    "suppressedById" TEXT,
    "suppressionReason" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "queuedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "recoveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertNotificationDelivery" (
    "id" TEXT NOT NULL,
    "alertEventId" TEXT NOT NULL,
    "channel" "AlertDeliveryChannel" NOT NULL,
    "status" "AlertDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 4,
    "providerMessageId" TEXT,
    "lastError" TEXT,
    "nextRetryAt" TIMESTAMP(3),
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attemptedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertNotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripSnapshot" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "delayMinutes" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "dataQuality" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "departureGate" TEXT,
    "arrivalGate" TEXT,
    "statusDetail" TEXT,
    "gateDetail" TEXT,
    "lastEventId" TEXT,
    "eu261Eligible" BOOLEAN NOT NULL DEFAULT false,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "DisruptionPlaybook" (
    "id" TEXT NOT NULL,
    "monitoredTripId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scenarioA" JSONB NOT NULL,
    "scenarioB" JSONB NOT NULL,
    "scenarioC" JSONB NOT NULL,
    "airlineIata" TEXT NOT NULL,
    "regulationZone" TEXT NOT NULL,
    "connectionCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DisruptionPlaybook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Route_userId_idx" ON "Route"("userId");

-- CreateIndex
CREATE INDEX "Route_originCode_destinationCode_idx" ON "Route"("originCode", "destinationCode");

-- CreateIndex
CREATE INDEX "Airport_cityId_idx" ON "Airport"("cityId");

-- CreateIndex
CREATE INDEX "Airport_code_idx" ON "Airport"("code");

-- CreateIndex
CREATE INDEX "City_name_idx" ON "City"("name");

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
CREATE UNIQUE INDEX "CompensationClaim_flightLegId_key" ON "CompensationClaim"("flightLegId");

-- CreateIndex
CREATE INDEX "CompensationClaim_monitorId_idx" ON "CompensationClaim"("monitorId");

-- CreateIndex
CREATE INDEX "CompensationClaim_flightLegId_idx" ON "CompensationClaim"("flightLegId");

-- CreateIndex
CREATE INDEX "CompensationClaim_eligibilityStatus_idx" ON "CompensationClaim"("eligibilityStatus");

-- CreateIndex
CREATE INDEX "MonitoredTrip_userId_idx" ON "MonitoredTrip"("userId");

-- CreateIndex
CREATE INDEX "MonitoredTrip_status_nextCheckAt_idx" ON "MonitoredTrip"("status", "nextCheckAt");

-- CreateIndex
CREATE INDEX "MonitoredTrip_status_nextCheckAt_processingLeaseExpiresAt_idx" ON "MonitoredTrip"("status", "nextCheckAt", "processingLeaseExpiresAt");

-- CreateIndex
CREATE INDEX "Passenger_tripId_idx" ON "Passenger"("tripId");

-- CreateIndex
CREATE INDEX "FlightSegment_tripId_idx" ON "FlightSegment"("tripId");

-- CreateIndex
CREATE INDEX "FlightLeg_tripId_idx" ON "FlightLeg"("tripId");

-- CreateIndex
CREATE INDEX "FlightLeg_origin_destination_idx" ON "FlightLeg"("origin", "destination");

-- CreateIndex
CREATE INDEX "FlightLeg_flightNumber_scheduledDep_idx" ON "FlightLeg"("flightNumber", "scheduledDep");

-- CreateIndex
CREATE INDEX "FlightLeg_regulationZone_idx" ON "FlightLeg"("regulationZone");

-- CreateIndex
CREATE INDEX "ConnectionCache_expiresAt_idx" ON "ConnectionCache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectionCache_flightIdent_analysisDate_key" ON "ConnectionCache"("flightIdent", "analysisDate");

-- CreateIndex
CREATE INDEX "AlertEvent_userId_detectedAt_idx" ON "AlertEvent"("userId", "detectedAt");

-- CreateIndex
CREATE INDEX "AlertEvent_sourceType_sourceId_eventType_detectedAt_idx" ON "AlertEvent"("sourceType", "sourceId", "eventType", "detectedAt");

-- CreateIndex
CREATE INDEX "AlertEvent_state_detectedAt_idx" ON "AlertEvent"("state", "detectedAt");

-- CreateIndex
CREATE INDEX "AlertEvent_fingerprintKey_detectedAt_idx" ON "AlertEvent"("fingerprintKey", "detectedAt");

-- CreateIndex
CREATE INDEX "AlertNotificationDelivery_alertEventId_idx" ON "AlertNotificationDelivery"("alertEventId");

-- CreateIndex
CREATE INDEX "AlertNotificationDelivery_status_nextRetryAt_idx" ON "AlertNotificationDelivery"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "AlertNotificationDelivery_channel_status_idx" ON "AlertNotificationDelivery"("channel", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TripSnapshot_tripId_key" ON "TripSnapshot"("tripId");

-- CreateIndex
CREATE INDEX "NotificationDelivery_tripId_idx" ON "NotificationDelivery"("tripId");

-- CreateIndex
CREATE INDEX "NotificationDelivery_status_processingLeaseExpiresAt_idx" ON "NotificationDelivery"("status", "processingLeaseExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDelivery_eventId_channel_key" ON "NotificationDelivery"("eventId", "channel");

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
CREATE UNIQUE INDEX "DisruptionPlaybook_monitoredTripId_key" ON "DisruptionPlaybook"("monitoredTripId");

-- CreateIndex
CREATE INDEX "DisruptionPlaybook_monitoredTripId_idx" ON "DisruptionPlaybook"("monitoredTripId");

-- CreateIndex
CREATE INDEX "DisruptionPlaybook_airlineIata_idx" ON "DisruptionPlaybook"("airlineIata");

-- CreateIndex
CREATE UNIQUE INDEX "leads_email_key" ON "leads"("email");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceSnapshot" ADD CONSTRAINT "PriceSnapshot_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertLog" ADD CONSTRAINT "AlertLog_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Airport" ADD CONSTRAINT "Airport_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchedFlight" ADD CONSTRAINT "WatchedFlight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Monitor" ADD CONSTRAINT "Monitor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompensationClaim" ADD CONSTRAINT "CompensationClaim_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompensationClaim" ADD CONSTRAINT "CompensationClaim_flightLegId_fkey" FOREIGN KEY ("flightLegId") REFERENCES "FlightLeg"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitoredTrip" ADD CONSTRAINT "MonitoredTrip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Passenger" ADD CONSTRAINT "Passenger_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "MonitoredTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightSegment" ADD CONSTRAINT "FlightSegment_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "MonitoredTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightLeg" ADD CONSTRAINT "FlightLeg_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "MonitoredTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianAlert" ADD CONSTRAINT "GuardianAlert_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "MonitoredTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_watchedFlightId_fkey" FOREIGN KEY ("watchedFlightId") REFERENCES "WatchedFlight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "MonitoredTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertNotificationDelivery" ADD CONSTRAINT "AlertNotificationDelivery_alertEventId_fkey" FOREIGN KEY ("alertEventId") REFERENCES "AlertEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripSnapshot" ADD CONSTRAINT "TripSnapshot_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "MonitoredTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "MonitoredTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentAssignment" ADD CONSTRAINT "ExperimentAssignment_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentAssignment" ADD CONSTRAINT "ExperimentAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisruptionPlaybook" ADD CONSTRAINT "DisruptionPlaybook_monitoredTripId_fkey" FOREIGN KEY ("monitoredTripId") REFERENCES "MonitoredTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

/**
 * OPERATOR HEALTH & DIAGNOSTICS
 * 
 * Internal metrics for monitoring system health.
 * NOT exposed to end users. NOT included in user-facing responses.
 */

/**
 * Parser Health Metrics
 * Tracks input conversion success, warnings, error rates
 */
export interface ParserHealth {
  // Success/failure rates
  totalParsed: number;
  successCount: number;
  partialParseCount: number;
  hardErrorCount: number;

  // Mode breakdown
  quickModeCount: number;
  detailedModeCount: number;
  pasteModeCount: number;

  // Common warnings tracked
  commonWarnings: Map<string, number>;
  
  // Completeness distribution
  avgCompletenessScore: number;
  avgRealismScore: number;
  avgBaggageConfidenceScore: number;

  // Risk flag frequency
  riskFlagFrequency: Map<string, number>;

  // Segment/parse issues
  segmentParsingErrors: number;
  timeExtractionErrors: number;
  priceExtractionErrors: number;

  // Timestamps
  measuredAt: Date;
  periodLabel: string; // "last_hour", "last_24h", "last_7d"
}

/**
 * Scoring Health Metrics
 * Tracks confidence penalties, recommendation overrides, self-check corrections
 */
export interface ScoringHealth {
  // Total flights scored
  totalScored: number;

  // Confidence penalty tracking
  penaltyAppliedCount: number;
  avgPenaltyAmount: number;
  confidencePenaltyDistribution: {
    light: number;     // 6-10 points
    moderate: number;  // 11-15 points
    heavy: number;     // 16-25 points
  };

  // Recommendation override tracking
  overridesApplied: number;
  overrideReasons: Map<string, number>;
  
  // Self-check corrections
  selfCheckAdjustments: number;
  avgConfidenceAdjustment: number;

  // Confidence distribution
  lowConfidenceCount: number;      // < 50
  mediumConfidenceCount: number;   // 50-75
  highConfidenceCount: number;     // 75+

  // Decision recommendation distribution
  decisionBuyCount: number;
  decisionWaitCount: number;
  decisionAvoidCount: number;

  // Scores by source
  sourceScore: {
    internal: number;
    ota: number;
    gds: number;
  };

  // Timestamps
  measuredAt: Date;
  periodLabel: string;
}

/**
 * Route Data Health Metrics
 * Tracks data source types and real-time data availability
 */
export interface RouteHealth {
  // Total routes tracked
  totalRoutesTracked: number;
  totalSnapshots: number;

  // Data source distribution (CRITICAL metric)
  dataSourceDistribution: {
    realProvider: number;        // REAL_PROVIDER (90% confidence)
    historicalBaseline: number;  // HISTORICAL_BASELINE (75% confidence)
    internalEstimate: number;    // INTERNAL_ESTIMATE (65% confidence)
  };

  // Snapshot timeliness
  realtimeSnapshots: number;      // < 1 hour old
  freshSnapshots: number;         // 1-6 hours old
  staleSnapshots: number;         // > 6 hours old

  // Real-time data availability
  routesWithRealtimeData: number;
  routesWithoutRealtimeData: number;

  // Volatility metrics
  highVolatilityRoutes: number;   // volatility > 50
  lowVolatilityRoutes: number;    // volatility < 20

  // Price anchor availability
  priceAnchorAvailable: number;
  priceAnchorMissing: number;

  // Timestamps
  measuredAt: Date;
  periodLabel: string;
}

/**
 * Guardian Health Metrics
 * Tracks monitoring coverage, event detection, notification reliability
 */
export interface GuardianHealth {
  // Trip monitoring
  tripsUnderMonitoring: number;
  tripsCheckedInPeriod: number;
  checksPerformed: number;

  // Event detection
  eventsEmitted: number;
  eventsByType: Map<string, number>;
  eventsBySeverity: Map<string, number>;

  // Real-time data quality
  statusLookupsAttempted: number;
  statusLookupsSucceeded: number;
  statusLookupsFailed: number;

  // Stale snapshot issues
  staleSnapshotCount: number;      // Last snapshot > 6 hours old
  missingSeatMapData: number;
  missingScheduleData: number;

  // Notification delivery
  notificationAttempts: number;
  notificationSucceeded: number;
  notificationFailed: number;
  notificationChannels: Map<string, { attempted: number; succeeded: number }>;

  // Throttling & batching
  eventsThrottled: number;
  eventsBatched: number;

  // Disruption detection
  disruptionsDetected: number;
  scheduleChangesDetected: number;
  upgradesDetected: number;
  amenityAlertsDetected: number;

  // Timestamps
  measuredAt: Date;
  periodLabel: string;
}

/**
 * System-wide Health Summary
 * Aggregate view for operators
 */
export interface SystemHealthSummary {
  timestamp: Date;
  periodLabel: string; // "last_hour", "last_24h", "last_7d"

  // Overall health status
  overallStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  degradationReasons: string[];

  // Subsystem health
  parser: ParserHealth;
  scoring: ScoringHealth;
  routeData: RouteHealth;
  guardian: GuardianHealth;

  // Key health indicators (for quick assessment)
  indicators: {
    parserSuccessRate: number;       // %
    scoringPenaltyRate: number;      // % of scores penalized
    lowConfidenceRate: number;       // % of scores < 50
    realtimeDataAvailability: number; // %
    guardianNotificationSuccessRate: number; // %
    staleSnapshotPercentage: number; // % of snapshots > 6h old
  };

  // Alerts for operators
  alerts: HealthAlert[];
}

/**
 * Single health alert for operators
 * Surfaces degradation or anomalies
 */
export interface HealthAlert {
  id: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  subsystem: 'PARSER' | 'SCORING' | 'ROUTE_DATA' | 'GUARDIAN';
  title: string;
  description: string;
  context: Record<string, any>;
  detectedAt: Date;
  suggestedAction?: string;
}

/**
 * Raw metrics bucket
 * Stores raw counters for aggregation
 */
export interface MetricsBucket {
  timestamp: Date;
  parser: Partial<ParserHealth>;
  scoring: Partial<ScoringHealth>;
  routeData: Partial<RouteHealth>;
  guardian: Partial<GuardianHealth>;
}

/**
 * Parser event (emitted during parsing)
 */
export interface ParserMetricEvent {
  mode: 'quick' | 'detailed' | 'paste';
  success: boolean;
  completenessScore?: number;
  realismScore?: number;
  baggageConfidence?: number;
  warnings?: string[];
  errorMessage?: string;
  timestamp: Date;
}

/**
 * Scoring event (emitted after scoring)
 */
export interface ScoringMetricEvent {
  totalScored: number;
  penaltyApplied: boolean;
  penaltyAmount?: number;
  overrideApplied: boolean;
  overrideReason?: string;
  finalConfidence: number;
  recommendation: 'BUY' | 'WAIT' | 'AVOID' | 'MONITOR';
  dataSource: string;
  timestamp: Date;
}

/**
 * Route event (emitted when snapshot collected)
 */
export interface RouteMetricEvent {
  routeId: string;
  snapshotType: 'REAL_PROVIDER' | 'HISTORICAL_BASELINE' | 'INTERNAL_ESTIMATE';
  volatility?: number;
  hasRealtimeData: boolean;
  snapshotAgeMinutes: number;
  timestamp: Date;
}

/**
 * Guardian event (emitted during monitoring)
 */
export interface GuardianMetricEvent {
  tripId: string;
  eventType?: string;
  eventSeverity?: string;
  statusLookupSucceeded?: boolean;
  notificationAttempted: boolean;
  notificationSucceeded?: boolean;
  channel?: string;
  timestamp: Date;
}

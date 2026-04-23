/**
 * HEALTH METRICS COLLECTION & AGGREGATION
 * 
 * Lightweight in-memory metrics store.
 * Tracks system health without persistence overhead.
 */

import {
  ParserHealth,
  ScoringHealth,
  RouteHealth,
  GuardianHealth,
  SystemHealthSummary,
  HealthAlert,
  ParserMetricEvent,
  ScoringMetricEvent,
  RouteMetricEvent,
  GuardianMetricEvent,
} from '@/types/operatorHealth';

/**
 * In-memory metrics store
 * Holds rolling windows of metrics
 */
class HealthMetricsCollector {
  private parserEvents: ParserMetricEvent[] = [];
  private scoringEvents: ScoringMetricEvent[] = [];
  private routeEvents: RouteMetricEvent[] = [];
  private guardianEvents: GuardianMetricEvent[] = [];

  // Keep events for last 24 hours
  private readonly RETENTION_MS = 24 * 60 * 60 * 1000;

  /**
   * Record parser event
   */
  recordParserEvent(event: ParserMetricEvent): void {
    this.parserEvents.push(event);
    this.pruneEvents();
  }

  /**
   * Record scoring event
   */
  recordScoringEvent(event: ScoringMetricEvent): void {
    this.scoringEvents.push(event);
    this.pruneEvents();
  }

  /**
   * Record route event
   */
  recordRouteEvent(event: RouteMetricEvent): void {
    this.routeEvents.push(event);
    this.pruneEvents();
  }

  /**
   * Record Guardian event
   */
  recordGuardianEvent(event: GuardianMetricEvent): void {
    this.guardianEvents.push(event);
    this.pruneEvents();
  }

  /**
   * Clean up old events outside retention window
   */
  private pruneEvents(): void {
    const cutoff = Date.now() - this.RETENTION_MS;
    this.parserEvents = this.parserEvents.filter((e) => e.timestamp.getTime() > cutoff);
    this.scoringEvents = this.scoringEvents.filter((e) => e.timestamp.getTime() > cutoff);
    this.routeEvents = this.routeEvents.filter((e) => e.timestamp.getTime() > cutoff);
    this.guardianEvents = this.guardianEvents.filter((e) => e.timestamp.getTime() > cutoff);
  }

  /**
   * Generate health summary for given time window
   * periodMs = milliseconds (defaults to 1 hour)
   */
  getHealthSummary(periodMs: number = 60 * 60 * 1000): SystemHealthSummary {
    const cutoff = Date.now() - periodMs;
    const periodLabel = this.getPeriodLabel(periodMs);

    // Filter events in window
    const parserInWindow = this.parserEvents.filter((e) => e.timestamp.getTime() > cutoff);
    const scoringInWindow = this.scoringEvents.filter((e) => e.timestamp.getTime() > cutoff);
    const routeInWindow = this.routeEvents.filter((e) => e.timestamp.getTime() > cutoff);
    const guardianInWindow = this.guardianEvents.filter((e) => e.timestamp.getTime() > cutoff);

    // Build subsystem health metrics
    const parser = this.buildParserHealth(parserInWindow, periodLabel);
    const scoring = this.buildScoringHealth(scoringInWindow, periodLabel);
    const routeData = this.buildRouteHealth(routeInWindow, periodLabel);
    const guardian = this.buildGuardianHealth(guardianInWindow, periodLabel);

    // Compute health indicators
    const indicators = {
      parserSuccessRate: this.computeParserSuccessRate(parser),
      scoringPenaltyRate: this.computeScoringPenaltyRate(scoring),
      lowConfidenceRate: this.computeLowConfidenceRate(scoring),
      realtimeDataAvailability: this.computeRealtimeDataAvailability(routeData),
      guardianNotificationSuccessRate: this.computeNotificationSuccessRate(guardian),
      staleSnapshotPercentage: this.computeStaleSnapshotPercentage(routeData),
    };

    // Determine overall status and generate alerts
    const { status, degradationReasons } = this.computeOverallHealth(indicators);
    const alerts = this.generateAlerts(parser, scoring, routeData, guardian, indicators);

    return {
      timestamp: new Date(),
      periodLabel,
      overallStatus: status,
      degradationReasons,
      parser,
      scoring,
      routeData,
      guardian,
      indicators,
      alerts,
    };
  }

  /**
   * Build parser health metrics
   */
  private buildParserHealth(events: ParserMetricEvent[], periodLabel: string): ParserHealth {
    const successCount = events.filter((e) => e.success).length;
    const partialParseCount = events.filter((e) => e.success && e.warnings && e.warnings.length > 0).length;
    const hardErrorCount = events.filter((e) => !e.success).length;

    const quickModeCount = events.filter((e) => e.mode === 'quick').length;
    const detailedModeCount = events.filter((e) => e.mode === 'detailed').length;
    const pasteModeCount = events.filter((e) => e.mode === 'paste').length;

    const commonWarnings = new Map<string, number>();
    events.forEach((e) => {
      e.warnings?.forEach((w) => {
        commonWarnings.set(w, (commonWarnings.get(w) || 0) + 1);
      });
    });

    const riskFlagFrequency = new Map<string, number>();
    events.forEach((e) => {
      // Risk flags would be tracked if available in parser
    });

    const completenessScores = events.map((e) => e.completenessScore || 0).filter((v) => v > 0);
    const avgCompletenessScore = completenessScores.length > 0 ? completenessScores.reduce((a, b) => a + b, 0) / completenessScores.length : 0;

    const realismScores = events.map((e) => e.realismScore || 0).filter((v) => v > 0);
    const avgRealismScore = realismScores.length > 0 ? realismScores.reduce((a, b) => a + b, 0) / realismScores.length : 0;

    const baggageScores = events.map((e) => e.baggageConfidence || 0).filter((v) => v > 0);
    const avgBaggageConfidenceScore = baggageScores.length > 0 ? baggageScores.reduce((a, b) => a + b, 0) / baggageScores.length : 0;

    const segmentParsingErrors = events.filter((e) => e.errorMessage?.includes('segment')).length;
    const timeExtractionErrors = events.filter((e) => e.errorMessage?.includes('time')).length;
    const priceExtractionErrors = events.filter((e) => e.errorMessage?.includes('price')).length;

    return {
      totalParsed: events.length,
      successCount,
      partialParseCount,
      hardErrorCount,
      quickModeCount,
      detailedModeCount,
      pasteModeCount,
      commonWarnings,
      avgCompletenessScore,
      avgRealismScore,
      avgBaggageConfidenceScore,
      riskFlagFrequency,
      segmentParsingErrors,
      timeExtractionErrors,
      priceExtractionErrors,
      measuredAt: new Date(),
      periodLabel,
    };
  }

  /**
   * Build scoring health metrics
   */
  private buildScoringHealth(events: ScoringMetricEvent[], periodLabel: string): ScoringHealth {
    const totalScored = events.length;
    const penaltyAppliedCount = events.filter((e) => e.penaltyApplied).length;
    const penaltyAmounts = events.filter((e) => e.penaltyApplied && e.penaltyAmount).map((e) => e.penaltyAmount!);
    const avgPenaltyAmount = penaltyAmounts.length > 0 ? penaltyAmounts.reduce((a, b) => a + b, 0) / penaltyAmounts.length : 0;

    // Penalty distribution
    const confidencePenaltyDistribution = {
      light: penaltyAmounts.filter((p) => p >= 6 && p <= 10).length,
      moderate: penaltyAmounts.filter((p) => p >= 11 && p <= 15).length,
      heavy: penaltyAmounts.filter((p) => p >= 16 && p <= 25).length,
    };

    const overridesApplied = events.filter((e) => e.overrideApplied).length;
    const overrideReasons = new Map<string, number>();
    events.forEach((e) => {
      if (e.overrideReason) {
        overrideReasons.set(e.overrideReason, (overrideReasons.get(e.overrideReason) || 0) + 1);
      }
    });

    const confidenceScores = events.map((e) => e.finalConfidence);
    const lowConfidenceCount = confidenceScores.filter((c) => c < 50).length;
    const mediumConfidenceCount = confidenceScores.filter((c) => c >= 50 && c <= 75).length;
    const highConfidenceCount = confidenceScores.filter((c) => c > 75).length;

    const decisionBuyCount = events.filter((e) => e.recommendation === 'BUY').length;
    const decisionWaitCount = events.filter((e) => e.recommendation === 'WAIT').length;
    const decisionAvoidCount = events.filter((e) => e.recommendation === 'AVOID').length;

    // Source score tracking
    const sourceScore = {
      internal: events.filter((e) => e.dataSource?.includes('internal')).length,
      ota: events.filter((e) => e.dataSource?.includes('ota')).length,
      gds: events.filter((e) => e.dataSource?.includes('gds')).length,
    };

    return {
      totalScored,
      penaltyAppliedCount,
      avgPenaltyAmount,
      confidencePenaltyDistribution,
      overridesApplied,
      overrideReasons,
      selfCheckAdjustments: overridesApplied,
      avgConfidenceAdjustment: avgPenaltyAmount,
      lowConfidenceCount,
      mediumConfidenceCount,
      highConfidenceCount,
      decisionBuyCount,
      decisionWaitCount,
      decisionAvoidCount,
      sourceScore,
      measuredAt: new Date(),
      periodLabel,
    };
  }

  /**
   * Build route health metrics
   */
  private buildRouteHealth(events: RouteMetricEvent[], periodLabel: string): RouteHealth {
    const uniqueRoutes = new Set(events.map((e) => e.routeId));
    const totalRoutesTracked = uniqueRoutes.size;
    const totalSnapshots = events.length;

    const dataSourceDistribution = {
      realProvider: events.filter((e) => e.snapshotType === 'REAL_PROVIDER').length,
      historicalBaseline: events.filter((e) => e.snapshotType === 'HISTORICAL_BASELINE').length,
      internalEstimate: events.filter((e) => e.snapshotType === 'INTERNAL_ESTIMATE').length,
    };

    const realtimeSnapshots = events.filter((e) => e.snapshotAgeMinutes < 60).length;
    const freshSnapshots = events.filter((e) => e.snapshotAgeMinutes >= 60 && e.snapshotAgeMinutes < 360).length;
    const staleSnapshots = events.filter((e) => e.snapshotAgeMinutes >= 360).length;

    const routesWithRealtimeData = events.filter((e) => e.hasRealtimeData).length;
    const routesWithoutRealtimeData = events.filter((e) => !e.hasRealtimeData).length;

    const highVolatilityRoutes = events.filter((e) => e.volatility !== undefined && e.volatility > 50).length;
    const lowVolatilityRoutes = events.filter((e) => e.volatility !== undefined && e.volatility < 20).length;

    return {
      totalRoutesTracked,
      totalSnapshots,
      dataSourceDistribution,
      realtimeSnapshots,
      freshSnapshots,
      staleSnapshots,
      routesWithRealtimeData,
      routesWithoutRealtimeData,
      highVolatilityRoutes,
      lowVolatilityRoutes,
      priceAnchorAvailable: events.filter((e) => e.snapshotType === 'REAL_PROVIDER').length,
      priceAnchorMissing: events.filter((e) => e.snapshotType === 'INTERNAL_ESTIMATE').length,
      measuredAt: new Date(),
      periodLabel,
    };
  }

  /**
   * Build Guardian health metrics
   */
  private buildGuardianHealth(events: GuardianMetricEvent[], periodLabel: string): GuardianHealth {
    const uniqueTrips = new Set(events.map((e) => e.tripId));
    const tripsUnderMonitoring = uniqueTrips.size;
    const checksPerformed = events.length;
    const tripsCheckedInPeriod = uniqueTrips.size;

    const eventsByType = new Map<string, number>();
    const eventsBySeverity = new Map<string, number>();
    const eventCount = events.filter((e) => e.eventType).length;

    events.forEach((e) => {
      if (e.eventType) {
        eventsByType.set(e.eventType, (eventsByType.get(e.eventType) || 0) + 1);
      }
      if (e.eventSeverity) {
        eventsBySeverity.set(e.eventSeverity, (eventsBySeverity.get(e.eventSeverity) || 0) + 1);
      }
    });

    const statusLookupsAttempted = events.filter((e) => e.statusLookupSucceeded !== undefined).length;
    const statusLookupsSucceeded = events.filter((e) => e.statusLookupSucceeded === true).length;
    const statusLookupsFailed = events.filter((e) => e.statusLookupSucceeded === false).length;

    const notificationAttempts = events.filter((e) => e.notificationAttempted).length;
    const notificationSucceeded = events.filter((e) => e.notificationAttempted && e.notificationSucceeded === true).length;
    const notificationFailed = events.filter((e) => e.notificationAttempted && e.notificationSucceeded === false).length;

    const notificationChannels = new Map<string, { attempted: number; succeeded: number }>();
    events.forEach((e) => {
      if (e.channel) {
        const existing = notificationChannels.get(e.channel) || { attempted: 0, succeeded: 0 };
        if (e.notificationAttempted) existing.attempted += 1;
        if (e.notificationSucceeded) existing.succeeded += 1;
        notificationChannels.set(e.channel, existing);
      }
    });

    return {
      tripsUnderMonitoring,
      tripsCheckedInPeriod,
      checksPerformed,
      eventsEmitted: eventCount,
      eventsByType,
      eventsBySeverity,
      statusLookupsAttempted,
      statusLookupsSucceeded,
      statusLookupsFailed,
      staleSnapshotCount: 0, // Would need to check snapshot ages
      missingSeatMapData: eventsByType.get('UPGRADE') || 0,
      missingScheduleData: eventsByType.get('SCHEDULE_CHANGE') || 0,
      notificationAttempts,
      notificationSucceeded,
      notificationFailed,
      notificationChannels,
      eventsThrottled: 0,
      eventsBatched: 0,
      disruptionsDetected: eventsByType.get('DISRUPTION') || 0,
      scheduleChangesDetected: eventsByType.get('SCHEDULE_CHANGE') || 0,
      upgradesDetected: eventsByType.get('UPGRADE') || 0,
      amenityAlertsDetected: eventsByType.get('AMENITY') || 0,
      measuredAt: new Date(),
      periodLabel,
    };
  }

  /**
   * Compute health indicators from subsystem metrics
   */
  private computeParserSuccessRate(parser: ParserHealth): number {
    if (parser.totalParsed === 0) return 100;
    return Math.round((parser.successCount / parser.totalParsed) * 100);
  }

  private computeScoringPenaltyRate(scoring: ScoringHealth): number {
    if (scoring.totalScored === 0) return 0;
    return Math.round((scoring.penaltyAppliedCount / scoring.totalScored) * 100);
  }

  private computeLowConfidenceRate(scoring: ScoringHealth): number {
    if (scoring.totalScored === 0) return 0;
    return Math.round((scoring.lowConfidenceCount / scoring.totalScored) * 100);
  }

  private computeRealtimeDataAvailability(routeData: RouteHealth): number {
    if (routeData.totalSnapshots === 0) return 100;
    const realProvider = routeData.dataSourceDistribution.realProvider;
    const recentRealtime = routeData.realtimeSnapshots;
    return Math.round(((realProvider + recentRealtime) / routeData.totalSnapshots) * 100);
  }

  private computeNotificationSuccessRate(guardian: GuardianHealth): number {
    if (guardian.notificationAttempts === 0) return 100;
    return Math.round((guardian.notificationSucceeded / guardian.notificationAttempts) * 100);
  }

  private computeStaleSnapshotPercentage(routeData: RouteHealth): number {
    if (routeData.totalSnapshots === 0) return 0;
    return Math.round((routeData.staleSnapshots / routeData.totalSnapshots) * 100);
  }

  /**
   * Compute overall health status and degradation reasons
   */
  private computeOverallHealth(
    indicators: SystemHealthSummary['indicators']
  ): { status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL'; degradationReasons: string[] } {
    const reasons: string[] = [];

    if (indicators.parserSuccessRate < 95) reasons.push('Parser success rate below 95%');
    if (indicators.scoringPenaltyRate > 40) reasons.push('High rate of confidence penalties (>40%)');
    if (indicators.lowConfidenceRate > 30) reasons.push('High rate of low-confidence scores (>30%)');
    if (indicators.realtimeDataAvailability < 60) reasons.push('Low real-time data availability (<60%)');
    if (indicators.guardianNotificationSuccessRate < 90) reasons.push('Guardian notification failures (>10%)');
    if (indicators.staleSnapshotPercentage > 50) reasons.push('High rate of stale snapshots (>50%)');

    let status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' = 'HEALTHY';
    if (reasons.length >= 3) {
      status = 'CRITICAL';
    } else if (reasons.length >= 1) {
      status = 'DEGRADED';
    }

    return { status, degradationReasons: reasons };
  }

  /**
   * Generate health alerts for operators
   */
  private generateAlerts(
    parser: ParserHealth,
    scoring: ScoringHealth,
    routeData: RouteHealth,
    guardian: GuardianHealth,
    indicators: SystemHealthSummary['indicators']
  ): HealthAlert[] {
    const alerts: HealthAlert[] = [];
    const baseTime = new Date();

    // Parser alerts
    if (parser.hardErrorCount > 5) {
      alerts.push({
        id: `parser_errors_${Date.now()}`,
        severity: 'WARNING',
        subsystem: 'PARSER',
        title: 'High parser error rate',
        description: `${parser.hardErrorCount} hard parsing errors detected in this period`,
        context: { errorCount: parser.hardErrorCount, totalParsed: parser.totalParsed },
        detectedAt: baseTime,
        suggestedAction: 'Check for malformed input patterns or parser regression',
      });
    }

    if (parser.avgCompletenessScore < 0.6) {
      alerts.push({
        id: `parser_completeness_${Date.now()}`,
        severity: 'INFO',
        subsystem: 'PARSER',
        title: 'Low input completeness',
        description: `Average completeness score is ${(parser.avgCompletenessScore * 100).toFixed(0)}%`,
        context: { avgCompleteness: parser.avgCompletenessScore },
        detectedAt: baseTime,
        suggestedAction: 'Users may be providing minimal input; consider UI prompts for more detail',
      });
    }

    // Scoring alerts
    if (scoring.lowConfidenceCount > scoring.totalScored * 0.3) {
      alerts.push({
        id: `scoring_confidence_${Date.now()}`,
        severity: 'WARNING',
        subsystem: 'SCORING',
        title: 'High rate of low-confidence scores',
        description: `${scoring.lowConfidenceCount} scores below 50 confidence`,
        context: { lowConfidenceCount: scoring.lowConfidenceCount, totalScored: scoring.totalScored },
        detectedAt: baseTime,
        suggestedAction: 'Check data sources for quality issues',
      });
    }

    if (scoring.avgPenaltyAmount > 15) {
      alerts.push({
        id: `scoring_penalties_${Date.now()}`,
        severity: 'INFO',
        subsystem: 'SCORING',
        title: 'High average confidence penalties',
        description: `Average penalty of ${scoring.avgPenaltyAmount.toFixed(1)} points applied per score`,
        context: { avgPenalty: scoring.avgPenaltyAmount, totalPenalties: scoring.penaltyAppliedCount },
        detectedAt: baseTime,
        suggestedAction: 'System is heavily penalizing low-completeness inputs; expected behavior',
      });
    }

    // Route data alerts
    if (routeData.dataSourceDistribution.internalEstimate > routeData.totalSnapshots * 0.5) {
      alerts.push({
        id: `routes_estimates_${Date.now()}`,
        severity: 'WARNING',
        subsystem: 'ROUTE_DATA',
        title: 'Heavy reliance on internal estimates',
        description: `${routeData.dataSourceDistribution.internalEstimate} of ${routeData.totalSnapshots} snapshots are internal estimates`,
        context: { dataSourceDistribution: routeData.dataSourceDistribution },
        detectedAt: baseTime,
        suggestedAction: 'Consider improving data sources or API integrations',
      });
    }

    if (routeData.staleSnapshots > routeData.totalSnapshots * 0.4) {
      alerts.push({
        id: `routes_stale_${Date.now()}`,
        severity: 'WARNING',
        subsystem: 'ROUTE_DATA',
        title: 'High rate of stale route data',
        description: `${routeData.staleSnapshots} of ${routeData.totalSnapshots} snapshots are older than 6 hours`,
        context: { staleSnapshots: routeData.staleSnapshots, totalSnapshots: routeData.totalSnapshots },
        detectedAt: baseTime,
        suggestedAction: 'Increase snapshot collection frequency or check data source latency',
      });
    }

    // Guardian alerts
    if (guardian.statusLookupsFailed > guardian.statusLookupsAttempted * 0.1) {
      alerts.push({
        id: `guardian_lookups_${Date.now()}`,
        severity: 'WARNING',
        subsystem: 'GUARDIAN',
        title: 'High rate of failed Guardian status lookups',
        description: `${guardian.statusLookupsFailed} of ${guardian.statusLookupsAttempted} status lookups failed`,
        context: { failed: guardian.statusLookupsFailed, attempted: guardian.statusLookupsAttempted },
        detectedAt: baseTime,
        suggestedAction: 'Check third-party flight status API health',
      });
    }

    if (guardian.notificationFailed > guardian.notificationAttempts * 0.1) {
      alerts.push({
        id: `guardian_notifications_${Date.now()}`,
        severity: 'CRITICAL',
        subsystem: 'GUARDIAN',
        title: 'Guardian notification delivery failures',
        description: `${guardian.notificationFailed} of ${guardian.notificationAttempts} notifications failed to deliver`,
        context: { failed: guardian.notificationFailed, attempted: guardian.notificationAttempts },
        detectedAt: baseTime,
        suggestedAction: 'Check email provider, SMS gateway, and push notification service health',
      });
    }

    return alerts;
  }

  /**
   * Helper to format period label
   */
  private getPeriodLabel(periodMs: number): string {
    if (periodMs < 2 * 60 * 60 * 1000) return 'last_hour';
    if (periodMs < 48 * 60 * 60 * 1000) return 'last_24h';
    return 'last_7d';
  }
}

/**
 * Global singleton instance
 */
let collectorInstance: HealthMetricsCollector | null = null;

/**
 * Get or create the global metrics collector
 */
export function getHealthMetricsCollector(): HealthMetricsCollector {
  if (!collectorInstance) {
    collectorInstance = new HealthMetricsCollector();
  }
  return collectorInstance;
}

/**
 * Convenience functions for recording events
 */
export function recordParserMetric(event: ParserMetricEvent): void {
  getHealthMetricsCollector().recordParserEvent(event);
}

export function recordScoringMetric(event: ScoringMetricEvent): void {
  getHealthMetricsCollector().recordScoringEvent(event);
}

export function recordRouteMetric(event: RouteMetricEvent): void {
  getHealthMetricsCollector().recordRouteEvent(event);
}

export function recordGuardianMetric(event: GuardianMetricEvent): void {
  getHealthMetricsCollector().recordGuardianEvent(event);
}

/**
 * Get health summary for last hour, last 24h, or last 7d
 */
export function getHealthSummaryLastHour(): SystemHealthSummary {
  return getHealthMetricsCollector().getHealthSummary(60 * 60 * 1000);
}

export function getHealthSummaryLast24Hours(): SystemHealthSummary {
  return getHealthMetricsCollector().getHealthSummary(24 * 60 * 60 * 1000);
}

export function getHealthSummaryLast7Days(): SystemHealthSummary {
  return getHealthMetricsCollector().getHealthSummary(7 * 24 * 60 * 60 * 1000);
}

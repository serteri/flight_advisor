import type { CabinClass } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { analyzeRoute } from '@/lib/anomalyDetector';
import { recordRouteMetric } from '@/services/healthMetrics';
import type { RouteMetricEvent } from '@/types/operatorHealth';

export type RouteTimingSignal = 'BUY' | 'WAIT' | 'WATCH';
export type RouteTrendStatus = 'RISING' | 'FALLING' | 'STABLE' | 'INSUFFICIENT_DATA';
export type RouteThresholdState = 'NO_TARGET' | 'AT_OR_BELOW_TARGET' | 'ABOVE_TARGET';
export type RouteDataSourceType = 'INTERNAL_ESTIMATE' | 'HISTORICAL_BASELINE' | 'REAL_PROVIDER';

export type RouteRecommendationExplanation = {
    primaryReason: string;
    supportingReasons: string[];
    missingDataWarnings: string[];
    actionHint: string;
    positiveFactors: string[];
    negativeFactors: string[];
    missingFactors: string[];
};

export type TrackRouteInput = {
    origin: string;
    destination: string;
    departureDate: string;
    returnDate?: string;
    maxStops?: number;
    targetPrice?: number;
    cabin?: string;
    baggageRequired?: boolean;
    preferredAirlines?: string[];
    tripType?: 'ONE_WAY' | 'ROUND_TRIP';
};

export type RouteWatchDetails = {
    routeId: string;
    route: {
        origin: string;
        destination: string;
        departureDate: string;
        returnDate: string | null;
        tripType: string;
        cabin: string;
        maxStops: number | null;
        targetPrice: number | null;
        baggageRequired: boolean | null;
        preferredAirlines: string[];
    };
    latestSnapshot: {
        amount: number;
        previousAmount: number | null;
        changePercentVsPrevious: number | null;
        currency: string;
        provider: string;
        dataSourceType: RouteDataSourceType;
        observedAt: string;
        trendDirection: RouteTrendStatus;
        thresholdState: RouteThresholdState;
        recommendationState: RouteTimingSignal;
    } | null;
    trendSummary: {
        status: RouteTrendStatus;
        changePercentVsPrevious: number | null;
        recentPriceMovement: 'UP' | 'DOWN' | 'FLAT' | 'UNKNOWN';
        averagePrice: number | null;
        volatilityPercent: number | null;
    };
    timingSignal: {
        signal: RouteTimingSignal;
        label: string;
        reason: string;
        confidence: number;
        dataSourceType: RouteDataSourceType;
        explanation: RouteRecommendationExplanation;
    };
    alerts: Array<{
        type: 'TARGET_REACHED' | 'PRICE_SPIKE' | 'BOOKING_WINDOW';
        message: string;
        createdAt: string;
    }>;
};

const toCabinClass = (value?: string): CabinClass => {
    const normalized = (value || 'ECONOMY').toUpperCase();
    if (normalized === 'PREMIUM' || normalized === 'PREMIUM_ECONOMY') return 'PREMIUM_ECONOMY';
    if (normalized === 'BUSINESS') return 'BUSINESS';
    if (normalized === 'FIRST') return 'FIRST';
    return 'ECONOMY';
};

const trendFromChange = (changePercent: number | null): RouteTrendStatus => {
    if (changePercent === null) return 'INSUFFICIENT_DATA';
    if (changePercent >= 5) return 'RISING';
    if (changePercent <= -5) return 'FALLING';
    return 'STABLE';
};

const daysUntil = (isoDate: Date): number => {
    const now = Date.now();
    const target = isoDate.getTime();
    return Math.max(0, Math.ceil((target - now) / (1000 * 60 * 60 * 24)));
};

const round = (value: number): number => Math.round(value * 100) / 100;

const hashRouteSeed = (routeId: string): number => {
    return routeId.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
};

const deterministicAdjustmentPercent = (routeId: string, observedAt: Date): number => {
    const dayBucket = Math.floor(observedAt.getTime() / (1000 * 60 * 60 * 24));
    const seed = hashRouteSeed(routeId) + dayBucket;
    const centered = (seed % 11) - 5; // -5..+5
    return centered * 0.35; // ~ -1.75% .. +1.75%
};

const computeThresholdState = (targetPrice: number | null, latestAmount: number | null): RouteThresholdState => {
    if (!targetPrice || !latestAmount) return 'NO_TARGET';
    return latestAmount <= targetPrice ? 'AT_OR_BELOW_TARGET' : 'ABOVE_TARGET';
};

const buildRouteTimingLabel = (signal: RouteTimingSignal, dataSourceType: RouteDataSourceType): string => {
    if (dataSourceType === 'REAL_PROVIDER') return signal;
    if (signal === 'BUY') return 'BUY (based on estimated price signals)';
    if (signal === 'WAIT') return 'WAIT (trend estimated from internal data)';
    return 'WATCH (insufficient real-time data)';
};

const confidenceCapByDataSource = (dataSourceType: RouteDataSourceType): number => {
    if (dataSourceType === 'INTERNAL_ESTIMATE') return 65;
    if (dataSourceType === 'HISTORICAL_BASELINE') return 75;
    return 90;
};

const inferRouteDataSourceType = (candidateSources: string[]): RouteDataSourceType => {
    if (candidateSources.some((source) => source.includes('REAL_PROVIDER'))) {
        return 'REAL_PROVIDER';
    }
    if (candidateSources.some((source) => source.includes('PREVIOUS_SNAPSHOT'))) {
        return 'INTERNAL_ESTIMATE';
    }
    return 'HISTORICAL_BASELINE';
};

async function collectRouteSnapshot(routeId: string) {
    const route = await prisma.route.findUnique({ where: { id: routeId } });
    if (!route) return null;

    const month = route.startDate.getUTCMonth() + 1;

    const [latestSnapshot, latestInsight, routeStats] = await Promise.all([
        prisma.priceSnapshot.findFirst({
            where: { routeId },
            orderBy: { timestamp: 'desc' },
        }),
        prisma.routeInsight.findFirst({
            where: {
                origin: route.originCode,
                destination: route.destinationCode,
            },
            orderBy: { lastSearchedAt: 'desc' },
        }),
        prisma.routeStatistics.findFirst({
            where: {
                originCode: route.originCode,
                destinationCode: route.destinationCode,
                month,
            },
        }),
    ]);

    const weightedCandidates: Array<{ amount: number; weight: number; source: string; currency: string }> = [];

    if (latestInsight?.rollingAvgPrice && latestInsight.rollingAvgPrice > 0) {
        weightedCandidates.push({ amount: latestInsight.rollingAvgPrice, weight: 0.52, source: 'ROUTE_INSIGHT_ROLLING_AVG', currency: 'TRY' });
    }
    if (latestInsight?.avgPriceRoute && latestInsight.avgPriceRoute > 0) {
        weightedCandidates.push({ amount: latestInsight.avgPriceRoute, weight: 0.33, source: 'ROUTE_INSIGHT_AVG', currency: 'TRY' });
    }
    if (routeStats?.avgPrice && routeStats.avgPrice > 0) {
        weightedCandidates.push({ amount: routeStats.avgPrice, weight: 0.28, source: 'ROUTE_STATISTICS_MONTHLY_AVG', currency: 'TRY' });
    }
    if (latestSnapshot?.amount && latestSnapshot.amount > 0) {
        weightedCandidates.push({ amount: latestSnapshot.amount, weight: 0.37, source: 'PREVIOUS_SNAPSHOT', currency: latestSnapshot.currency || 'TRY' });
    }

    if (!weightedCandidates.length) return null;

    const observedAt = new Date();
    const weightedNumerator = weightedCandidates.reduce((sum, candidate) => sum + (candidate.amount * candidate.weight), 0);
    const totalWeight = weightedCandidates.reduce((sum, candidate) => sum + candidate.weight, 0);
    const baseline = totalWeight > 0 ? weightedNumerator / totalWeight : weightedCandidates[0].amount;
    const adjustment = deterministicAdjustmentPercent(routeId, observedAt);
    const observedAmount = round(baseline * (1 + adjustment / 100));
    const currency = weightedCandidates[0].currency || 'TRY';
    const dataSourceType = inferRouteDataSourceType(weightedCandidates.map((candidate) => candidate.source));

    const snapshot = await prisma.priceSnapshot.create({
        data: {
            routeId,
            provider: `INTERNAL_${weightedCandidates[0].source}`,
            amount: observedAmount,
            currency,
            explanation: `${dataSourceType === 'HISTORICAL_BASELINE' ? 'Historical baseline' : 'Internal estimate'} from ${weightedCandidates.map((c) => c.source).join(', ')}.`,
            timestamp: observedAt,
        },
    });

    await prisma.route.update({
        where: { id: routeId },
        data: {
            currentPrice: observedAmount,
            latestSnapshotAt: observedAt,
        },
    });

    return { snapshot, dataSourceType };
}

const buildRouteRecommendationExplanation = (
    signal: RouteTimingSignal,
    confidence: number,
    dataSourceType: RouteDataSourceType,
    trendStatus: RouteTrendStatus,
    thresholdState: RouteThresholdState,
    changePercentVsPrevious: number | null,
    averagePrice: number | null,
    latestPrice: number,
    hasEnoughSnapshots: boolean,
): RouteRecommendationExplanation => {
    const positiveFactors: string[] = [];
    const negativeFactors: string[] = [];
    const missingFactors: string[] = [];

    if (thresholdState === 'AT_OR_BELOW_TARGET') {
        positiveFactors.push('Current observed price is at or below your target threshold.');
    }
    if (trendStatus === 'FALLING') {
        positiveFactors.push('Recent movement shows a falling price trend.');
    }
    if (averagePrice !== null && latestPrice <= averagePrice * 0.97) {
        positiveFactors.push('Latest observed price is below short-term route average.');
    }

    if (trendStatus === 'RISING') {
        negativeFactors.push('Recent movement indicates a rising route price trend.');
    }
    if (changePercentVsPrevious !== null && changePercentVsPrevious >= 8) {
        negativeFactors.push('Latest snapshot increased significantly vs previous observation.');
    }
    if (averagePrice !== null && latestPrice >= averagePrice * 1.08) {
        negativeFactors.push('Latest observed price is above short-term route average.');
    }

    if (!hasEnoughSnapshots) {
        missingFactors.push('Not enough route snapshots yet for stable trend confidence.');
    }
    if (thresholdState === 'NO_TARGET') {
        missingFactors.push('Target price is not set, so threshold timing certainty is limited.');
    }
    if (dataSourceType !== 'REAL_PROVIDER') {
        missingFactors.push('Real-time pricing data not available');
    }

    let primaryReason = '';
    let actionHint = '';
    if (signal === 'BUY') {
        primaryReason = dataSourceType === 'REAL_PROVIDER'
            ? 'BUY is recommended because route-level timing signals favor booking now.'
            : 'BUY is recommended from estimated route-level timing signals, not live airline pricing.';
        actionHint = dataSourceType === 'REAL_PROVIDER'
            ? 'Consider booking now, then keep monitoring only for major downward moves.'
            : 'Use this as an estimated timing signal and verify with a live booking source before paying.';
    } else if (signal === 'WAIT') {
        primaryReason = dataSourceType === 'REAL_PROVIDER'
            ? 'WAIT is recommended because recent route movement suggests patience may improve value.'
            : 'WAIT is recommended from internally estimated trend movement, so patience may improve value.';
        actionHint = dataSourceType === 'REAL_PROVIDER'
            ? 'Wait for stabilization or a lower snapshot, then re-check this route watch.'
            : 'Treat this as an estimated trend and confirm against real-time prices before acting.';
    } else {
        primaryReason = dataSourceType === 'REAL_PROVIDER'
            ? 'WATCH is recommended because current route evidence is not strong enough for a firm timing call.'
            : 'WATCH is recommended because there is not enough real-time data for a firm timing call.';
        actionHint = dataSourceType === 'REAL_PROVIDER'
            ? 'Collect more snapshots or set a target price to improve route-level timing confidence.'
            : 'Collect more route snapshots and verify against live pricing before making a booking decision.';
    }

    const supportingReasons = [
        confidence < 65
            ? 'Data coverage is limited, so this recommendation is intentionally cautious.'
            : 'Route movement data supports this recommendation.',
        ...(dataSourceType !== 'REAL_PROVIDER'
            ? ['This estimate is based on internal price benchmarks, not live airline pricing.']
            : []),
        ...(positiveFactors.slice(0, 2)),
        ...(negativeFactors.slice(0, 2)),
    ];

    const missingDataWarnings = [
        ...(dataSourceType !== 'REAL_PROVIDER'
            ? ['This estimate is based on internal price benchmarks, not live airline pricing.']
            : []),
        ...missingFactors,
    ].filter((value, index, array) => array.indexOf(value) === index);

    return {
        primaryReason,
        supportingReasons,
        missingDataWarnings,
        actionHint,
        positiveFactors,
        negativeFactors,
        missingFactors,
    };
};

async function createRouteAlert(routeId: string, message: string, oldPrice?: number, newPrice?: number) {
    await prisma.alertLog.create({
        data: {
            routeId,
            message,
            oldPrice,
            newPrice,
            dropPercent: oldPrice && newPrice ? round(((oldPrice - newPrice) / oldPrice) * 100) : null,
        },
    });
}

export async function evaluateRouteTiming(routeId: string): Promise<{
    trendStatus: RouteTrendStatus;
    timingSignal: RouteTimingSignal;
    timingLabel: string;
    reason: string;
    confidence: number;
    dataSourceType: RouteDataSourceType;
    thresholdState: RouteThresholdState;
    recommendationState: RouteTimingSignal;
    changePercentVsPrevious: number | null;
    averagePrice: number | null;
    volatilityPercent: number | null;
    explanation: RouteRecommendationExplanation;
}> {
    const route = await prisma.route.findUnique({ where: { id: routeId } });
    if (!route) throw new Error('Route not found');

    const snapshots = await prisma.priceSnapshot.findMany({
        where: { routeId },
        orderBy: { timestamp: 'desc' },
        take: 10,
    });

    if (!snapshots.length) {
        return {
            trendStatus: 'INSUFFICIENT_DATA',
            timingSignal: 'WATCH',
            timingLabel: 'WATCH (insufficient real-time data)',
            reason: 'No snapshot yet. Start collecting route prices.',
            confidence: 28,
            dataSourceType: 'HISTORICAL_BASELINE',
            thresholdState: 'NO_TARGET',
            recommendationState: 'WATCH',
            changePercentVsPrevious: null,
            averagePrice: null,
            volatilityPercent: null,
            explanation: {
                primaryReason: 'WATCH is recommended because no route snapshots are available yet.',
                supportingReasons: ['Route tracking needs observed prices before strong timing guidance is possible.'],
                missingDataWarnings: [
                    'No route snapshots available yet.',
                    'This estimate is based on internal price benchmarks, not live airline pricing.',
                ],
                actionHint: 'Keep this route active so snapshots can accumulate.',
                positiveFactors: [],
                negativeFactors: [],
                missingFactors: ['No route snapshots available yet.', 'Real-time pricing data not available'],
            },
        };
    }

    const latest = snapshots[0];
    const previous = snapshots[1] || null;
    const amounts = snapshots.map((s) => s.amount);
    const avg = amounts.reduce((sum, n) => sum + n, 0) / amounts.length;
    const variance = amounts.reduce((sum, n) => sum + (n - avg) ** 2, 0) / amounts.length;
    const stdev = Math.sqrt(variance);
    const volatility = avg > 0 ? (stdev / avg) * 100 : 0;
    const changePercent = previous ? ((latest.amount - previous.amount) / previous.amount) * 100 : null;
    const trendStatus = trendFromChange(changePercent);
    const dtd = daysUntil(route.startDate);
    const thresholdState = computeThresholdState(route.targetPrice, latest.amount);
    const hasEnoughSnapshots = snapshots.length >= 4;
    const dataSourceType: RouteDataSourceType = latest.provider.startsWith('INTERNAL_')
        ? latest.provider.includes('PREVIOUS_SNAPSHOT')
            ? 'INTERNAL_ESTIMATE'
            : 'HISTORICAL_BASELINE'
        : 'REAL_PROVIDER';

    let timingSignal: RouteTimingSignal = 'WATCH';
    let reason = 'Track this route for a clearer booking signal.';
    let confidence = hasEnoughSnapshots ? 63 : 52;

    if (route.targetPrice && latest.amount <= route.targetPrice) {
        timingSignal = 'BUY';
        reason = `Current price ${round(latest.amount)} is at or below your target ${round(route.targetPrice)}.`;
        confidence = hasEnoughSnapshots ? 86 : 78;
    } else if (changePercent !== null && changePercent >= 12) {
        timingSignal = 'WAIT';
        reason = `Price jumped ${round(changePercent)}% since last snapshot; wait for normalization.`;
        confidence = hasEnoughSnapshots ? 74 : 68;
    } else if (dtd <= 21 && latest.amount <= avg * 0.95) {
        timingSignal = 'BUY';
        reason = `Strong booking window: ${dtd} days left and current price is below short-term average.`;
        confidence = hasEnoughSnapshots ? 79 : 71;
    } else if (changePercent !== null && changePercent <= -8) {
        timingSignal = 'WATCH';
        reason = `Price dropped ${round(Math.abs(changePercent))}% recently; monitor closely for a potential buy point.`;
        confidence = hasEnoughSnapshots ? 70 : 62;
    }

    if (trendStatus === 'INSUFFICIENT_DATA') {
        confidence = Math.min(confidence, 56);
    }
    if (volatility > 16) {
        confidence = Math.max(45, confidence - 8);
    }
    confidence = round(Math.max(35, Math.min(confidenceCapByDataSource(dataSourceType), confidence)));

    const explanation = buildRouteRecommendationExplanation(
        timingSignal,
        confidence,
        dataSourceType,
        trendStatus,
        thresholdState,
        changePercent,
        avg,
        latest.amount,
        hasEnoughSnapshots,
    );

    await prisma.route.update({
        where: { id: routeId },
        data: {
            trendStatus,
            timingSignal,
            timingReason: reason,
            lastSignalAt: new Date(),
        },
    });

    // Record route metrics for health diagnostics
    try {
        const snapshotAgeMinutes = Math.floor((Date.now() - latest.timestamp.getTime()) / 60000);
        recordRouteMetric({
            routeId,
            snapshotType: dataSourceType,
            volatility: Math.round(volatility),
            hasRealtimeData: dataSourceType === 'REAL_PROVIDER',
            snapshotAgeMinutes,
            timestamp: new Date(),
        });
    } catch (err) {
        console.debug('[RouteMetrics] Error recording metric:', err);
    }

    return {
        trendStatus,
        timingSignal,
        timingLabel: buildRouteTimingLabel(timingSignal, dataSourceType),
        reason,
        confidence,
        dataSourceType,
        thresholdState,
        recommendationState: timingSignal,
        changePercentVsPrevious: changePercent === null ? null : round(changePercent),
        averagePrice: round(avg),
        volatilityPercent: round(volatility),
        explanation,
    };
}

export async function collectSnapshotAndEvaluateAlerts(routeId: string) {
    const previous = await prisma.priceSnapshot.findFirst({
        where: { routeId },
        orderBy: { timestamp: 'desc' },
    });

    const collected = await collectRouteSnapshot(routeId);
    if (!collected) return null;
    const { snapshot } = collected;

    const route = await prisma.route.findUnique({ where: { id: routeId } });
    if (!route) return snapshot;

    await prisma.route.update({
        where: { id: routeId },
        data: { latestSnapshotAt: snapshot.timestamp },
    });

    if (route.targetPrice && snapshot.amount <= route.targetPrice) {
        await createRouteAlert(
            routeId,
            `Target reached: ${snapshot.amount} ${snapshot.currency} is below your threshold ${route.targetPrice}.`,
            previous?.amount,
            snapshot.amount,
        );
    }

    if (previous && snapshot.amount >= previous.amount * 1.12) {
        await createRouteAlert(
            routeId,
            `Price spike: ${round(((snapshot.amount - previous.amount) / previous.amount) * 100)}% increase since last snapshot.`,
            previous.amount,
            snapshot.amount,
        );
    }

    const timing = await evaluateRouteTiming(routeId);
    if (timing.timingSignal === 'BUY' && timing.reason.toLowerCase().includes('booking window')) {
        await createRouteAlert(routeId, `Strong booking window detected: ${timing.reason}`, previous?.amount, snapshot.amount);
    }

    return snapshot;
}

export async function createRouteWatch(userId: string, input: TrackRouteInput) {
    const route = await prisma.route.create({
        data: {
            userId,
            originCode: input.origin.toUpperCase(),
            destinationCode: input.destination.toUpperCase(),
            startDate: new Date(input.departureDate),
            endDate: input.returnDate ? new Date(input.returnDate) : null,
            tripType: input.tripType || (input.returnDate ? 'ROUND_TRIP' : 'ONE_WAY'),
            cabin: toCabinClass(input.cabin),
            maxStops: input.maxStops ?? null,
            targetPrice: input.targetPrice ?? null,
            baggageRequired: typeof input.baggageRequired === 'boolean' ? input.baggageRequired : null,
            preferredAirlines: input.preferredAirlines || [],
            active: true,
        },
    });

    await collectSnapshotAndEvaluateAlerts(route.id);
    await analyzeRoute(route.id).catch(() => null);

    return route;
}

export async function getRouteWatchDetails(routeId: string, userId: string, refresh = false): Promise<RouteWatchDetails | null> {
    const route = await prisma.route.findFirst({
        where: { id: routeId, userId },
    });
    if (!route) return null;

    if (refresh) {
        await collectSnapshotAndEvaluateAlerts(route.id);
        await analyzeRoute(route.id).catch(() => null);
    }

    const latestSnapshot = await prisma.priceSnapshot.findFirst({
        where: { routeId: route.id },
        orderBy: { timestamp: 'desc' },
    });
    const previousSnapshot = await prisma.priceSnapshot.findFirst({
        where: { routeId: route.id },
        orderBy: { timestamp: 'desc' },
        skip: 1,
    });

    const timing = await evaluateRouteTiming(route.id);

    const alerts = await prisma.alertLog.findMany({
        where: { routeId: route.id },
        orderBy: { sentAt: 'desc' },
        take: 5,
    });

    return {
        routeId: route.id,
        route: {
            origin: route.originCode,
            destination: route.destinationCode,
            departureDate: route.startDate.toISOString(),
            returnDate: route.endDate ? route.endDate.toISOString() : null,
            tripType: route.tripType,
            cabin: route.cabin,
            maxStops: route.maxStops,
            targetPrice: route.targetPrice,
            baggageRequired: route.baggageRequired,
            preferredAirlines: route.preferredAirlines,
        },
        latestSnapshot: latestSnapshot
            ? {
                amount: latestSnapshot.amount,
                previousAmount: previousSnapshot?.amount ?? null,
                changePercentVsPrevious: previousSnapshot
                    ? round(((latestSnapshot.amount - previousSnapshot.amount) / previousSnapshot.amount) * 100)
                    : null,
                currency: latestSnapshot.currency,
                provider: latestSnapshot.provider,
                dataSourceType: timing.dataSourceType,
                observedAt: latestSnapshot.timestamp.toISOString(),
                trendDirection: timing.trendStatus,
                thresholdState: timing.thresholdState,
                recommendationState: timing.recommendationState,
            }
            : null,
        trendSummary: {
            status: timing.trendStatus,
            changePercentVsPrevious: timing.changePercentVsPrevious,
            recentPriceMovement: timing.changePercentVsPrevious === null
                ? 'UNKNOWN'
                : timing.changePercentVsPrevious > 0.8
                    ? 'UP'
                    : timing.changePercentVsPrevious < -0.8
                        ? 'DOWN'
                        : 'FLAT',
            averagePrice: timing.averagePrice,
            volatilityPercent: timing.volatilityPercent,
        },
        timingSignal: {
            signal: timing.timingSignal,
            label: timing.timingLabel,
            reason: timing.reason,
            confidence: timing.confidence,
            dataSourceType: timing.dataSourceType,
            explanation: timing.explanation,
        },
        alerts: alerts.map((a) => {
            let type: 'TARGET_REACHED' | 'PRICE_SPIKE' | 'BOOKING_WINDOW' = 'PRICE_SPIKE';
            if (a.message.toLowerCase().includes('target')) type = 'TARGET_REACHED';
            if (a.message.toLowerCase().includes('booking window')) type = 'BOOKING_WINDOW';
            return {
                type,
                message: a.message,
                createdAt: a.sentAt.toISOString(),
            };
        }),
    };
}

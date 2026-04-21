import type { CabinClass } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { collectPriceSnapshot } from '@/lib/priceCollector';
import { analyzeRoute } from '@/lib/anomalyDetector';

export type RouteTimingSignal = 'BUY_NOW' | 'WAIT' | 'WATCH_CLOSELY';
export type RouteTrendStatus = 'RISING' | 'FALLING' | 'STABLE' | 'INSUFFICIENT_DATA';

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
        currency: string;
        provider: string;
        timestamp: string;
    } | null;
    trendSummary: {
        status: RouteTrendStatus;
        changePercentVsPrevious: number | null;
        averagePrice: number | null;
        volatilityPercent: number | null;
    };
    timingSignal: {
        signal: RouteTimingSignal;
        reason: string;
        confidence: number;
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
    reason: string;
    confidence: number;
    changePercentVsPrevious: number | null;
    averagePrice: number | null;
    volatilityPercent: number | null;
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
            timingSignal: 'WATCH_CLOSELY',
            reason: 'No snapshot yet. Start collecting route prices.',
            confidence: 30,
            changePercentVsPrevious: null,
            averagePrice: null,
            volatilityPercent: null,
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

    let timingSignal: RouteTimingSignal = 'WATCH_CLOSELY';
    let reason = 'Track this route for a clearer booking signal.';
    let confidence = 55;

    if (route.targetPrice && latest.amount <= route.targetPrice) {
        timingSignal = 'BUY_NOW';
        reason = `Current price ${round(latest.amount)} is at or below your target ${round(route.targetPrice)}.`;
        confidence = 88;
    } else if (changePercent !== null && changePercent >= 12) {
        timingSignal = 'WAIT';
        reason = `Price jumped ${round(changePercent)}% since last snapshot; wait for normalization.`;
        confidence = 76;
    } else if (dtd <= 21 && latest.amount <= avg * 0.95) {
        timingSignal = 'BUY_NOW';
        reason = `Strong booking window: ${dtd} days left and current price is below short-term average.`;
        confidence = 80;
    } else if (changePercent !== null && changePercent <= -8) {
        timingSignal = 'WATCH_CLOSELY';
        reason = `Price dropped ${round(Math.abs(changePercent))}% recently; monitor closely for a potential buy point.`;
        confidence = 72;
    }

    await prisma.route.update({
        where: { id: routeId },
        data: {
            trendStatus,
            timingSignal,
            timingReason: reason,
            lastSignalAt: new Date(),
        },
    });

    return {
        trendStatus,
        timingSignal,
        reason,
        confidence,
        changePercentVsPrevious: changePercent === null ? null : round(changePercent),
        averagePrice: round(avg),
        volatilityPercent: round(volatility),
    };
}

export async function collectSnapshotAndEvaluateAlerts(routeId: string) {
    const previous = await prisma.priceSnapshot.findFirst({
        where: { routeId },
        orderBy: { timestamp: 'desc' },
    });

    const snapshot = await collectPriceSnapshot(routeId);
    if (!snapshot) return null;

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
    if (timing.timingSignal === 'BUY_NOW' && timing.reason.toLowerCase().includes('booking window')) {
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
                currency: latestSnapshot.currency,
                provider: latestSnapshot.provider,
                timestamp: latestSnapshot.timestamp.toISOString(),
            }
            : null,
        trendSummary: {
            status: timing.trendStatus,
            changePercentVsPrevious: timing.changePercentVsPrevious,
            averagePrice: timing.averagePrice,
            volatilityPercent: timing.volatilityPercent,
        },
        timingSignal: {
            signal: timing.timingSignal,
            reason: timing.reason,
            confidence: timing.confidence,
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

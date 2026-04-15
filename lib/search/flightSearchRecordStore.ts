import { prisma } from '@/lib/prisma';
import { FlightResult } from '@/types/hybridFlight';

const DAY_MS = 24 * 60 * 60 * 1000;
const PRICELINE_CACHE_FLIGHT_NUMBER = '__PRICELINE_CACHE__';

type RecentRouteSearchRecord = {
    flightNumber: string;
    price: number;
    provider: string;
    createdAt: Date;
};

type SearchAnalyticsOptions = {
    origin: string;
    destination: string;
    departureDate: string;
};

type BookingWindowPattern = {
    bestDay: number | null;
    buckets: Record<string, { sampleSize: number; avgMinPrice: number }>;
};

const hasExplicitTimezone = (value: string): boolean =>
    /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim());

const parseIsoDateToUtcMs = (value: string): number => {
    const text = value.trim();
    if (!text) return NaN;

    if (!hasExplicitTimezone(text)) return NaN;

    const timestamp = new Date(text).getTime();
    return Number.isFinite(timestamp) ? timestamp : NaN;
};

export const toMinutes = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.max(0, value);
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();

        const isoMatch = trimmed.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
        if (isoMatch) {
            const hours = parseInt(isoMatch[1] || '0', 10);
            const mins = parseInt(isoMatch[2] || '0', 10);
            return Math.max(0, hours * 60 + mins);
        }

        const hrMinMatch = trimmed.match(/(\d+)\s*(h|hr|hrs|hour|hours)\s*(\d+)?\s*(m|min|mins|minute|minutes)?/i);
        if (hrMinMatch) {
            const hours = parseInt(hrMinMatch[1] || '0', 10);
            const mins = parseInt(hrMinMatch[3] || '0', 10);
            return Math.max(0, hours * 60 + mins);
        }

        const minMatch = trimmed.match(/(\d+)\s*(m|min|mins|minute|minutes)/i);
        if (minMatch) {
            return Math.max(0, parseInt(minMatch[1], 10));
        }

        const numeric = parseFloat(trimmed.replace(/[^0-9.]/g, ''));
        if (Number.isFinite(numeric)) {
            return Math.max(0, numeric);
        }
    }

    return 0;
};

export const normalizeUtcDate = (dateInput: string): Date => {
    const datePart = dateInput.includes('T') ? dateInput.slice(0, 10) : dateInput;
    return new Date(`${datePart}T00:00:00.000Z`);
};

export const resolveFlightDurationMinutes = (flight: FlightResult): number => {
    const providerDuration = toMinutes(flight.duration);

    const depMs = flight.departTime ? parseIsoDateToUtcMs(String(flight.departTime)) : NaN;
    const arrMs = flight.arriveTime ? parseIsoDateToUtcMs(String(flight.arriveTime)) : NaN;
    const timestampDuration =
        Number.isFinite(depMs) && Number.isFinite(arrMs) && arrMs > depMs
            ? Math.round((arrMs - depMs) / 60000)
            : 0;

    const segmentDuration = Array.isArray(flight.segments)
        ? flight.segments
              .map((segment: any) => {
                  const direct = toMinutes(segment?.duration);
                  if (direct > 0) return direct;

                  const segDep = segment?.departing_at || segment?.departure || segment?.departure_time;
                  const segArr = segment?.arriving_at || segment?.arrival || segment?.arrival_time;
                  const segDepMs = segDep ? parseIsoDateToUtcMs(String(segDep)) : NaN;
                  const segArrMs = segArr ? parseIsoDateToUtcMs(String(segArr)) : NaN;

                  if (Number.isFinite(segDepMs) && Number.isFinite(segArrMs) && segArrMs > segDepMs) {
                      return Math.round((segArrMs - segDepMs) / 60000);
                  }

                  return 0;
              })
              .reduce((sum, value) => sum + value, 0)
        : 0;

    const layoverDuration = Array.isArray(flight.layovers)
        ? flight.layovers
              .map((layover) => toMinutes(layover?.duration))
              .reduce((sum, value) => sum + value, 0)
        : 0;

    const segmentPlusLayovers = segmentDuration + layoverDuration;

    const providerLooksBroken =
        providerDuration > 0 &&
        segmentPlusLayovers > 0 &&
        (providerDuration < Math.round(segmentPlusLayovers * 0.7) ||
            providerDuration > Math.round(segmentPlusLayovers * 1.4));

    if (!providerLooksBroken && providerDuration > 0) {
        return providerDuration;
    }

    if (segmentPlusLayovers > 0) {
        return segmentPlusLayovers;
    }

    if (timestampDuration > 0) {
        return timestampDuration;
    }

    return 0;
};

export const isInvalidBneIstDuration = (flight: FlightResult): boolean => {
    const from = (flight.from || '').toString().toUpperCase();
    const to = (flight.to || '').toString().toUpperCase();
    const routeMatch = from === 'BNE' && to === 'IST';
    if (!routeMatch) return false;

    const durationMins = resolveFlightDurationMinutes(flight);
    return durationMins > 0 && durationMins < 14 * 60;
};

export async function persistFlightSearchRecords(
    flights: FlightResult[],
    options: { origin: string; destination: string; departureDate: string }
) {
    const departureDate = normalizeUtcDate(options.departureDate);

    const rows = flights
        .filter((flight) => Number.isFinite(Number(flight.price)) && Number(flight.price) > 0)
        .filter((flight) => !isInvalidBneIstDuration(flight))
        .map((flight) => ({
            flightNumber: (flight.flightNumber || 'UNKNOWN').toString(),
            origin: options.origin,
            destination: options.destination,
            departureDate,
            price: Number(flight.price),
            provider: (flight.source || 'UNKNOWN').toString(),
        }));

    const invalidRows = rows.filter((row) =>
        !row.flightNumber || !row.origin || !row.destination || !Number.isFinite(row.price) || row.price <= 0 || !row.departureDate
    );

    if (invalidRows.length > 0) {
        console.error('[FLIGHT_SEARCH_RECORD] invalid rows filtered:', invalidRows.slice(0, 3));
    }

    const validRows = rows.filter((row) =>
        !!row.flightNumber &&
        !!row.origin &&
        !!row.destination &&
        Number.isFinite(row.price) &&
        row.price > 0 &&
        !!row.departureDate
    );

    if (validRows.length === 0) {
        console.error('[FLIGHT_SEARCH_RECORD] no valid rows to persist', {
            flightsReceived: flights.length,
            origin: options.origin,
            destination: options.destination,
            departureDate: options.departureDate,
        });
        return;
    }

    const flightSearchRecordModel = (prisma as any)?.flightSearchRecord;
    if (!flightSearchRecordModel) {
        console.error('[FLIGHT_SEARCH_RECORD] prisma model flightSearchRecord is unavailable (client/schema mismatch?)');
        return;
    }

    try {
        await flightSearchRecordModel.createMany({
            data: validRows,
        });
    } catch (error: any) {
        console.error('[FLIGHT_SEARCH_RECORD] persist failed:', {
            message: error?.message || String(error),
            rows: validRows.length,
            sample: validRows.slice(0, 2),
        });
    }
}

export async function persistSearchAnalytics(
    flights: FlightResult[],
    options: SearchAnalyticsOptions
): Promise<void> {
    const normalizedOrigin = String(options.origin || '').toUpperCase();
    const normalizedDestination = String(options.destination || '').toUpperCase();
    const departureDate = normalizeUtcDate(options.departureDate);
    const searchTimestamp = new Date();
    const daysToDeparture = Math.max(
        0,
        Math.round((departureDate.getTime() - searchTimestamp.getTime()) / DAY_MS)
    );

    const validFlights = flights
        .filter((flight) => Number.isFinite(Number(flight.price)) && Number(flight.price) > 0)
        .filter((flight) => !isInvalidBneIstDuration(flight));

    if (validFlights.length === 0) {
        return;
    }

    const groupedByProvider = new Map<string, number[]>();
    for (const flight of validFlights) {
        const provider = String(flight.source || 'UNKNOWN').toUpperCase();
        const price = Number(flight.price);
        if (!groupedByProvider.has(provider)) {
            groupedByProvider.set(provider, []);
        }
        groupedByProvider.get(provider)!.push(price);
    }

    const searchAnalyticsModel = (prisma as any)?.searchAnalytics;
    if (searchAnalyticsModel && groupedByProvider.size > 0) {
        const rows = Array.from(groupedByProvider.entries()).map(([provider, prices]) => {
            const minPrice = Math.min(...prices);
            const avgPrice = prices.reduce((sum, value) => sum + value, 0) / prices.length;
            return {
                origin: normalizedOrigin,
                destination: normalizedDestination,
                departureDate,
                minPrice,
                avgPrice,
                foundMinPrice: minPrice,
                foundAvgPrice: avgPrice,
                provider,
                searchTimestamp,
            };
        });

        try {
            await searchAnalyticsModel.createMany({ data: rows });
        } catch (error: any) {
            console.warn('[SEARCH_ANALYTICS] persist skipped:', error?.message || error);
        }
    }

    const routeInsightModel = (prisma as any)?.routeInsight;
    if (!routeInsightModel) {
        return;
    }

    const routeMinPrice = Math.min(...validFlights.map((flight) => Number(flight.price)));
    const routeMaxPrice = Math.max(...validFlights.map((flight) => Number(flight.price)));
    const routeAvgPrice =
        validFlights.reduce((sum, flight) => sum + Number(flight.price), 0) / validFlights.length;

    try {
        const existing = await routeInsightModel.findUnique({
            where: {
                origin_destination_departureDate: {
                    origin: normalizedOrigin,
                    destination: normalizedDestination,
                    departureDate,
                },
            },
            select: {
                searchCount: true,
                lastMinPrice: true,
                observedMinPrice: true,
                observedMaxPrice: true,
                rollingAvgPrice: true,
                recommendedBookingWindowDays: true,
                avgPriceRoute: true,
                bookingWindowPattern: true,
                volatility: true,
            },
        });

        const buildWindowBucket = (days: number) => {
            if (days <= 7) return '0-7';
            if (days <= 14) return '8-14';
            if (days <= 30) return '15-30';
            if (days <= 60) return '31-60';
            return '61+';
        };

        const updateBookingPattern = (
            currentRaw: unknown,
            days: number,
            minPrice: number
        ): BookingWindowPattern => {
            const fallback: BookingWindowPattern = { bestDay: days, buckets: {} };
            const current = currentRaw && typeof currentRaw === 'object'
                ? (currentRaw as BookingWindowPattern)
                : fallback;

            const buckets: BookingWindowPattern['buckets'] = {
                ...(current.buckets || {}),
            };

            const bucketKey = buildWindowBucket(days);
            const prev = buckets[bucketKey] || { sampleSize: 0, avgMinPrice: minPrice };
            const nextSample = prev.sampleSize + 1;
            const nextAvg = Number((((prev.avgMinPrice * prev.sampleSize) + minPrice) / nextSample).toFixed(2));
            buckets[bucketKey] = { sampleSize: nextSample, avgMinPrice: nextAvg };

            const bestEntry = Object.entries(buckets).sort((a, b) => a[1].avgMinPrice - b[1].avgMinPrice)[0];
            const bestDay = bestEntry
                ? (bestEntry[0] === '0-7' ? 7 : bestEntry[0] === '8-14' ? 14 : bestEntry[0] === '15-30' ? 30 : bestEntry[0] === '31-60' ? 60 : 90)
                : current.bestDay ?? days;

            return { bestDay, buckets };
        };

        if (!existing) {
            const bookingWindowPattern = updateBookingPattern(null, daysToDeparture, routeMinPrice);
            await routeInsightModel.create({
                data: {
                    origin: normalizedOrigin,
                    destination: normalizedDestination,
                    departureDate,
                    searchCount: 1,
                    lastMinPrice: routeMinPrice,
                    lastAvgPrice: routeAvgPrice,
                    avgPriceRoute: routeAvgPrice,
                    observedMinPrice: routeMinPrice,
                    observedMaxPrice: routeMaxPrice,
                    rollingAvgPrice: routeAvgPrice,
                    recommendedBookingWindowDays: bookingWindowPattern.bestDay ?? daysToDeparture,
                    lastObservedDaysToDeparture: daysToDeparture,
                    bookingWindowPattern,
                    volatility: 0,
                    lastSearchedAt: searchTimestamp,
                },
            });
            return;
        }

        const previousMin = Number(existing.lastMinPrice || 0);
        const previousObservedMin = Number(existing.observedMinPrice || previousMin || routeMinPrice);
        const previousObservedMax = Number(existing.observedMaxPrice || routeMaxPrice);
        const previousRollingAvg = Number(existing.rollingAvgPrice || existing.lastMinPrice || routeAvgPrice);
        const previousRouteAvg = Number(existing.avgPriceRoute || routeAvgPrice);
        const previousWindow = Number(existing.recommendedBookingWindowDays || 0);
        const deltaPercent = previousRouteAvg > 0
            ? Math.abs((routeAvgPrice - previousRouteAvg) / previousRouteAvg) * 100
            : 0;
        const nextVolatility = Number(
            ((Number(existing.volatility || 0) * 0.7) + (deltaPercent * 0.3)).toFixed(2)
        );
        const nextObservedMin = Math.min(previousObservedMin, routeMinPrice);
        const nextObservedMax = Math.max(previousObservedMax, routeMaxPrice);
        const nextRollingAvg = Number(((previousRollingAvg * 0.8) + (routeAvgPrice * 0.2)).toFixed(2));
        const nextAvgPriceRoute = Number(((previousRouteAvg * 0.7) + (routeAvgPrice * 0.3)).toFixed(2));
        const nextBookingPattern = updateBookingPattern(existing.bookingWindowPattern, daysToDeparture, routeMinPrice);
        const nextBookingWindow =
            routeMinPrice <= previousObservedMin
                ? daysToDeparture
                : previousWindow > 0
                    ? Math.round((previousWindow * 0.6) + ((nextBookingPattern.bestDay ?? daysToDeparture) * 0.4))
                    : (nextBookingPattern.bestDay ?? daysToDeparture);

        await routeInsightModel.update({
            where: {
                origin_destination_departureDate: {
                    origin: normalizedOrigin,
                    destination: normalizedDestination,
                    departureDate,
                },
            },
            data: {
                searchCount: Number(existing.searchCount || 0) + 1,
                lastMinPrice: routeMinPrice,
                lastAvgPrice: routeAvgPrice,
                avgPriceRoute: nextAvgPriceRoute,
                observedMinPrice: nextObservedMin,
                observedMaxPrice: nextObservedMax,
                rollingAvgPrice: nextRollingAvg,
                recommendedBookingWindowDays: nextBookingWindow,
                lastObservedDaysToDeparture: daysToDeparture,
                bookingWindowPattern: nextBookingPattern,
                volatility: nextVolatility,
                lastSearchedAt: searchTimestamp,
            },
        });
    } catch (error: any) {
        console.warn('[ROUTE_INSIGHT] update skipped:', error?.message || error);
    }
}

export async function getMedianPriceForRouteDate(
    origin: string,
    destination: string,
    departureDate: string
): Promise<number | null> {
    const start = normalizeUtcDate(departureDate);
    const end = new Date(start.getTime() + DAY_MS);

    const flightSearchRecordModel = (prisma as any)?.flightSearchRecord;
    if (!flightSearchRecordModel) {
        return null;
    }

    let prices: Array<{ price: number }> = [];
    try {
        prices = await flightSearchRecordModel.findMany({
            where: {
                origin,
                destination,
                departureDate: {
                    gte: start,
                    lt: end,
                },
                price: {
                    gt: 0,
                },
            },
            select: { price: true },
        });
    } catch (error: any) {
        console.warn('[FLIGHT_SEARCH_RECORD] median lookup skipped:', error?.message || error);
        return null;
    }

    if (prices.length === 0) {
        return null;
    }

    const values = prices
        .map((row) => Number(row.price))
        .filter((value) => Number.isFinite(value) && value > 0)
        .sort((a, b) => a - b);

    if (values.length === 0) {
        return null;
    }

    const mid = Math.floor(values.length / 2);
    if (values.length % 2 === 0) {
        return (values[mid - 1] + values[mid]) / 2;
    }
    return values[mid];
}

export async function hasRecentRouteSearchRecords(
    origin: string,
    destination: string,
    departureDate: string,
    windowMinutes = 15
): Promise<boolean> {
    const start = normalizeUtcDate(departureDate);
    const end = new Date(start.getTime() + DAY_MS);
    const recentFrom = new Date(Date.now() - windowMinutes * 60 * 1000);

    const flightSearchRecordModel = (prisma as any)?.flightSearchRecord;
    if (!flightSearchRecordModel) {
        return false;
    }

    try {
        const record = await flightSearchRecordModel.findFirst({
            where: {
                origin,
                destination,
                departureDate: {
                    gte: start,
                    lt: end,
                },
                createdAt: {
                    gte: recentFrom,
                },
            },
            select: { id: true },
            orderBy: { createdAt: 'desc' },
        });

        return !!record;
    } catch (error: any) {
        console.warn('[FLIGHT_SEARCH_RECORD] recency lookup skipped:', error?.message || error);
        return false;
    }
}

export async function getRecentRouteSearchRecords(
    origin: string,
    destination: string,
    departureDate: string,
    windowMinutes = 15,
    provider?: string
): Promise<RecentRouteSearchRecord[]> {
    const start = normalizeUtcDate(departureDate);
    const end = new Date(start.getTime() + DAY_MS);
    const recentFrom = new Date(Date.now() - windowMinutes * 60 * 1000);

    const flightSearchRecordModel = (prisma as any)?.flightSearchRecord;
    if (!flightSearchRecordModel) {
        return [];
    }

    try {
        const records = await flightSearchRecordModel.findMany({
            where: {
                origin,
                destination,
                departureDate: {
                    gte: start,
                    lt: end,
                },
                createdAt: {
                    gte: recentFrom,
                },
                ...(provider
                    ? {
                          provider: {
                              equals: provider,
                              mode: 'insensitive',
                          },
                      }
                    : {}),
            },
            select: {
                flightNumber: true,
                price: true,
                provider: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        return (records
            .map((record: any) => ({
                flightNumber: String(record.flightNumber || ''),
                price: Number(record.price || 0),
                provider: String(record.provider || 'UNKNOWN').toUpperCase(),
                createdAt: new Date(record.createdAt),
            }))
            .filter((record: RecentRouteSearchRecord) => record.flightNumber && Number.isFinite(record.price) && record.price > 0)) as RecentRouteSearchRecord[];
    } catch (error: any) {
        console.warn('[FLIGHT_SEARCH_RECORD] records lookup skipped:', error?.message || error);
        return [];
    }
}

export async function getRecentPricelineRawCache(
    origin: string,
    destination: string,
    departureDate: string,
    windowMinutes = 20
): Promise<FlightResult[] | null> {
    const start = normalizeUtcDate(departureDate);
    const end = new Date(start.getTime() + DAY_MS);
    const recentFrom = new Date(Date.now() - windowMinutes * 60 * 1000);

    const flightSearchRecordModel = (prisma as any)?.flightSearchRecord;
    if (!flightSearchRecordModel) {
        return null;
    }

    try {
        const record = await flightSearchRecordModel.findFirst({
            where: {
                origin,
                destination,
                departureDate: {
                    gte: start,
                    lt: end,
                },
                provider: {
                    equals: 'PRICELINE',
                    mode: 'insensitive',
                },
                flightNumber: PRICELINE_CACHE_FLIGHT_NUMBER,
                cacheStatus: 'SUCCESS',
                createdAt: {
                    gte: recentFrom,
                },
            },
            select: {
                rawResponse: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        const raw = record?.rawResponse as any;
        if (!raw) return null;

        const flights = Array.isArray(raw?.flights) ? raw.flights : Array.isArray(raw) ? raw : [];
        if (!Array.isArray(flights) || flights.length === 0) {
            return null;
        }

        return flights as FlightResult[];
    } catch (error: any) {
        console.warn('[FLIGHT_SEARCH_RECORD] raw Priceline cache lookup skipped:', error?.message || error);
        return null;
    }
}

export async function persistPricelineRawCache(
    flights: FlightResult[],
    options: { origin: string; destination: string; departureDate: string }
): Promise<void> {
    const departureDate = normalizeUtcDate(options.departureDate);
    const flightSearchRecordModel = (prisma as any)?.flightSearchRecord;
    if (!flightSearchRecordModel) {
        return;
    }

    const validFlights = flights.filter((flight) => Number.isFinite(Number(flight.price)) && Number(flight.price) > 0);
    if (validFlights.length === 0) {
        return;
    }

    try {
        await flightSearchRecordModel.create({
            data: {
                flightNumber: PRICELINE_CACHE_FLIGHT_NUMBER,
                origin: options.origin,
                destination: options.destination,
                departureDate,
                price: Math.min(...validFlights.map((flight) => Number(flight.price))),
                provider: 'PRICELINE',
                cacheStatus: 'SUCCESS',
                rawResponse: {
                    provider: 'PRICELINE',
                    cachedAt: new Date().toISOString(),
                    flights: validFlights,
                },
            },
        });
    } catch (error: any) {
        console.warn('[FLIGHT_SEARCH_RECORD] raw Priceline cache persist skipped:', error?.message || error);
    }
}

export async function getRouteInsightForDate(
    origin: string,
    destination: string,
    departureDate: string
): Promise<{
    avgPriceRoute: number;
    volatility: number;
    searchCount: number;
    rollingAvgPrice: number;
    bookingWindowPattern: unknown;
    recommendedBookingWindowDays: number | null;
    observedMinPrice: number;
    observedMaxPrice: number;
} | null> {
    const routeInsightModel = (prisma as any)?.routeInsight;
    if (!routeInsightModel) return null;

    const normalizedOrigin = String(origin || '').toUpperCase();
    const normalizedDestination = String(destination || '').toUpperCase();
    const normalizedDate = normalizeUtcDate(departureDate);

    try {
        const row = await routeInsightModel.findUnique({
            where: {
                origin_destination_departureDate: {
                    origin: normalizedOrigin,
                    destination: normalizedDestination,
                    departureDate: normalizedDate,
                },
            },
            select: {
                avgPriceRoute: true,
                volatility: true,
                searchCount: true,
                rollingAvgPrice: true,
                bookingWindowPattern: true,
                recommendedBookingWindowDays: true,
                observedMinPrice: true,
                observedMaxPrice: true,
            },
        });
        if (!row) return null;

        return {
            avgPriceRoute: Number(row.avgPriceRoute || 0),
            volatility: Number(row.volatility || 0),
            searchCount: Number(row.searchCount || 0),
            rollingAvgPrice: Number(row.rollingAvgPrice || 0),
            bookingWindowPattern: row.bookingWindowPattern,
            recommendedBookingWindowDays: row.recommendedBookingWindowDays ?? null,
            observedMinPrice: Number(row.observedMinPrice || 0),
            observedMaxPrice: Number(row.observedMaxPrice || 0),
        };
    } catch (error: any) {
        console.warn('[ROUTE_INSIGHT] summary lookup skipped:', error?.message || error);
        return null;
    }
}

export async function getRoutePriceTrend(
    origin: string,
    destination: string,
    departureDate: string,
    lookbackDays = 21
): Promise<{
    trendSignal: 'RISING' | 'FALLING' | 'STABLE';
    changePercent: number;
    sampleSize: number;
    lastPrice: number | null;
    prevPrice: number | null;
    olderPrice: number | null;
    clarity: 'clear' | 'mixed' | 'weak';
}> {
    const searchAnalyticsModel = (prisma as any)?.searchAnalytics;
    if (!searchAnalyticsModel) {
        return {
            trendSignal: 'STABLE',
            changePercent: 0,
            sampleSize: 0,
            lastPrice: null,
            prevPrice: null,
            olderPrice: null,
            clarity: 'weak',
        };
    }

    const start = normalizeUtcDate(departureDate);
    const end = new Date(start.getTime() + DAY_MS);
    const since = new Date(Date.now() - lookbackDays * DAY_MS);

    try {
        const rows = await searchAnalyticsModel.findMany({
            where: {
                origin,
                destination,
                departureDate: {
                    gte: start,
                    lt: end,
                },
                searchTimestamp: {
                    gte: since,
                },
            },
            select: {
                minPrice: true,
                avgPrice: true,
                searchTimestamp: true,
            },
            orderBy: {
                searchTimestamp: 'asc',
            },
        });

        const buckets = new Map<string, number[]>();
        rows.forEach((row: any) => {
            const bucketKey = new Date(row.searchTimestamp).toISOString();
            const representativePrice = Number(row.minPrice || row.avgPrice || 0);
            if (!Number.isFinite(representativePrice) || representativePrice <= 0) return;
            if (!buckets.has(bucketKey)) buckets.set(bucketKey, []);
            buckets.get(bucketKey)!.push(representativePrice);
        });

        const pricePoints = Array.from(buckets.entries())
            .map(([timestamp, prices]) => ({
                timestamp,
                price: prices.reduce((sum, value) => sum + value, 0) / prices.length,
            }))
            .filter((row) => Number.isFinite(row.price) && row.price > 0)
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        if (pricePoints.length === 0) {
            return {
                trendSignal: 'STABLE',
                changePercent: 0,
                sampleSize: 0,
                lastPrice: null,
                prevPrice: null,
                olderPrice: null,
                clarity: 'weak',
            };
        }

        const lastPrice = pricePoints[pricePoints.length - 1]?.price ?? null;
        const prevPrice = pricePoints[pricePoints.length - 2]?.price ?? null;
        const olderPrice = pricePoints[pricePoints.length - 3]?.price ?? null;

        const pctChange = (next: number | null, prev: number | null): number => {
            if (!Number.isFinite(Number(next)) || !Number.isFinite(Number(prev)) || Number(prev) <= 0) return 0;
            return ((Number(next) - Number(prev)) / Number(prev)) * 100;
        };

        const recentDelta = pctChange(lastPrice, prevPrice);
        const olderDelta = pctChange(prevPrice, olderPrice);
        const absRecentDelta = Math.abs(recentDelta);
        const absOlderDelta = Math.abs(olderDelta);

        let trendSignal: 'RISING' | 'FALLING' | 'STABLE' = 'STABLE';
        let clarity: 'clear' | 'mixed' | 'weak' = 'weak';

        if (absRecentDelta >= 2.5 && absOlderDelta >= 2.5 && Math.sign(recentDelta) === Math.sign(olderDelta) && Math.sign(recentDelta) !== 0) {
            trendSignal = recentDelta > 0 ? 'RISING' : 'FALLING';
            clarity = 'clear';
        } else if (absRecentDelta >= 3) {
            trendSignal = recentDelta > 0 ? 'RISING' : recentDelta < 0 ? 'FALLING' : 'STABLE';
            clarity = 'mixed';
        }

        const changePercent = Number(recentDelta.toFixed(2));

        return {
            trendSignal,
            changePercent,
            sampleSize: pricePoints.length,
            lastPrice,
            prevPrice,
            olderPrice,
            clarity,
        };
    } catch (error: any) {
        console.warn('[ROUTE_INSIGHT] trend lookup skipped:', error?.message || error);
        return {
            trendSignal: 'STABLE',
            changePercent: 0,
            sampleSize: 0,
            lastPrice: null,
            prevPrice: null,
            olderPrice: null,
            clarity: 'weak',
        };
    }
}
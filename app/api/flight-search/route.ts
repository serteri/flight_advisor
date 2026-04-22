/**
 * @deprecated
 * Public flight-search API is being retired as FlightAgent pivots to a
 * decision, protection, and tracking layer for flights users already found.
 */
import { NextResponse } from 'next/server';
import { searchAllProvidersWithMeta } from '@/services/search/searchService';
import { HybridSearchParams } from '@/types/hybridFlight';
import { normalizeSource } from '@/lib/utils';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { applyAdvancedFlightScoring, applyRouteIntelligenceFeatures } from '@/lib/scoring/advancedFlightScoring';
import { getCityFromAirportCode } from '@/lib/airport-utils';
import {
    hasRecentRouteSearchRecords,
    persistFlightSearchRecords,
    persistSearchAnalytics,
    getRouteInsightForDate,
    getRoutePriceTrend,
    getRecentRouteSearchRecords,
    getRecentPricelineRawCache,
    persistPricelineRawCache,
} from '@/lib/search/flightSearchRecordStore';
import { normalizeBuyNowVariant } from '@/lib/experiment/buyNowVariant';
import type { UnifiedFlight, ScoredFlight } from '@/types/unifiedFlight';
import { useUnifiedPipeline, useUnifiedDebug, getPipelineMetrics } from '@/lib/featureFlags';
import { logScoreVisibility, logPerformanceTiming, isDebugLoggingEnabled } from '@/lib/observability/logger';
import { runSelfCheckLayer } from '@/lib/audit/selfCheckLayer';

// @ts-ignore
import airports from 'airports';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';
const PRICELINE_CACHE_WINDOW_MINUTES = 20;

const SEARCH_CACHE_TTL_MS = 15 * 60 * 1000;
const flightSearchResponseCache = new Map<string, { expiresAt: number; results: any[] }>();

const buildCacheKey = (params: HybridSearchParams): string =>
    [
        params.origin.toUpperCase(),
        params.destination.toUpperCase(),
        params.date.split('T')[0],
        params.adults,
        params.children || 0,
        params.infants || 0,
        params.cabin || 'economy',
        params.persona || 'comfort',
        params.currency || 'AUD',
    ].join('|');

type ViewerAccess = {
    isPremium: boolean;
    userTier: 'FREE' | 'PRO' | 'ELITE';
    stripeCurrentPeriodEnd: string | null;
    userId: string | null;
};

type UserPreferenceProfile = {
    prefersDirect: boolean;
    prefersNight: boolean;
    preferredDepartureWindow: 'morning' | 'evening' | 'none';
    sampleSize: number;
};

type PersonalBiasProfile = {
    priceWeightBoost: number;
    directPenaltyBoost: number;
    loyaltyAirline?: string | null;
    loyaltyBoost: number;
    avoidMultiStopWeight?: number;
    avoidNightWeight?: number;
};

type ProactiveTip = {
    id: string;
    type: 'AIRPORT' | 'DATE';
    message: string;
    saving: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const EARTH_RADIUS_KM = 6371;

const normalizeCabinParam = (value: string | null | undefined): HybridSearchParams['cabin'] => {
    switch ((value || '').toLowerCase()) {
        case 'premium':
        case 'premium_economy':
            return 'premium';
        case 'business':
            return 'business';
        case 'first':
            return 'first';
        default:
            return 'economy';
    }
};

const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value));

const toRad = (value: number): number => (value * Math.PI) / 180;

const getAirportCoords = (iataCode: string): { lat: number; lon: number } | null => {
    const code = String(iataCode || '').toUpperCase();
    if (!code) return null;

    const row = (airports as any[]).find((item: any) => String(item?.iata || '').toUpperCase() === code);
    if (!row) return null;

    const lat = Number(row.lat);
    const lon = Number(row.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    return { lat, lon };
};

const distanceKmBetweenAirports = (origin: string, destination: string): number | null => {
    const a = getAirportCoords(origin);
    const b = getAirportCoords(destination);
    if (!a || !b) return null;

    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);

    const c =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

    return EARTH_RADIUS_KM * (2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c)));
};

const getNearbyOriginCandidates = (origin: string, maxDistanceKm = 140, limit = 8): string[] => {
    const originCode = String(origin || '').toUpperCase();
    if (!originCode) return [];

    return (airports as any[])
        .map((item: any) => String(item?.iata || '').toUpperCase())
        .filter((code: string) => code && code.length === 3 && code !== originCode)
        .map((code: string) => ({ code, distance: distanceKmBetweenAirports(originCode, code) }))
        .filter((row) => Number.isFinite(row.distance) && Number(row.distance) <= maxDistanceKm)
        .sort((a, b) => Number(a.distance) - Number(b.distance))
        .slice(0, limit)
        .map((row) => row.code);
};

const toUtcDate = (dateInput: string): Date => {
    const datePart = dateInput.includes('T') ? dateInput.slice(0, 10) : dateInput;
    return new Date(`${datePart}T00:00:00.000Z`);
};

const toCurrencyPrefix = (currency: string): string => {
    const normalized = String(currency || '').toUpperCase();
    if (normalized === 'USD' || normalized === 'AUD' || normalized === 'CAD' || normalized === 'NZD') return '$';
    if (normalized === 'EUR') return '€';
    if (normalized === 'GBP') return '£';
    return '$';
};

async function resolveViewerAccess(): Promise<ViewerAccess> {
    const session = await auth();
    const email = session?.user?.email?.toLowerCase();

    if (!email) {
        return {
            isPremium: false,
            userTier: 'FREE',
            stripeCurrentPeriodEnd: null,
            userId: null,
        };
    }

    const dbUser = await prisma.user.findUnique({
        where: { email },
        select: {
            id: true,
            isPremium: true,
            subscriptionPlan: true,
            stripeCurrentPeriodEnd: true,
        },
    });

    const now = new Date();
    const hasValidPeriod =
        !!dbUser?.stripeCurrentPeriodEnd && dbUser.stripeCurrentPeriodEnd > now;
    const hasPremiumAccess = Boolean(dbUser?.isPremium && hasValidPeriod);
    const plan = dbUser?.subscriptionPlan;

    return {
        isPremium: hasPremiumAccess,
        userTier:
            hasPremiumAccess && (plan === 'PRO' || plan === 'ELITE')
                ? plan
                : 'FREE',
        stripeCurrentPeriodEnd: dbUser?.stripeCurrentPeriodEnd
            ? dbUser.stripeCurrentPeriodEnd.toISOString()
            : null,
        userId: dbUser?.id || null,
    };
}

async function resolveUserPreferenceProfile(userId: string | null): Promise<UserPreferenceProfile | null> {
    if (!userId) return null;

    const prefModel = (prisma as any)?.userPreference;
    if (!prefModel) return null;

    try {
        const rows = await prefModel.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 80,
            select: {
                isDirect: true,
                isNight: true,
                departureHour: true,
            },
        });

        if (!rows.length) return null;

        const directCount = rows.filter((r: any) => Boolean(r.isDirect)).length;
        const nightCount = rows.filter((r: any) => Boolean(r.isNight)).length;
        const morningCount = rows.filter((r: any) => Number(r.departureHour) >= 5 && Number(r.departureHour) < 12).length;
        const eveningCount = rows.filter((r: any) => Number(r.departureHour) >= 18 || Number(r.departureHour) < 1).length;

        return {
            prefersDirect: directCount / rows.length >= 0.55,
            prefersNight: nightCount / rows.length >= 0.50,
            preferredDepartureWindow:
                eveningCount / rows.length >= 0.45
                    ? 'evening'
                    : morningCount / rows.length >= 0.45
                        ? 'morning'
                        : 'none',
            sampleSize: rows.length,
        };
    } catch (error) {
        console.warn('[PREFERENCE_PROFILE] resolve failed:', error);
        return null;
    }
}

async function resolvePersonalBiasProfile(
    userId: string | null,
    origin: string,
    destination: string
): Promise<PersonalBiasProfile | null> {
    const preferenceModel = (prisma as any)?.userPreference;
    const selectionModel = (prisma as any)?.flightSelectionEvent;
    if (!preferenceModel && !selectionModel) return null;

    try {
        const normalizedOrigin = String(origin || '').toUpperCase();
        const normalizedDestination = String(destination || '').toUpperCase();

        const [prefRows, eventRows] = await Promise.all([
            preferenceModel
                ? preferenceModel.findMany({
                      where: {
                          ...(userId ? { userId } : {}),
                          action: { in: ['BOOK', 'DETAIL', 'IGNORE', 'IGNORE_MULTI_STOP', 'IGNORE_NIGHT'] },
                      },
                      orderBy: { createdAt: 'desc' },
                      take: 120,
                      select: {
                          action: true,
                          isDirect: true,
                          isNight: true,
                          selectedPrice: true,
                          competitorPrice: true,
                          airline: true,
                      },
                  })
                : Promise.resolve([]),
            selectionModel
                ? selectionModel.findMany({
                      where: {
                          action: { in: ['BOOK', 'DETAIL', 'IGNORE', 'IGNORE_MULTI_STOP', 'IGNORE_NIGHT'] },
                          origin: normalizedOrigin,
                          destination: normalizedDestination,
                      },
                      orderBy: { createdAt: 'desc' },
                      take: 160,
                      select: {
                          selectedPrice: true,
                          competitorPrice: true,
                      },
                  })
                : Promise.resolve([]),
        ]);

        const cheapFromPref = prefRows.filter((row: any) => {
            if (!['BOOK', 'DETAIL'].includes(String(row.action || '').toUpperCase())) return false;
            const selectedPrice = Number(row.selectedPrice || 0);
            const competitorPrice = Number(row.competitorPrice || 0);
            return selectedPrice > 0 && competitorPrice > 0 && selectedPrice <= competitorPrice * 1.03;
        }).length;
        const cheapFromEvent = eventRows.filter((row: any) => {
            const selectedPrice = Number(row.selectedPrice || 0);
            const competitorPrice = Number(row.competitorPrice || 0);
            return selectedPrice > 0 && competitorPrice > 0 && selectedPrice <= competitorPrice * 1.03;
        }).length;

        const cheapSampleSize = Math.max(1, prefRows.length + eventRows.length);
        const cheapRatio = (cheapFromPref + cheapFromEvent) / cheapSampleSize;

        const preferenceSelectionRows = prefRows.filter((row: any) => ['BOOK', 'DETAIL'].includes(String(row.action || '').toUpperCase()));
        const directCount = preferenceSelectionRows.filter((row: any) => Boolean(row.isDirect)).length;
        const directRatio = preferenceSelectionRows.length > 0 ? directCount / preferenceSelectionRows.length : 0;

        const ignoredRows = prefRows.filter((row: any) => String(row.action || '').toUpperCase().includes('IGNORE'));
        const ignoredMultiStop = ignoredRows.filter((row: any) => String(row.action || '').toUpperCase() === 'IGNORE_MULTI_STOP').length;
        const ignoredNight = ignoredRows.filter((row: any) => String(row.action || '').toUpperCase() === 'IGNORE_NIGHT' || Boolean(row.isNight)).length;
        const ignoreDenominator = Math.max(1, ignoredRows.length);
        const multiStopIgnoreRatio = ignoredMultiStop / ignoreDenominator;
        const nightIgnoreRatio = ignoredNight / ignoreDenominator;

        const airlineCount = new Map<string, number>();
        preferenceSelectionRows.forEach((row: any) => {
            const key = String(row.airline || '').trim().toUpperCase();
            if (!key) return;
            airlineCount.set(key, (airlineCount.get(key) || 0) + 1);
        });

        let loyaltyAirline: string | null = null;
        let loyaltyShare = 0;
        for (const [airline, count] of airlineCount.entries()) {
            const share = preferenceSelectionRows.length > 0 ? count / preferenceSelectionRows.length : 0;
            if (share > loyaltyShare) {
                loyaltyShare = share;
                loyaltyAirline = airline;
            }
        }

        const priceWeightBoost =
            cheapRatio >= 0.65
                ? 0.2
                : cheapRatio >= 0.5
                    ? 0.1
                    : 0;

        const directPenaltyBoost =
            directRatio >= 0.65
                ? 2
                : directRatio >= 0.5
                    ? 1
                    : 0;

        const loyaltyBoost = loyaltyAirline && loyaltyShare >= 0.35 && (airlineCount.get(loyaltyAirline) || 0) >= 3
            ? 0.5
            : 0;

        const avoidMultiStopWeight =
            multiStopIgnoreRatio >= 0.4
                ? 2
                : multiStopIgnoreRatio >= 0.25
                    ? 1
                    : 0;

        const avoidNightWeight =
            nightIgnoreRatio >= 0.45
                ? 1.5
                : nightIgnoreRatio >= 0.25
                    ? 0.8
                    : 0;

        if (priceWeightBoost <= 0 && directPenaltyBoost <= 0 && loyaltyBoost <= 0 && avoidMultiStopWeight <= 0 && avoidNightWeight <= 0) {
            return null;
        }

        return {
            priceWeightBoost: clamp(priceWeightBoost, 0, 0.4),
            directPenaltyBoost: clamp(directPenaltyBoost, 0, 3),
            loyaltyAirline,
            loyaltyBoost,
            avoidMultiStopWeight: clamp(avoidMultiStopWeight, 0, 3),
            avoidNightWeight: clamp(avoidNightWeight, 0, 2),
        };
    } catch (error) {
        console.warn('[PERSONAL_BIAS] resolve failed:', error);
        return null;
    }
}

async function resolveProactiveTips(params: {
    origin: string;
    destination: string;
    departureDate: string;
    baseReferencePrice: number;
    currency: string;
}): Promise<ProactiveTip[]> {
    const routeInsightModel = (prisma as any)?.routeInsight;
    if (!routeInsightModel) return [];

    const origin = String(params.origin || '').toUpperCase();
    const destination = String(params.destination || '').toUpperCase();
    const departureDate = toUtcDate(params.departureDate);
    const baseReferencePrice = Number(params.baseReferencePrice || 0);

    if (!origin || !destination || !Number.isFinite(baseReferencePrice) || baseReferencePrice <= 0) {
        return [];
    }

    try {
        const currencyPrefix = toCurrencyPrefix(params.currency);
        const tips: ProactiveTip[] = [];

        const nearbyOrigins = getNearbyOriginCandidates(origin, 140, 8);
        if (nearbyOrigins.length > 0) {
            const nearbyRows = await routeInsightModel.findMany({
                where: {
                    destination,
                    departureDate,
                    origin: { in: nearbyOrigins },
                },
                select: {
                    origin: true,
                    avgPriceRoute: true,
                },
            });

            const bestNearby = nearbyRows
                .map((row: any) => ({
                    origin: String(row.origin || '').toUpperCase(),
                    avgPriceRoute: Number(row.avgPriceRoute || 0),
                    saving: Math.round(baseReferencePrice - Number(row.avgPriceRoute || 0)),
                }))
                .filter((row: any) => row.origin && row.avgPriceRoute > 0 && row.saving >= 60)
                .sort((a: any, b: any) => b.saving - a.saving)[0];

            if (bestNearby) {
                const city = getCityFromAirportCode(bestNearby.origin);
                const savingPct = Math.round((bestNearby.saving / baseReferencePrice) * 100);
                tips.push({
                    id: `airport-${bestNearby.origin}`,
                    type: 'AIRPORT',
                    saving: bestNearby.saving,
                    message: `Flying from ${city} (${bestNearby.origin}) could save ${savingPct}% compared to typical prices (${currencyPrefix}${bestNearby.saving}).`,
                });
            }
        }

        const dateRows = await routeInsightModel.findMany({
            where: {
                origin,
                destination,
                departureDate: {
                    gte: new Date(departureDate.getTime() - DAY_MS),
                    lte: new Date(departureDate.getTime() + DAY_MS),
                },
            },
            select: {
                departureDate: true,
                avgPriceRoute: true,
            },
        });

        const bestDate = dateRows
            .map((row: any) => {
                const candidateDate = new Date(row.departureDate);
                const dayDiff = Math.round((candidateDate.getTime() - departureDate.getTime()) / DAY_MS);
                const avgPriceRoute = Number(row.avgPriceRoute || 0);
                const saving = Math.round(baseReferencePrice - avgPriceRoute);
                return { dayDiff, avgPriceRoute, saving };
            })
            .filter((row: { dayDiff: number; avgPriceRoute: number; saving: number }) => row.dayDiff !== 0 && Math.abs(row.dayDiff) <= 1 && row.avgPriceRoute > 0 && row.saving >= 60)
            .sort((a: { saving: number }, b: { saving: number }) => b.saving - a.saving)[0];

        if (bestDate) {
            const direction = bestDate.dayDiff < 0 ? 'earlier' : 'later';
            const savingPct = Math.round((bestDate.saving / baseReferencePrice) * 100);
            tips.push({
                id: `date-${bestDate.dayDiff}`,
                type: 'DATE',
                saving: bestDate.saving,
                message: `Leaving ${Math.abs(bestDate.dayDiff)} day ${direction} could save about ${savingPct}% versus typical fares (${currencyPrefix}${bestDate.saving}).`,
            });
        }

        return tips.slice(0, 2);
    } catch (error) {
        console.warn('[PROACTIVE_TIPS] resolve failed:', error);
        return [];
    }
}

function buildQueryParams(searchParams: URLSearchParams): HybridSearchParams {
    return {
        origin: searchParams.get('origin') || '',
        destination: searchParams.get('destination') || '',
        date: searchParams.get('date') || '',
        adults: parseInt(searchParams.get('adults') || '1'),
        children: parseInt(searchParams.get('children') || '0'),
        infants: parseInt(searchParams.get('infants') || '0'),
        cabin: normalizeCabinParam(searchParams.get('cabin')),
        currency: searchParams.get('currency') || 'AUD',
        persona: (() => {
            const p = (searchParams.get('persona') || '').toLowerCase();
            if (p === 'budget' || p === 'business' || p === 'family') return p;
            return 'comfort';
        })(),
    };
}

type CachedFlightRecord = {
    flightNumber: string;
    price: number;
    provider: string;
    createdAt: Date;
    airlineName?: string | null;
    airlineCode?: string | null;
    stops?: number | null;
    totalDurationMinutes?: number | null;
    layoverAirports?: string[];
    departureTime?: Date | null;
    arrivalTime?: Date | null;
};

function mapCachedRecordsToFlights(
    records: CachedFlightRecord[],
    params: HybridSearchParams
): UnifiedFlight[] {
    const uniqueByFlightNumber = new Map<string, CachedFlightRecord>();

    for (const record of records) {
        const key = record.flightNumber.toUpperCase();
        if (!uniqueByFlightNumber.has(key)) {
            uniqueByFlightNumber.set(key, record);
        }
    }

    const fallbackDepartureIso = params.date.includes('T')
        ? params.date
        : `${params.date}T00:00:00.000Z`;

    return Array.from(uniqueByFlightNumber.values()).map((record, index) => {
        const departureTime = record.departureTime
            ? record.departureTime.toISOString()
            : fallbackDepartureIso;

        const arrivalTime = record.arrivalTime
            ? record.arrivalTime.toISOString()
            : (record.totalDurationMinutes && record.departureTime
                ? new Date(record.departureTime.getTime() + record.totalDurationMinutes * 60 * 1000).toISOString()
                : fallbackDepartureIso);

        const layovers = (record.layoverAirports ?? []).map((iata) => ({
            airport: iata,
            duration: 0,
        }));

        const stops = record.stops ?? layovers.length;

        const airlineName = record.airlineName
            || (record.airlineCode ? record.airlineCode : null)
            || 'Priceline (Cached)';

        return {
            id: `CACHE_PRICELINE_${record.flightNumber}_${record.createdAt.getTime()}_${index}`,
            source: 'priceline',
            airline: airlineName,
            flightNumber: record.flightNumber,
            from: params.origin.toUpperCase(),
            to: params.destination.toUpperCase(),
            departureTime,
            arrivalTime,
            duration: record.totalDurationMinutes ?? 0,
            stops,
            price: Number(record.price),
            currency: params.currency || 'AUD',
            cabinClass: (params.cabin || 'economy') as 'economy' | 'premium' | 'business' | 'first',
            layovers,
            segments: [
                {
                    from: params.origin.toUpperCase(),
                    to: params.destination.toUpperCase(),
                    departureTime,
                    arrivalTime,
                    duration: record.totalDurationMinutes ?? 0,
                    carrier: (record.airlineCode || 'PR').toUpperCase(),
                    flightNumber: record.flightNumber,
                },
            ],
            baggage: {
                included: false,
                checked: { label: 'Not included' },
                cabin: { kg: 7, label: '7kg' },
            },
            policies: {
                refundable: false,
                changeAllowed: false,
            },
        };
    });
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const origin = searchParams.get('origin');
    const destination = searchParams.get('destination');
    const date = searchParams.get('date');

    if (!origin || !destination || !date) {
        return NextResponse.json({ error: 'Eksik parametre' }, { status: 400 });
    }

    try {
        const routeStartTime = Date.now();
        const queryParams = buildQueryParams(searchParams);
        const buyNowVariant = normalizeBuyNowVariant(searchParams.get('buyNowVariant')) || 'A';
        const cacheKey = buildCacheKey(queryParams);
        const viewerAccess = await resolveViewerAccess();
        const preferenceProfile = await resolveUserPreferenceProfile(viewerAccess.userId);
        const personalBiasProfile = await resolvePersonalBiasProfile(
            viewerAccess.userId,
            queryParams.origin,
            queryParams.destination
        );
        const usePersonalizedScoring = Boolean(
            (preferenceProfile && preferenceProfile.sampleSize >= 3) ||
            personalBiasProfile
        );
        const hasRecentDbRecords = await hasRecentRouteSearchRecords(
            queryParams.origin,
            queryParams.destination,
            queryParams.date,
            PRICELINE_CACHE_WINDOW_MINUTES
        );

        const rawPricelineCache = hasRecentDbRecords
            ? await getRecentPricelineRawCache(
                  queryParams.origin,
                  queryParams.destination,
                  queryParams.date,
                  PRICELINE_CACHE_WINDOW_MINUTES
              )
            : null;

        const recentPricelineRecords = !rawPricelineCache && hasRecentDbRecords
            ? await getRecentRouteSearchRecords(
                  queryParams.origin,
                  queryParams.destination,
                  queryParams.date,
                  PRICELINE_CACHE_WINDOW_MINUTES,
                  'priceline'
              )
            : [];

        const cachedPricelineFlights = rawPricelineCache || mapCachedRecordsToFlights(recentPricelineRecords, queryParams);
        const shouldSkipPriceline = cachedPricelineFlights.length > 0;

        if (shouldSkipPriceline) {
            console.log(`[PRICELINE][CACHE HIT] ${queryParams.origin}->${queryParams.destination} ${queryParams.date} | flights=${cachedPricelineFlights.length}`);
        } else {
            console.log(`[PRICELINE][CACHE MISS] ${queryParams.origin}->${queryParams.destination} ${queryParams.date} | fetching from API`);
        }

        const cached = flightSearchResponseCache.get(cacheKey);
        if (!usePersonalizedScoring && hasRecentDbRecords && cached && cached.expiresAt > Date.now()) {
            return NextResponse.json({
                results: cached.results,
                viewerAccess,
                cache: { hit: true, source: 'FlightSearchRecord-15m' },
            });
        }

        const providerMeta = await searchAllProvidersWithMeta(queryParams, {
            skipPriceline: shouldSkipPriceline,
            injectedFlights: cachedPricelineFlights,
        });
        const allFlights = providerMeta.flights;

        // (Removed shadow metrics from SearchProvidersMeta)

        if (!shouldSkipPriceline) {
            const freshPricelineFlights = allFlights.filter(
                (flight) => normalizeSource(flight.source) === 'priceline'
            );
            await persistPricelineRawCache(freshPricelineFlights, {
                origin: queryParams.origin,
                destination: queryParams.destination,
                departureDate: queryParams.date,
            });
        }

        await persistFlightSearchRecords(allFlights, {
            origin: queryParams.origin,
            destination: queryParams.destination,
            departureDate: queryParams.date,
        });

        await persistSearchAnalytics(allFlights, {
            origin: queryParams.origin,
            destination: queryParams.destination,
            departureDate: queryParams.date,
        });

        if (providerMeta.rateLimited && allFlights.length === 0) {
            return NextResponse.json(
                {
                    error: 'Hızlı Arama Limiti Doldu',
                    warnings: providerMeta.warnings,
                },
                { status: 429 }
            );
        }

        // ── SCORING: Canonical UnifiedFlight path ─────────────────────────────
        const scoringOptions = {
            origin: queryParams.origin,
            destination: queryParams.destination,
            departureDate: queryParams.date,
            useHistoricalMedian: viewerAccess.isPremium,
            persona: queryParams.persona,
            preferenceProfile: preferenceProfile || undefined,
            personalBiasProfile: personalBiasProfile || undefined,
        };

        let scoredFlights: ScoredFlight[];
        let scoringMs = 0;
        const scoringStart = Date.now();

        console.log(`✅ [UNIFIED PIPELINE] Scoring ${allFlights.length} flights via canonical unified entry point`);
        scoredFlights = await applyAdvancedFlightScoring(
            allFlights,
            scoringOptions,
        );
        scoringMs = Date.now() - scoringStart;

        const routeInsight = await getRouteInsightForDate(
            queryParams.origin,
            queryParams.destination,
            queryParams.date
        );

        const routeTrend = await getRoutePriceTrend(
            queryParams.origin,
            queryParams.destination,
            queryParams.date,
            21
        );

        const enrichedFlights = scoredFlights.map((flight) => {
            if (!routeInsight) return flight;
            return {
                ...flight,
                score: {
                    ...flight.score,
                    routeIntelligence: {
                        avgPriceRoute: routeInsight.avgPriceRoute,
                        volatility: routeInsight.volatility,
                        searchCount: routeInsight.searchCount,
                        rollingAvgPrice: routeInsight.rollingAvgPrice,
                        bookingWindowPattern: routeInsight.bookingWindowPattern,
                        recommendedBookingWindowDays: routeInsight.recommendedBookingWindowDays,
                        observedMinPrice: routeInsight.observedMinPrice,
                        observedMaxPrice: routeInsight.observedMaxPrice,
                    },
                },
            };
        });

        // Flight Intelligence Phase 1: BUY/WAIT, deal tier, regret stat
        const intelligentFlights = applyRouteIntelligenceFeatures(
            enrichedFlights,
            routeInsight ? {
                avgPriceRoute: routeInsight.avgPriceRoute,
                volatility: routeInsight.volatility,
                searchCount: routeInsight.searchCount,
                rollingAvgPrice: routeInsight.rollingAvgPrice,
                recommendedBookingWindowDays: routeInsight.recommendedBookingWindowDays,
                observedMinPrice: routeInsight.observedMinPrice,
                observedMaxPrice: routeInsight.observedMaxPrice,
            } : null,
            queryParams.date,
            routeTrend,
            buyNowVariant,
        );

        const selfCheckedFlights = intelligentFlights.map((flight) => runSelfCheckLayer(flight));
        const finalResults = selfCheckedFlights.map((result) => ({
            ...result.flight,
            selfCheckWarnings: result.userWarnings,
        }));

        const fallbackMinPrice = finalResults
            .map((flight) => Number(flight.price || 0))
            .filter((value) => Number.isFinite(value) && value > 0)
            .sort((a, b) => a - b)[0] || 0;

        const proactiveTips = await resolveProactiveTips({
            origin: queryParams.origin,
            destination: queryParams.destination,
            departureDate: queryParams.date,
            baseReferencePrice: Number(routeInsight?.avgPriceRoute || fallbackMinPrice),
            currency: queryParams.currency || 'AUD',
        });

        if (!usePersonalizedScoring) {
            flightSearchResponseCache.set(cacheKey, {
                expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
                results: finalResults,
            });
        }

        // ── Debug/shadow unified data for internal verification ──────────────
        // Only included in response when UNIFIED_DEBUG env flag is truthy.
        // This NEVER affects the production API contract.
        const includeDebugUnified = useUnifiedDebug();
        let _debug: Record<string, unknown> | undefined;
        
        const routeTotalMs = Date.now() - routeStartTime;
        
        if (includeDebugUnified || isDebugLoggingEnabled()) {
            const finalUnified = finalResults;
            const metrics = getPipelineMetrics();
            const obs = providerMeta._debugObservability;
            const adjustedBySelfCheck = selfCheckedFlights.filter((result) =>
                result.debug.scoreAudit.confidencePenalty > 0
                || Boolean(result.debug.scoreAudit.recommendationOverride)
                || !result.debug.parseAudit.passed
                || !result.debug.honestyAudit.passed,
            ).length;
            const userWarningCount = selfCheckedFlights.reduce((sum, result) => sum + result.userWarnings.length, 0);
            _debug = {
                pipelineMode: providerMeta.pipelineMode,
                unifiedCount: finalUnified.length,
                sampleFlight: finalUnified[0] || null,
                selfCheck: {
                    adjustedBySelfCheck,
                    userWarningCount,
                    sampleAudit: selfCheckedFlights[0]?.debug || null,
                },
                pipelineMetrics: {
                    totalRequests: metrics.totalRequests,
                    unifiedSuccess: metrics.unifiedSuccess,
                    legacyFallback: metrics.legacyFallback,
                    legacyExplicit: metrics.legacyExplicit,
                    fallbackRate: metrics.fallbackRate,
                },
                ...(obs ? {
                    totalFlightsFetched: obs.totalFlightsFetched,
                    droppedViaValidation: obs.droppedViaValidation,
                    providerStats: obs.providerStats,
                } : {}),
                timing: {
                    providerFetchTime: obs?.providerFetchTime || 0,
                    scoringTime: scoringMs,
                    totalTime: routeTotalMs,
                }
            };
        }
        
        if (finalResults.length > 0) {
            const scores = finalResults.map(f => f.score.composite).filter(s => typeof s === 'number');
            if (scores.length > 0) {
                logScoreVisibility(Math.min(...scores), Math.max(...scores));
            }
        }
        
        logPerformanceTiming(providerMeta._debugObservability?.providerFetchTime || 0, scoringMs, routeTotalMs);

        return NextResponse.json({
            results: finalResults,
            proactiveTips,
            viewerAccess,
            warnings: providerMeta.warnings,
            cache: {
                hit: false,
                source: shouldSkipPriceline ? 'db-priceline-cache+live-duffel' : 'live',
            },
            ...(_debug ? { _debug } : {}),
        });
    } catch (error) {
        console.error('[FLIGHT_SEARCH_API] Error:', error);
        return NextResponse.json(
            { error: 'Search failed', details: String(error) },
            { status: 500 }
        );
    }
}
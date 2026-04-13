import { NextResponse } from 'next/server';
import { searchAllProvidersWithMeta } from '@/services/search/searchService';
import { FlightResult, HybridSearchParams } from '@/types/hybridFlight';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { applyAdvancedFlightScoring } from '@/lib/scoring/advancedFlightScoring';
import {
    hasRecentRouteSearchRecords,
    persistFlightSearchRecords,
    getRecentRouteSearchRecords,
    getRecentPricelineRawCache,
    persistPricelineRawCache,
} from '@/lib/search/flightSearchRecordStore';

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
        params.currency || 'AUD',
    ].join('|');

type ViewerAccess = {
    isPremium: boolean;
    userTier: 'FREE' | 'PRO' | 'ELITE';
    stripeCurrentPeriodEnd: string | null;
};

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

async function resolveViewerAccess(): Promise<ViewerAccess> {
    const session = await auth();
    const email = session?.user?.email?.toLowerCase();

    if (!email) {
        return {
            isPremium: false,
            userTier: 'FREE',
            stripeCurrentPeriodEnd: null,
        };
    }

    const dbUser = await prisma.user.findUnique({
        where: { email },
        select: {
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
    };
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
    };
}

function mapCachedRecordsToFlights(
    records: Array<{ flightNumber: string; price: number; provider: string; createdAt: Date }>,
    params: HybridSearchParams
): FlightResult[] {
    const uniqueByFlightNumber = new Map<string, { flightNumber: string; price: number; provider: string; createdAt: Date }>();

    for (const record of records) {
        const key = record.flightNumber.toUpperCase();
        if (!uniqueByFlightNumber.has(key)) {
            uniqueByFlightNumber.set(key, record);
        }
    }

    const departureIso = params.date.includes('T')
        ? params.date
        : `${params.date}T00:00:00.000Z`;

    return Array.from(uniqueByFlightNumber.values()).map((record, index) => ({
        id: `CACHE_PRICELINE_${record.flightNumber}_${record.createdAt.getTime()}_${index}`,
        source: 'PRICELINE',
        airline: 'Priceline (Cached)',
        flightNumber: record.flightNumber,
        from: params.origin.toUpperCase(),
        to: params.destination.toUpperCase(),
        departTime: departureIso,
        arriveTime: departureIso,
        duration: 0,
        stops: 1,
        price: Number(record.price),
        currency: params.currency || 'AUD',
        cabinClass: (params.cabin || 'economy') as any,
        layovers: [],
        segments: [],
        policies: {
            baggageKg: 0,
            cabinBagKg: 7,
        },
        durationDebug: {
            provider: 'PRICELINE_DB_CACHE',
            cachedAt: record.createdAt.toISOString(),
            fallback: true,
        },
    } as FlightResult));
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
        const queryParams = buildQueryParams(searchParams);
        const cacheKey = buildCacheKey(queryParams);
        const viewerAccess = await resolveViewerAccess();
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
                  'PRICELINE'
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
        if (hasRecentDbRecords && cached && cached.expiresAt > Date.now()) {
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

        if (!shouldSkipPriceline) {
            const freshPricelineFlights = allFlights.filter(
                (flight) => String(flight.source || '').toUpperCase() === 'PRICELINE'
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

        if (providerMeta.rateLimited && allFlights.length === 0) {
            return NextResponse.json(
                {
                    error: 'Hızlı Arama Limiti Doldu',
                    warnings: providerMeta.warnings,
                },
                { status: 429 }
            );
        }

        const scoredFlights = await applyAdvancedFlightScoring(allFlights, {
            origin: queryParams.origin,
            destination: queryParams.destination,
            departureDate: queryParams.date,
            useHistoricalMedian: viewerAccess.isPremium,
        });

        flightSearchResponseCache.set(cacheKey, {
            expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
            results: scoredFlights,
        });

        return NextResponse.json({
            results: scoredFlights,
            viewerAccess,
            warnings: providerMeta.warnings,
            cache: {
                hit: false,
                source: shouldSkipPriceline ? 'db-priceline-cache+live-duffel' : 'live',
            },
        });
    } catch (error) {
        console.error('[FLIGHT_SEARCH_API] Error:', error);
        return NextResponse.json(
            { error: 'Search failed', details: String(error) },
            { status: 500 }
        );
    }
}
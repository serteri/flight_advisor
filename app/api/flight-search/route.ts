import { NextResponse } from 'next/server';
import { searchAllProvidersWithMeta } from '@/services/search/searchService';
import { HybridSearchParams } from '@/types/hybridFlight';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { applyAdvancedFlightScoring } from '@/lib/scoring/advancedFlightScoring';
import { hasRecentRouteSearchRecords, persistFlightSearchRecords } from '@/lib/search/flightSearchRecordStore';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

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
        params.currency || 'USD',
    ].join('|');

type ViewerAccess = {
    isPremium: boolean;
    userTier: 'FREE' | 'PRO' | 'ELITE';
    stripeCurrentPeriodEnd: string | null;
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
        cabin: (searchParams.get('cabin') || 'economy') as
            | 'economy'
            | 'business'
            | 'first',
        currency: searchParams.get('currency') || 'USD',
    };
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
            15
        );

        const cached = flightSearchResponseCache.get(cacheKey);
        if (hasRecentDbRecords && cached && cached.expiresAt > Date.now()) {
            return NextResponse.json({
                results: cached.results,
                viewerAccess,
                cache: { hit: true, source: 'FlightSearchRecord-15m' },
            });
        }

        const providerMeta = await searchAllProvidersWithMeta(queryParams);
        const allFlights = providerMeta.flights;
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
            cache: { hit: false, source: 'live' },
        });
    } catch (error) {
        console.error('[FLIGHT_SEARCH_API] Error:', error);
        return NextResponse.json(
            { error: 'Search failed', details: String(error) },
            { status: 500 }
        );
    }
}
import { NextResponse } from 'next/server';
import { searchAllProvidersWithMeta } from '@/services/search/searchService';
import { HybridSearchParams } from '@/types/hybridFlight';
import { applyAdvancedFlightScoring } from '@/lib/scoring/advancedFlightScoring';
import { hasRecentRouteSearchRecords, persistFlightSearchRecords } from '@/lib/search/flightSearchRecordStore';

// Vercel Pro Ayarları
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const SEARCH_CACHE_TTL_MS = 15 * 60 * 1000;
const searchResponseCache = new Map<string, { expiresAt: number; results: any[] }>();

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

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const origin = searchParams.get('origin');
    const destination = searchParams.get('destination');
    const date = searchParams.get('date');

    console.log(`\n=====================================`);
    console.log(`🚀 GET /api/search CALLED`);
    console.log(`  origin: ${origin}`);
    console.log(`  destination: ${destination}`);
    console.log(`  date: ${date}`);
    console.log(`=====================================\n`);

    if (!origin || !destination || !date) {
        return NextResponse.json({ error: 'Eksik parametre' }, { status: 400 });
    }

    try {
        const queryParams: HybridSearchParams = {
            origin,
            destination,
            date,
            adults: parseInt(searchParams.get('adults') || '1'),
            children: parseInt(searchParams.get('children') || '0'),
            infants: parseInt(searchParams.get('infants') || '0'),
            cabin: (searchParams.get('cabin') || 'economy') as "economy" | "business" | "first",
            currency: searchParams.get('currency') || 'USD'
        };

        const cacheKey = buildCacheKey(queryParams);
        const hasRecentDbRecords = await hasRecentRouteSearchRecords(
            queryParams.origin,
            queryParams.destination,
            queryParams.date,
            15
        );
        const cached = searchResponseCache.get(cacheKey);

        if (hasRecentDbRecords && cached && cached.expiresAt > Date.now()) {
            return NextResponse.json(cached.results);
        }

        console.log(`📡 Calling searchAllProviders...`);
        const providerMeta = await searchAllProvidersWithMeta(queryParams);
        const allFlights = providerMeta.flights;

        if (providerMeta.rateLimited && allFlights.length === 0) {
            return NextResponse.json({ error: 'Hızlı Arama Limiti Doldu' }, { status: 429 });
        }

        await persistFlightSearchRecords(allFlights, {
            origin: queryParams.origin,
            destination: queryParams.destination,
            departureDate: queryParams.date,
        });

        const scoredFlights = await applyAdvancedFlightScoring(allFlights, {
            origin: queryParams.origin,
            destination: queryParams.destination,
            departureDate: queryParams.date,
        });
        searchResponseCache.set(cacheKey, {
            expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
            results: scoredFlights,
        });
        console.log(`✅ searchAllProviders returned ${scoredFlights.length} scored flights`);

        if (scoredFlights.length === 0) {
            return NextResponse.json([], { status: 200 });
        }

        return NextResponse.json(scoredFlights);

    } catch (error) {
        console.error("🔥 GENEL ARAMA HATASI:", error);
        return NextResponse.json({ error: 'Search failed', details: String(error) }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { origin, destination, date, adults = 1, children = 0, infants = 0, cabin = 'economy', currency = 'USD' } = body;

        if (!origin || !destination || !date) {
            return NextResponse.json({ error: 'Eksik parametre' }, { status: 400 });
        }

        console.log(`🚀 SEARCH API (POST): ${origin} -> ${destination} [${date}]`);

        const queryParams: HybridSearchParams = {
            origin,
            destination,
            date,
            adults,
            children,
            infants,
            cabin,
            currency
        };

        const cacheKey = buildCacheKey(queryParams);
        const hasRecentDbRecords = await hasRecentRouteSearchRecords(
            queryParams.origin,
            queryParams.destination,
            queryParams.date,
            15
        );
        const cached = searchResponseCache.get(cacheKey);
        if (hasRecentDbRecords && cached && cached.expiresAt > Date.now()) {
            return NextResponse.json(cached.results);
        }

        const providerMeta = await searchAllProvidersWithMeta(queryParams);
        const allFlights = providerMeta.flights;

        if (providerMeta.rateLimited && allFlights.length === 0) {
            return NextResponse.json({ error: 'Hızlı Arama Limiti Doldu' }, { status: 429 });
        }

        await persistFlightSearchRecords(allFlights, {
            origin: queryParams.origin,
            destination: queryParams.destination,
            departureDate: queryParams.date,
        });

        const scoredFlights = await applyAdvancedFlightScoring(allFlights, {
            origin: queryParams.origin,
            destination: queryParams.destination,
            departureDate: queryParams.date,
        });

        searchResponseCache.set(cacheKey, {
            expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
            results: scoredFlights,
        });

        if (scoredFlights.length === 0) {
            return NextResponse.json([], { status: 200 });
        }

        return NextResponse.json(scoredFlights);

    } catch (error) {
        console.error("🔥 SEARCH API POST HATASI:", error);
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }
}


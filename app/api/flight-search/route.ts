import { NextResponse } from 'next/server';
import { searchAllProviders } from '@/services/search/searchService';
import { HybridSearchParams } from '@/types/hybridFlight';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { applyAdvancedFlightScoring } from '@/lib/scoring/advancedFlightScoring';
import { persistFlightSearchRecords } from '@/lib/search/flightSearchRecordStore';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

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
        const viewerAccess = await resolveViewerAccess();
        const allFlights = await searchAllProviders(queryParams);
        await persistFlightSearchRecords(allFlights, {
            origin: queryParams.origin,
            destination: queryParams.destination,
            departureDate: queryParams.date,
        });

        const scoredFlights = await applyAdvancedFlightScoring(allFlights, {
            origin: queryParams.origin,
            destination: queryParams.destination,
            departureDate: queryParams.date,
            useHistoricalMedian: viewerAccess.isPremium,
        });

        return NextResponse.json({
            results: scoredFlights,
            viewerAccess,
        });
    } catch (error) {
        console.error('[FLIGHT_SEARCH_API] Error:', error);
        return NextResponse.json(
            { error: 'Search failed', details: String(error) },
            { status: 500 }
        );
    }
}
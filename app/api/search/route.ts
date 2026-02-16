import { NextResponse } from 'next/server';
import { searchAllProviders } from '@/services/search/searchService';
import { HybridSearchParams } from '@/types/hybridFlight';

// Vercel Pro Ayarları
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const origin = searchParams.get('origin');
    const destination = searchParams.get('destination');
    const date = searchParams.get('date');

    if (!origin || !destination || !date) {
        return NextResponse.json({ error: 'Eksik parametre' }, { status: 400 });
    }

    console.log(`🚀 SEARCH API (GET): ${origin} -> ${destination} [${date}]`);

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

        const allFlights = await searchAllProviders(queryParams);

        if (allFlights.length === 0) {
            return NextResponse.json([], { status: 200 });
        }

        return NextResponse.json(allFlights);

    } catch (error) {
        console.error("🔥 GENEL ARAMA HATASI:", error);
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
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

        const allFlights = await searchAllProviders(queryParams);

        if (allFlights.length === 0) {
            return NextResponse.json([], { status: 200 });
        }

        return NextResponse.json(allFlights);

    } catch (error) {
        console.error("🔥 SEARCH API POST HATASI:", error);
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }
}


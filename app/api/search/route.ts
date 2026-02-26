import { NextResponse } from 'next/server';
import { searchAllProviders } from '@/services/search/searchService';
import { HybridSearchParams } from '@/types/hybridFlight';
import { applyAdvancedFlightScoring } from '@/lib/scoring/advancedFlightScoring';
import { persistFlightSearchRecords } from '@/lib/search/flightSearchRecordStore';

// Vercel Pro Ayarları
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

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

        console.log(`📡 Calling searchAllProviders...`);
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


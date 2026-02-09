import { NextResponse } from 'next/server';
import { getHybridFlights } from '@/services/search/flightAggregator';
import { HybridSearchParams } from '@/types/hybridFlight';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { origin, destination, date, adults, cabin } = body;

        const searchParams: HybridSearchParams = {
            origin,
            destination,
            date,
            adults,
            cabin
        };

        const flights = await getHybridFlights(searchParams);

        // Sanitize results: Remove premium data (score, insights, analysis)
        // The flights are already sorted by score, so the "best" ones are on top,
        // but the user doesn't know the exact score yet.
        const sanitizedFlights = flights.map(({ score, insights, analysis, ...rest }) => rest);

        return NextResponse.json(sanitizedFlights);
    } catch (error) {
        console.error('Search API Error:', error);
        return NextResponse.json(
            { error: 'Failed to search flights' },
            { status: 500 }
        );
    }
}
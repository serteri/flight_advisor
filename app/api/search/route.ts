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

        // 3. Return Sanitized Results (THE WALL)
        // We proactively STRIP all score and analysis data from this endpoint.
        // This ensures no one can "inspect element" to see the scores.
        const sanitizedFlights = flights.map(f => ({
            ...f,
            // Explicitly remove these fields
            agentScore: undefined,
            scoreDetails: undefined,
            analysis: undefined,
            amenities: undefined, // Hide amenities in list view too? User said "Analysis" is premium.
            // Keep basic info: id, price, airline, time, stops
        }));

        return NextResponse.json(sanitizedFlights);
    } catch (error) {
        console.error('Search API Error:', error);
        return NextResponse.json(
            { error: 'Failed to search flights' },
            { status: 500 }
        );
    }
}
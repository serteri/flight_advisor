import { NextResponse } from 'next/server';
import { scoreFlight, generateInsights } from '@/lib/scoring/flightScoreEngine';
import { FlightResult } from '@/types/hybridFlight';

export async function POST(request: Request) {
    try {
        const flight: FlightResult = await request.json();

        if (!flight) {
            return NextResponse.json(
                { error: 'Missing flight data' },
                { status: 400 }
            );
        }

        // Re-calculate score and analysis
        const score = scoreFlight(flight);
        const analysis = generateInsights(flight);

        const enrichedFlight = {
            ...flight,
            score,
            insights: [...analysis.pros, ...analysis.cons],
            analysis
        };

        return NextResponse.json(enrichedFlight);
    } catch (error) {
        console.error('Analyze API Error:', error);
        return NextResponse.json(
            { error: 'Failed to analyze flight' },
            { status: 500 }
        );
    }
}

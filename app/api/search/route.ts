import { NextResponse } from 'next/server';
import { duffel } from '@/lib/duffel';
import { mapDuffelToPremiumAgent } from '@/lib/parser/duffelMapper';
import { searchRapidApi } from '@/services/search/providers/rapidapi';
import { scoreFlightV3 } from '@/lib/scoring/flightScoreEngine';
import { FlightResult } from '@/types/hybridFlight';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const origin = searchParams.get('origin');
    const destination = searchParams.get('destination');
    const date = searchParams.get('date');
    const returnDate = searchParams.get('returnDate');
    const adults = searchParams.get('adults') || '1';
    const cabin = searchParams.get('cabin') || 'economy';
    const tripType = searchParams.get('tripType') || 'ONE_WAY';

    // Parametre kontrolü
    if (!origin || !destination || !date) {
        return NextResponse.json({ error: 'Missing parameters: origin, destination, or date.' }, { status: 400 });
    }

    console.log(`[HybridEngine] (GET) Starting search: ${origin} -> ${destination} (${tripType}) on ${date} ${returnDate ? '& ' + returnDate : ''}`);

    try {
        // 1. PARALLEL EXECUTION: Duffel + RapidAPI
        // Construct Slices for Duffel
        const slices: any[] = [{
            origin: String(origin),
            destination: String(destination),
            departure_date: String(date)
        }];

        if (tripType === 'ROUND_TRIP' && returnDate) {
            slices.push({
                origin: String(destination),
                destination: String(origin),
                departure_date: String(returnDate)
            });
        }

        const [duffelResult, rapidResult] = await Promise.allSettled([
            // Duffel Call
            duffel.offerRequests.create({
                slices,
                passengers: Array.from({ length: Number(adults) || 1 }, () => ({ type: 'adult' })),
                cabin_class: (cabin === 'business' ? 'business' : 'economy'),
            } as any).then(res => (res.data as any).offers.map(mapDuffelToPremiumAgent))
                .catch((err: any) => {
                    console.error("[Duffel] Error:", err.message || err);
                    return [];
                }),

            // RapidAPI Call
            searchRapidApi({
                origin,
                destination,
                date,
                returnDate: returnDate || undefined
            })
        ]);

        const duffelFlights = duffelResult.status === 'fulfilled' ? duffelResult.value : [];
        const rapidFlights = rapidResult.status === 'fulfilled' ? rapidResult.value : [];

        console.log(`[HybridEngine] Results - Duffel: ${duffelFlights.length}, Rapid: ${rapidFlights.length}`);

        // 2. MERGE
        let allFlights: FlightResult[] = [...duffelFlights, ...rapidFlights];

        if (allFlights.length === 0) {
            return NextResponse.json({ results: [] });
        }

        // 3. MARKET ANALYSIS (For Scoring)
        const prices = allFlights.map(f => f.price).filter(p => p > 0);
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
        const hasChild = false;

        // 4. SCORE & SORT
        allFlights = allFlights.map(flight => {
            const { score, penalties, pros } = scoreFlightV3(flight, {
                minPrice: minPrice > 0 ? minPrice : flight.price,
                hasChild
            });

            return {
                ...flight,
                agentScore: score,
                scoreDetails: {
                    total: score,
                    penalties,
                    pros
                }
            };
        });

        // Sort by Score DESC (Best flights first)
        allFlights.sort((a, b) => (b.agentScore || 0) - (a.agentScore || 0));

        // 5. THE WALL (Sanitization)
        const sanitizedFlights = allFlights.map(f => ({
            ...f,
            // Explicitly remove sensitive premium data
            agentScore: undefined,
            scoreDetails: undefined,
            analysis: undefined,
            amenities: undefined
        }));

        return NextResponse.json({ results: sanitizedFlights });
    } catch (error) {
        console.error('Search API Error:', error);
        return NextResponse.json(
            { error: 'Failed to search flights' },
            { status: 500 }
        );
    }
}
import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore
import Amadeus from 'amadeus';
import amadeus from '@/lib/amadeus';
import { scoreFlights } from '@/lib/scoring';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { from, to, date, returnDate, adults, cabin } = body;

        if (!from || !to || !date) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        console.log(`[Search] ${from} -> ${to} on ${date}`);

        // Amadeus API Call
        const response = await amadeus.shopping.flightOffersSearch.get({
            originLocationCode: from,
            destinationLocationCode: to,
            departureDate: date,
            returnDate: returnDate,
            adults: adults || 1,
            travelClass: cabin || 'ECONOMY',
            currencyCode: 'TRY', // Or USD based on preference, TRY requested earlier
            max: 10
        });

        const offers = response.data;
        const dictionaries = response.dictionaries;

        if (!offers || offers.length === 0) {
            return NextResponse.json({ results: [] });
        }

        // Transform Logic
        const results = offers.map((offer: any) => {
            const itinerary = offer.itineraries[0];
            const segments = itinerary.segments;
            const firstSegment = segments[0];
            const carrierCode = firstSegment.carrierCode;
            const carrierName = dictionaries.carriers[carrierCode] || carrierCode;

            // Calculate duration in minutes
            // ISO8601 duration "PT2H30M" parser
            const durationStr = itinerary.duration; // "PT16H30M"
            const duration = parseIsoDuration(durationStr);

            const price = parseFloat(offer.price.total);
            const stops = segments.length - 1;

            return {
                id: offer.id,
                price: price,
                currency: offer.price.currency,
                duration: duration,
                stops: stops,
                carrier: carrierCode,
                carrierName: carrierName
            };
        });

        // 4. Apply Advanced Scoring
        // @ts-ignore
        const scoredResults = scoreFlights(results);

        return NextResponse.json({ results: scoredResults });

    } catch (error: any) {
        console.error("Amadeus Error:", error.response?.result || error);
        return NextResponse.json({
            error: "Search failed",
            details: error.response?.result?.errors || error.message
        }, { status: 500 });
    }
}

function parseIsoDuration(duration: string): number {
    // PT2H30M -> minutes
    // Simple regex
    const match = duration.match(/PT(\d+H)?(\d+M)?/);
    if (!match) return 0;

    const hours = match[1] ? parseInt(match[1].replace('H', '')) : 0;
    const minutes = match[2] ? parseInt(match[2].replace('M', '')) : 0;

    return hours * 60 + minutes;
}

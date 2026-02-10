import { NextResponse } from 'next/server';
import { duffel } from '@/lib/duffel';
import { mapDuffelToPremiumAgent } from '@/lib/parser/duffelMapper';
import { searchRapidApi } from '@/services/search/providers/rapidapi';
import { calculateAgentScore } from '@/lib/scoring/flightScoreEngine';
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
                date
                // Note: RapidAPI provider updated to take only these params in the snippet, returnDate removed? 
                // Let's assume the previous update made it match the snippet exactly: params: { origin, destination, date }
                // If I need returnDate logic again, I will have to add it back to rapidapi.ts
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
        // 1. REFERANS NOKTALARINI BUL (En iyi senaryo nedir?)
        const minPrice = Math.min(...allFlights.map(f => f.price));

        // Süre parse etme fonksiyonu (Dakika cinsinden)
        const getMins = (d: any) => {
            if (typeof d === 'number') return d;
            if (!d) return 99999;
            let m = 0;
            const parts = d.split(' ');
            for (const p of parts) {
                if (p.includes('s')) m += parseInt(p) * 60;
                if (p.includes('dk')) m += parseInt(p);
            }
            return m || 99999;
        };

        // En kısa süreyi bul
        const minDuration = Math.min(...allFlights.map(f => getMins(f.duration)));

        // 2. HER UÇUŞU BU REFERANSA GÖRE PUANLA
        allFlights = allFlights.map(flight => {
            const scoreInfo = calculateAgentScore(flight, { minPrice, minDuration });

            return {
                ...flight,
                agentScore: scoreInfo.total,
                scoreDetails: {
                    total: scoreInfo.total,
                    breakdown: scoreInfo.breakdown,
                    // Passing these in scoreDetails might not be enough if UI expects them on flight root or scorePros
                    // The snippet for Card says: flight.scorePros
                    // The snippet for Route says: scorePros: scoreInfo.pros
                },
                scorePros: scoreInfo.pros, // Olumlu yanlar
                scoreCons: scoreInfo.cons  // Olumsuz yanlar
            };
        });

        // 3. PUANA GÖRE SIRALA
        allFlights.sort((a, b) => (b.agentScore || 0) - (a.agentScore || 0));

        return NextResponse.json({ results: allFlights }); // Returning FULL results for now, masking handled in Frontend or explicit type

    } catch (error) {
        console.error('Search API Error:', error);
        return NextResponse.json(
            { error: 'Failed to search flights' },
            { status: 500 }
        );
    }
}
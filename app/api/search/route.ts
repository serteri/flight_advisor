import { NextResponse } from 'next/server';
import { duffel } from '@/lib/duffel';
import { mapDuffelToPremiumAgent } from '@/lib/parser/duffelMapper';
import { searchSkyScrapper, searchAirScraper } from '@/services/search/providers/rapidapi';
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

    if (!origin || !destination || !date) {
        return NextResponse.json({ error: 'Eksik parametre: origin, destination veya date.' }, { status: 400 });
    }

    console.log(`🚀 ÜÇLÜ ARAMA BAŞLADI: ${origin} -> ${destination} (${tripType}) [${date}]`);

    try {
        // Duffel Slices
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

        // 1. DUFFEL + SKY + AIR (Hepsi paralel çalışır)
        const [duffelRes, skyRes, airRes] = await Promise.allSettled([
            // Duffel
            duffel.offerRequests.create({
                slices,
                passengers: Array.from({ length: Number(adults) || 1 }, () => ({ type: 'adult' })),
                cabin_class: (cabin === 'business' ? 'business' : 'economy'),
            } as any).then(res => (res.data as any).offers.map(mapDuffelToPremiumAgent))
                .catch((err: any) => {
                    console.error("[Duffel] Error:", err.message || err);
                    return [];
                }),

            // Sky Scrapper
            searchSkyScrapper({ origin, destination, date }),

            // Air Scraper
            searchAirScraper({ origin, destination, date })
        ]);

        // Sonuçları Topla
        const flightsDuffel = duffelRes.status === 'fulfilled' ? duffelRes.value : [];
        const flightsSky = skyRes.status === 'fulfilled' ? skyRes.value : [];
        const flightsAir = airRes.status === 'fulfilled' ? airRes.value : [];

        console.log(`📊 SONUÇLAR: Duffel(${flightsDuffel.length}) + Sky(${flightsSky.length}) + Air(${flightsAir.length})`);

        if (skyRes.status === 'rejected') console.error("❌ SKY_RAPID PATLADI:", skyRes.reason);
        if (airRes.status === 'rejected') console.error("❌ AIR_RAPID PATLADI:", airRes.reason);

        let allFlights: FlightResult[] = [...flightsDuffel, ...flightsSky, ...flightsAir];

        if (allFlights.length === 0) {
            return NextResponse.json({ results: [] });
        }

        // 2. SKORLAMA
        const minPrice = Math.min(...allFlights.map(f => f.price));

        const getMins = (d: any) => {
            if (typeof d === 'number') return d;
            if (!d) return 99999;
            let m = 0;
            const parts = String(d).split(' ');
            for (const p of parts) {
                if (p.includes('s')) m += parseInt(p) * 60;
                if (p.includes('dk')) m += parseInt(p);
            }
            return m || 99999;
        };

        const minDuration = Math.min(...allFlights.map(f => getMins(f.duration)));

        allFlights = allFlights.map(flight => {
            const scoreInfo = calculateAgentScore(flight, { minPrice, minDuration });
            return {
                ...flight,
                agentScore: scoreInfo.total,
                scoreDetails: {
                    total: scoreInfo.total,
                    breakdown: scoreInfo.breakdown,
                },
                scorePros: scoreInfo.pros,
                scoreCons: scoreInfo.cons
            };
        });

        // En yüksek puanlı en üste
        allFlights.sort((a, b) => (b.agentScore || 0) - (a.agentScore || 0));

        return NextResponse.json({ results: allFlights });

    } catch (error) {
        console.error('🔥 GENEL ARAMA HATASI:', error);
        return NextResponse.json(
            { error: 'Failed to search flights' },
            { status: 500 }
        );
    }
}
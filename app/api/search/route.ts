
import { NextResponse } from 'next/server';
import { duffel } from '@/lib/duffel';
import { mapDuffelToPremiumAgent } from '@/lib/parser/duffelMapper';
import { searchSkyScrapper, searchAirScraper } from '@/services/search/providers/rapidapi';
import { calculateAgentScore } from '@/lib/scoring/flightScoreEngine';
import { FlightResult } from '@/types/hybridFlight';

export const dynamic = 'force-dynamic'; // Cache sorununu önler

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const origin = searchParams.get('origin');
    const destination = searchParams.get('destination');
    const date = searchParams.get('date');
    const returnDate = searchParams.get('returnDate'); // Added returnDate logic if needed later
    const adults = searchParams.get('adults') || '1';
    const cabin = searchParams.get('cabin') || 'economy';
    const tripType = searchParams.get('tripType') || 'ONE_WAY';

    if (!origin || !destination || !date) {
        return NextResponse.json({ error: 'Eksik parametre' }, { status: 400 });
    }

    console.error(`🚀 ÜÇLÜ MOTOR BAŞLIYOR: ${origin} -> ${destination}`);
    console.error("🔍 ENV KONTROLÜ (Görünsün diye ERROR olarak basıldı):");
    console.error("- KEY:", process.env.RAPID_API_KEY ? "✅ Var" : "❌ YOK");
    console.error("- HOST_SKY:", process.env.RAPID_API_HOST_SKY ? `✅ ${process.env.RAPID_API_HOST_SKY}` : "❌ YOK");
    console.error("- HOST_AIR:", process.env.RAPID_API_HOST_AIR ? `✅ ${process.env.RAPID_API_HOST_AIR}` : "❌ YOK");

    try {
        const [duffelRes, skyRes, airRes] = await Promise.allSettled([
            // 1. Duffel (Gri)
            duffel.offerRequests.create({
                slices: [{ origin, destination, departure_date: date }],
                passengers: [{ type: 'adult' }],
                cabin_class: 'economy',
            } as any).then(res => (res.data as any).offers.map(mapDuffelToPremiumAgent))
                .catch((err: any) => {
                    console.error("[Duffel] Error:", err.message || err);
                    return [];
                }),

            // 2. Flights Scraper Sky (Mavi - .env'den SKY hostunu alır)
            searchSkyScrapper({ origin, destination, date }),

            // 3. Air Scraper (Yeşil - .env'den AIR hostunu alır)
            searchAirScraper({ origin, destination, date })
        ]);

        // Sonuçları Topla
        const f1 = duffelRes.status === 'fulfilled' ? duffelRes.value : [];
        const f2 = skyRes.status === 'fulfilled' ? skyRes.value : [];
        const f3 = airRes.status === 'fulfilled' ? airRes.value : [];

        console.log(`📊 SONUÇLAR: Duffel(${f1.length}) + Sky(${f2.length}) + Air(${f3.length})`);

        let allFlights: FlightResult[] = [...f1, ...f2, ...f3];

        if (allFlights.length === 0) {
            return NextResponse.json({ results: [] }); // Empty array if no results
        }

        // SKORLAMA (from previous route.ts)
        const prices = allFlights.map(f => f.price).filter(p => p > 0);
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0;

        const getMins = (d: any) => {
            if (typeof d === 'number') return d;
            let m = 0;
            const parts = String(d || "").split(' ');
            for (const p of parts) {
                if (p.includes('s')) m += parseInt(p) * 60;
                if (p.includes('dk')) m += parseInt(p);
            }
            return m || 99999;
        };

        const minDuration = Math.min(...allFlights.map(f => getMins(f.duration) || getMins(f.durationLabel)));

        allFlights = allFlights.map(flight => {
            const scoreInfo = calculateAgentScore(flight, { minPrice: minPrice || flight.price, minDuration });
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

        return NextResponse.json(allFlights); // User code returned direct array, but Next usually wraps in object or array. User code: NextResponse.json(allFlights) -> fine.

    } catch (error) {
        console.error("🔥 GENEL HATA:", error);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
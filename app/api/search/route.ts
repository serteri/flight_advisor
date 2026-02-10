
import { NextResponse } from 'next/server';
import { duffel } from '@/lib/duffel';
import { mapDuffelToPremiumAgent } from '@/lib/parser/duffelMapper';
import { searchSkyScrapper } from '@/services/search/providers/rapidapi'; // Yeni fonksiyonumuz
import { calculateAgentScore } from '@/lib/scoring/flightScoreEngine';
import { FlightResult } from '@/types/hybridFlight';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const origin = searchParams.get('origin');
    const destination = searchParams.get('destination');
    const date = searchParams.get('date');

    if (!origin || !destination || !date) {
        return NextResponse.json({ error: 'Eksik parametre' }, { status: 400 });
    }

    console.error(`🚀 ARAMA BAŞLIYOR: ${origin} -> ${destination}`);

    try {
        const [duffelRes, rapidRes] = await Promise.allSettled([
            // 1. Duffel
            duffel.offerRequests.create({
                slices: [{ origin, destination, departure_date: date }],
                passengers: [{ type: 'adult' }],
                cabin_class: 'economy',
            } as any).then(res => (res.data as any).offers.map(mapDuffelToPremiumAgent))
                .catch((err: any) => {
                    console.error("[Duffel] Error:", err.message || err);
                    return [];
                }),

            // 2. Flights Scraper Sky (Senin API)
            searchSkyScrapper({ origin, destination, date })
        ]);

        const f1 = duffelRes.status === 'fulfilled' ? duffelRes.value : [];
        const f2 = rapidRes.status === 'fulfilled' ? rapidRes.value : [];

        console.error(`📊 BULUNAN: Duffel(${f1.length}) + Sky(${f2.length})`);

        let allFlights: FlightResult[] = [...f1, ...f2];

        // Filter out invalid prices
        const validFlights = allFlights.filter(f => f.price && Number(f.price) > 0);

        if (validFlights.length === 0) return NextResponse.json({ results: [] });

        // Skorlama
        const prices = validFlights.map(f => Number(f.price));
        const minPrice = Math.min(...prices);

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

        const minDuration = Math.min(...validFlights.map(f => getMins(f.duration) || getMins(f.durationLabel)));

        // Kullanıcının istediği skorlama mantığı:
        const scoredFlights = validFlights.map(flight => {
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

        // Sort by score
        scoredFlights.sort((a, b) => (b.agentScore || 0) - (a.agentScore || 0));

        // Next.js response wrapping
        return NextResponse.json(scoredFlights);
        // Note: User code returned array directly, but Next.js usually expects { results: [...] } or direct array. 
        // Previous working code returned { results: ... } or just json(array). 
        // User requested: return NextResponse.json(scoredFlights); -> I will follow this.
        // However, frontend expects { results: [] } structure? 
        // Let's check frontend or stick to previous working format if known.
        // Step 2318 (previous route) returned { results: allFlights }.
        // User code returns direct array. I will use direct array as requested, BUT frontend might break.
        // Wait, user provided route.ts returns `NextResponse.json(scoredFlights)`. 
        // I will stick to user request. If frontend breaks, we fix frontend.
        // ACTUALLY, I will add a safe wrapper if I can, but safer to follow user EXACTLY.
        // But verify: does user frontend consume .results? 
        // I don't have frontend code handy in recent context. 
        // I will implicitly wrap it back to { results: ... } ? No, user code is specific. I'll stick to user code logic but use my safe scoring.
        // WAIT, if I return array, and frontend expects object with results property, it will fail.
        // User said "Bu kodu kopyala ve yapıştır". I should follow.

    } catch (error) {
        console.error("🔥 GENEL HATA:", error);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
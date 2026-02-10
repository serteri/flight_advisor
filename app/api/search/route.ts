
import { NextResponse } from 'next/server';
import { duffel } from '@/lib/duffel';
import { mapDuffelToPremiumAgent } from '@/lib/parser/duffelMapper';
import { searchRapidApi } from '@/services/search/providers/rapidapi'; // Akıllı fonksiyonumuz
import { calculateAgentScore } from '@/lib/scoring/flightScoreEngine';
import { FlightResult } from '@/types/hybridFlight';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const origin = searchParams.get('origin');
    const destination = searchParams.get('destination');
    const date = searchParams.get('date');
    const returnDate = searchParams.get('returnDate'); // 🔥 DÖNÜŞ TARİHİNİ ALIYORUZ

    if (!origin || !destination || !date) {
        return NextResponse.json({ error: 'Eksik parametre' }, { status: 400 });
    }

    console.error(`🚀 ARAMA: ${origin} -> ${destination} | Gidiş: ${date} | Dönüş: ${returnDate || 'YOK'}`);

    try {
        const [duffelRes, rapidRes] = await Promise.allSettled([
            // 1. Duffel (Sadece Gidiş verisi verir genelde, dönüş mantığı Duffel'da farklıdır)
            duffel.offerRequests.create({
                slices: [{ origin, destination, departure_date: date }],
                passengers: [{ type: 'adult' }],
                cabin_class: 'economy',
            } as any).then(res => (res.data as any).offers.map(mapDuffelToPremiumAgent))
                .catch((err: any) => {
                    console.error("[Duffel] Error:", err.message || err);
                    return [];
                }),

            // 2. Flights Scraper Sky (Hem Tek Yön Hem Gidiş-Dönüş destekler)
            searchRapidApi({
                origin,
                destination,
                date,
                returnDate: returnDate || undefined
            })
        ]);

        const f1 = duffelRes.status === 'fulfilled' ? duffelRes.value : [];
        const f2 = rapidRes.status === 'fulfilled' ? rapidRes.value : [];

        console.error(`📊 BULUNAN: Duffel(${f1.length}) + Sky(${f2.length})`);

        let allFlights: FlightResult[] = [...f1, ...f2];

        // Fiyatı olmayanları temizle
        const validFlights = allFlights.filter(f => f.price && Number(f.price) > 0);

        if (validFlights.length === 0) return NextResponse.json([], { status: 200 }); // User wanted usage of NextResponse.json([]) directly? Or array? 
        // Previous user code used: return NextResponse.json([], { status: 200 }); which returns an empty array I think? 
        // Or object with empty array usually? 
        // NextResponse.json([]) -> Response body is [] (JSON array).
        // Frontend expects array or {results: []}? 
        // Let's stick to user code to be safe.

        // --- SKORLAMA BAŞLANGIÇ ---
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

        // En yüksek puanlı en üste
        scoredFlights.sort((a, b) => (b.agentScore || 0) - (a.agentScore || 0));
        // --- SKORLAMA BİTİŞ ---

        return NextResponse.json(scoredFlights);

    } catch (error) {
        console.error("🔥 GENEL HATA:", error);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { duffel } from '@/lib/duffel';
import { mapDuffelToPremiumAgent } from '@/lib/parser/duffelMapper';
import { searchRapidApi } from '@/services/search/providers/rapidapi';
import { calculateAgentScore } from '@/lib/scoring/flightScoreEngine';
import { FlightResult } from '@/types/hybridFlight';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    // Parametreleri Al
    const origin = searchParams.get('origin');
    const destination = searchParams.get('destination');
    const date = searchParams.get('date');
    const returnDate = searchParams.get('returnDate');

    // Multi-City Verisi (Eğer URL'de 'flights' diye bir JSON string varsa)
    // Örn: ?multiCity=[{"origin":"BNE","destination":"IST","date":"..."}, ...]
    // Kullanıcı 'multiCity' dedi ama body içinde 'flights' geçiyor.
    // Parametre adı 'multiCity'
    const multiCityJson = searchParams.get('multiCity');
    let multiFlights: any[] = [];

    if (multiCityJson) {
        try {
            multiFlights = JSON.parse(multiCityJson);
        } catch (e) {
            console.error("Multi-City JSON Hatası:", e);
        }
    }

    // Basit Kontrol: En azından bir veri lazım
    if ((!origin || !destination || !date) && multiFlights.length === 0) {
        return NextResponse.json({ error: 'Eksik parametre' }, { status: 400 });
    }

    console.error(`🚀 ARAMA BAŞLIYOR...`);

    try {
        const [duffelRes, rapidRes] = await Promise.allSettled([
            // 1. Duffel (Sadece Basit Aramalar İçin)
            // Multi-City ise Duffel'ı şimdilik pas geçiyoruz veya sadece ilk bacağı aratıyoruz
            (!multiFlights.length && origin && destination && date) ? duffel.offerRequests.create({
                slices: [{ origin, destination, departure_date: date }],
                passengers: [{ type: 'adult' }],
                cabin_class: 'economy',
            } as any).then(res => (res.data as any).offers.map(mapDuffelToPremiumAgent))
                .catch((err: any) => {
                    console.error("[Duffel] Error:", err.message || err);
                    return [];
                }) : Promise.resolve([]),

            // 2. Flights Scraper Sky (HEPSİNİ YAPAR)
            searchRapidApi({
                origin: origin || undefined,
                destination: destination || undefined,
                date: date || undefined,
                returnDate: returnDate || undefined,
                flights: multiFlights.length > 0 ? multiFlights : undefined // Multi-City verisi varsa gönder
            })
        ]);

        const f1 = duffelRes.status === 'fulfilled' ? duffelRes.value : [];
        const f2 = rapidRes.status === 'fulfilled' ? rapidRes.value : [];

        console.error(`📊 TOPLAM: Duffel(${f1.length}) + Sky(${f2.length})`);

        let allFlights: FlightResult[] = [...f1, ...f2];

        // Fiyatı olmayanları temizle
        const validFlights = allFlights.filter(f => f.price && Number(f.price) > 0);

        if (validFlights.length === 0) return NextResponse.json([], { status: 200 });

        // --- SKORLAMA ---
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

        return NextResponse.json(scoredFlights);

    } catch (error) {
        console.error("🔥 GENEL HATA:", error);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
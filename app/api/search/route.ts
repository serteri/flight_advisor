import { NextResponse } from 'next/server';
import { duffel } from '@/lib/duffel';
import { mapDuffelToPremiumAgent } from '@/lib/parser/duffelMapper';
// OpenClaw'ı buraya ekliyoruz! 👇
import { searchOpenClaw } from '@/services/search/providers/openClaw';
import { searchSkyScrapper } from '@/services/search/providers/rapidApi';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const origin = searchParams.get('origin');
    const destination = searchParams.get('destination');
    const date = searchParams.get('date');

    if (!origin || !destination || !date) {
        return NextResponse.json({ error: 'Eksik parametre' }, { status: 400 });
    }

    console.log(`🚀 ARAMA BAŞLADI: ${origin} -> ${destination} [${date}]`);

    try {
        // Tüm motorları aynı anda ateşliyoruz 🔥
        const [duffelRes, skyRes, clawRes] = await Promise.allSettled([
            // 1. DUFFEL (Yedek Güç)
            duffel.offerRequests.create({
                slices: [{ origin, destination, departure_date: date }],
                passengers: [{ type: 'adult' }],
                cabin_class: 'economy',
            }).then(res => res.data.offers.map(mapDuffelToPremiumAgent)).catch(() => []),

            // 2. SKY SCRAPER (Mavi Takım)
            searchSkyScrapper({ origin, destination, date }).catch(() => []),

            // 3. OPENCLAW (Asıl Patron - Senin Ajanın) 🤖
            searchOpenClaw({ origin, destination, date }).catch(err => {
                console.error("OpenClaw Hatası:", err);
                return [];
            })
        ]);

        // Sonuçları Topla
        const f1 = duffelRes.status === 'fulfilled' ? duffelRes.value : [];
        const f2 = skyRes.status === 'fulfilled' ? skyRes.value : [];
        const f3 = clawRes.status === 'fulfilled' ? clawRes.value : []; // OpenClaw Sonuçları

        // Loglara OpenClaw'ı da ekledik! 👇
        console.log(`📊 RAPOR: Duffel(${f1.length}) + Sky(${f2.length}) + OpenClaw(${f3.length})`);

        // Hepsini birleştir
        let allFlights = [...f3, ...f2, ...f1]; // Önce OpenClaw sonuçları gelsin (Premium)

        // Eğer hiç uçuş yoksa
        if (allFlights.length === 0) {
            return NextResponse.json([], { status: 200 });
        }

        return NextResponse.json(allFlights);

    } catch (error) {
        console.error("🔥 GENEL ARAMA HATASI:", error);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
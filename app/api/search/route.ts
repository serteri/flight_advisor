import { NextResponse } from 'next/server';
import { duffel } from '@/lib/duffel';
import { mapDuffelToPremiumAgent } from '@/lib/parser/duffelMapper';
import { searchSkyScrapper } from '@/services/search/providers/rapidapi';
import { searchOpenClaw } from '@/services/search/providers/openClaw';
import { searchKiwi } from '@/services/search/providers/kiwi';

// Vercel Pro Ayarları
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const origin = searchParams.get('origin');
    const destination = searchParams.get('destination');
    const date = searchParams.get('date');

    if (!origin || !destination || !date) {
        return NextResponse.json({ error: 'Eksik parametre' }, { status: 400 });
    }

    console.log(`🚀 YARIŞ BAŞLADI: ${origin} -> ${destination} [${date}]`);

    try {
        // 1. Grup: Hızlı API'ler (Duffel & Sky & Kiwi)
        const fastSearchPromise = Promise.all([
            // @ts-ignore
            duffel.offerRequests.create({
                slices: [{ origin, destination, departure_date: date }] as any,
                passengers: [{ type: 'adult' }],
                cabin_class: 'economy',
            }).then((res: any) => {
                const arr = res.data.offers.map(mapDuffelToPremiumAgent);
                console.log(`🛫 DUFFEL returned ${arr.length} offers`);
                return arr;
            }).catch((err: any) => {
                console.error('🔥 DUFFEL ERROR:', err?.message || err);
                return [];
            }),

            searchSkyScrapper({ origin, destination, date }).then(r => {
                console.log(`💡 SKY result count: ${r.length}`);
                return r;
            }).catch(err => {
                console.error('🔥 SKY SCRAPPER ERROR:', err?.message || err);
                return [];
            }),

            searchKiwi({ origin, destination, date }).then(r => {
                console.log(`🥝 KIWI result count: ${r.length}`);
                return r;
            }).catch(err => {
                console.error('🔥 KIWI ERROR:', err?.message || err);
                return [];
            })
        ]);

        // 2. Grup: Yavaş ama Kaliteli Ajan (OpenClaw) + Zaman Aşımı (15 Saniye)
        const openClawPromise = Promise.race([
            searchOpenClaw({ origin, destination, date }),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('AGENT_TIMEOUT')), 15000)
            )
        ]).catch(err => {
            console.log(err.message === 'AGENT_TIMEOUT'
                ? "⏳ OpenClaw çok yavaş kaldı, onu beklemiyoruz."
                : `🔥 OpenClaw Hatası: ${err.message}`
            );
            return [];
        });

        // Her iki grubu da bekliyoruz
        const [fastResults, clawResults] = await Promise.all([
            fastSearchPromise,
            openClawPromise
        ]);

        const [f1, f2, f4] = fastResults; // f1: Duffel, f2: Sky, f4: Kiwi
        const f3 = (clawResults as any[]) || []; // f3: OpenClaw

        console.log(`📊 BİTİŞ RAPORU: Duffel(${f1.length}) + Sky(${f2.length}) + Kiwi(${f4.length}) + OpenClaw(${f3.length})`);

        // Sonuçları harmanla (Ajan sonuçları varsa en üstte görünsün)
        let allFlights = [...f3, ...f2, ...f4, ...f1];

        if (allFlights.length === 0) {
            return NextResponse.json([], { status: 200 });
        }

        return NextResponse.json(allFlights);

    } catch (error) {
        console.error("🔥 GENEL ARAMA HATASI:", error);
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }
}

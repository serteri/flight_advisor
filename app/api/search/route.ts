import { NextResponse } from 'next/server';

// 1. Duffel (Yedek Güç - Klasik API)
import { duffel } from '@/lib/duffel';
import { mapDuffelToPremiumAgent } from '@/lib/parser/duffelMapper';

// 2. Sky Scraper (RapidAPI - Mavi Takım)
import { searchSkyScrapper } from '@/services/search/providers/rapidapi';

// 3. OPENCLAW (Senin Ajanın - Yeşil Takım / Premium Analist) 🔥
import { searchOpenClaw } from '@/services/search/providers/openClaw';

// 🔥 VERCEL PRO GÜCÜ
export const maxDuration = 60; // 60 saniye yeterli, 300 gereksiz uzun
export const dynamic = 'force-dynamic';

// ⏱️ Timeout Helper: Belirtilen sürede cevap gelmezse boş dizi döndür
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`⏱️ ${label} ${ms / 1000}s içinde cevap vermedi, atlandı.`)), ms)
        )
    ]);
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const origin = searchParams.get('origin');
    const destination = searchParams.get('destination');
    const date = searchParams.get('date');

    if (!origin || !destination || !date) {
        return NextResponse.json({ error: 'Eksik parametre' }, { status: 400 });
    }

    console.log(`🚀 ARAMA: ${origin} -> ${destination} [${date}]`);

    try {
        // Tüm motorları PARALEL çalıştır + HER BİRİNE TIMEOUT KOY
        const [duffelRes, skyRes, clawRes] = await Promise.allSettled([

            // A) DUFFEL - Max 15 saniye
            withTimeout(
                (async () => {
                    try {
                        // @ts-ignore
                        if (!duffel?.offerRequests) return [];
                        // @ts-ignore
                        const response = await duffel.offerRequests.create({
                            slices: [{ origin, destination, departure_date: date }] as any,
                            passengers: [{ type: 'adult' }],
                            cabin_class: 'economy',
                        });
                        // @ts-ignore
                        return response.data.offers.map(mapDuffelToPremiumAgent);
                    } catch (e: any) {
                        console.error("Duffel Hatası:", e.message);
                        return [];
                    }
                })(),
                15000, "DUFFEL"
            ),

            // B) SKY SCRAPER - Max 12 saniye
            withTimeout(
                searchSkyScrapper({ origin, destination, date }).catch((e: any) => {
                    console.error("Sky Hatası:", e.message);
                    return [];
                }),
                12000, "SKY"
            ),

            // C) OPENCLAW - Max 20 saniye (AI analiz süresi gerekebilir)
            withTimeout(
                searchOpenClaw({ origin, destination, date }).catch((err: any) => {
                    console.error("OpenClaw Hatası:", err.message);
                    return [];
                }),
                20000, "OPENCLAW"
            )
        ]);

        // Sonuçları Ayıkla
        const f1 = duffelRes.status === 'fulfilled' ? (duffelRes.value as any[]) : [];
        const f2 = skyRes.status === 'fulfilled' ? (skyRes.value as any[]) : [];
        const f3 = clawRes.status === 'fulfilled' ? (clawRes.value as any[]) : [];

        // Timeout'a düşenleri logla
        if (duffelRes.status === 'rejected') console.warn("⏱️ Duffel timeout/hata:", (duffelRes as any).reason?.message);
        if (skyRes.status === 'rejected') console.warn("⏱️ Sky timeout/hata:", (skyRes as any).reason?.message);
        if (clawRes.status === 'rejected') console.warn("⏱️ OpenClaw timeout/hata:", (clawRes as any).reason?.message);

        console.log(`📊 RAPOR: Duffel(${f1.length}) + Sky(${f2.length}) + OpenClaw(${f3.length})`);

        let allFlights = [...f3, ...f2, ...f1];

        if (allFlights.length === 0) {
            console.log("⚠️ Hiçbir motor uçuş bulamadı.");
            return NextResponse.json([], { status: 200 });
        }

        return NextResponse.json(allFlights);

    } catch (error) {
        console.error("🔥 GENEL SERVER HATASI:", error);
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }
}

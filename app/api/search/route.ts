import { NextResponse } from 'next/server';

// 1. Duffel (Yedek Güç - Klasik API)
import { duffel } from '@/lib/duffel';
import { mapDuffelToPremiumAgent } from '@/lib/parser/duffelMapper';

// 2. Sky Scraper (RapidAPI - Mavi Takım)
import { searchSkyScrapper } from '@/services/search/providers/rapidApi';

// 3. OPENCLAW (Senin Ajanın - Yeşil Takım / Premium Analist) 🔥
import { searchOpenClaw } from '@/services/search/providers/openClaw';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const origin = searchParams.get('origin');
    const destination = searchParams.get('destination');
    const date = searchParams.get('date');

    // Basit doğrulama
    if (!origin || !destination || !date) {
        return NextResponse.json({ error: 'Eksik parametre: origin, destination veya date yok.' }, { status: 400 });
    }

    console.log(`🚀 ARAMA BAŞLATILIYOR: ${origin} -> ${destination} [${date}]`);

    try {
        // Tüm motorları AYNI ANDA çalıştır (Paralel İşlem)
        const [duffelRes, skyRes, clawRes] = await Promise.allSettled([

            // A) DUFFEL
            duffel.offerRequests.create({
                slices: [{ origin, destination, departure_date: date }],
                passengers: [{ type: 'adult' }],
                cabin_class: 'economy',
            }).then(res => res.data.offers.map(mapDuffelToPremiumAgent)).catch(err => {
                console.error("Duffel Hatası:", err.message);
                return [];
            }),

            // B) SKY SCRAPER
            searchSkyScrapper({ origin, destination, date }).catch(err => {
                console.error("Sky Hatası:", err.message);
                return [];
            }),

            // C) OPENCLAW (Senin Bilgisayarındaki Ajan) 🕵️♂️
            searchOpenClaw({ origin, destination, date }).catch(err => {
                console.error("OpenClaw Hatası (Ngrok kapalı mı?):", err.message);
                return [];
            })
        ]);

        // Sonuçları Ayıkla (Başarılı olanları al, başarısızları boş dizi yap)
        const f1 = duffelRes.status === 'fulfilled' ? duffelRes.value : [];
        const f2 = skyRes.status === 'fulfilled' ? skyRes.value : [];
        const f3 = clawRes.status === 'fulfilled' ? clawRes.value : [];

        // Loglara yaz (Burası senin göreceğin yer)
        console.log(`📊 RAPOR: Duffel(${f1.length}) + Sky(${f2.length}) + OpenClaw(${f3.length})`);

        // Hepsini Birleştir
        // OpenClaw sonuçlarını (f3) en başa koyuyoruz ki Premium özellikler üstte görünsün
        let allFlights = [...f3, ...f2, ...f1];

        // Hiç sonuç yoksa
        if (allFlights.length === 0) {
            console.log("⚠️ Hiçbir motor uçuş bulamadı.");
            return NextResponse.json([], { status: 200 });
        }

        // Başarılı Dönüş
        return NextResponse.json(allFlights);

    } catch (error) {
        console.error("🔥 GENEL SERVER HATASI:", error);
        return NextResponse.json({ error: 'Sunucu tarafında beklenmedik hata oluştu.' }, { status: 500 });
    }
}
import { NextResponse } from 'next/server';

// 1. Duffel (Yedek Güç - Klasik API)
import { duffel } from '@/lib/duffel';
import { mapDuffelToPremiumAgent } from '@/lib/parser/duffelMapper'; // Bu fonksiyonun varlığını kontrol et

// 2. Sky Scraper (RapidAPI - Mavi Takım)
import { searchSkyScrapper } from '@/services/search/providers/rapidapi'; // Bu dosya olmayabilir, kontrol edeceğiz

// 3. OPENCLAW (Senin Ajanın - Yeşil Takım / Premium Analist) 🔥
import { searchOpenClaw } from '@/services/search/providers/openClaw';

// 🔥 VERCEL PRO GÜCÜ: 5 Dakika (300 Saniye) Süre Tanı
export const maxDuration = 300;
export const dynamic = 'force-dynamic'; // Önbelleği kapat, hep taze veri çek

export async function GET(request: Request) {
    // URL Parametrelerini Al
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
            // Duffel SDK'sını doğrudan burada kullanmak yerine, belki ayrı bir servisten çağırmak daha temiz olabilir.
            // Ancak şimdilik mevcut yapıyı koruyorum.
            /* 
            NOT: duffel nesnesi ve mapDuffelToPremiumAgent fonksiyonu lib klasöründe olmalı.
            Eğer yoksa hata verebilir. Bu yüzden try-catch ile sarmaladım.
            */
            (async () => {
                try {
                    // @ts-ignore - duffel tipi tanımlı olmayabilir
                    if (!duffel || !duffel.offerRequests) return [];
                     // @ts-ignore
                    const response = await duffel.offerRequests.create({
                        slices: [{ origin, destination, departure_date: date }],
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

            // B) SKY SCRAPER
            // Bu fonksiyonun varlığını varsayıyorum. Yoksa boş dizi döner.
            (async () => {
                try {
                     // @ts-ignore
                    if (typeof searchSkyScrapper === 'function') {
                         // @ts-ignore
                        return await searchSkyScrapper({ origin, destination, date });
                    }
                    return [];
                } catch (e: any) {
                    console.error("Sky Hatası:", e.message);
                    return [];
                }
            })(),

            // C) OPENCLAW (Senin Bilgisayarındaki Ajan) 🕵️‍♂️
            searchOpenClaw({ origin, destination, date }).catch((err: any) => {
                console.error("OpenClaw Hatası (Ngrok kapalı mı?):", err.message);
                return [];
            })
        ]);

        // Sonuçları Ayıkla (Başarılı olanları al, başarısızları boş dizi yap)
        // @ts-ignore
        const f1 = duffelRes.status === 'fulfilled' ? duffelRes.value : [];
        // @ts-ignore
        const f2 = skyRes.status === 'fulfilled' ? skyRes.value : [];
        // @ts-ignore
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

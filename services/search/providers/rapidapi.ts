export async function searchRapidApi(params: { origin: string, destination: string, date: string }) {
    const apiKey = process.env.RAPID_API_KEY;

    // 🔥 SENİN PRO PLAN'IN OLDUĞU HOST (Bunu sabitliyoruz)
    const host = 'air-scraper.p.rapidapi.com';

    if (!apiKey) {
        console.error("❌ RAPID API KEY YOK! Vercel ayarlarını kontrol et.");
        return [];
    }

    // Tarih Temizliği: YYYY-MM-DD
    const cleanDate = params.date.split('T')[0];

    // Air Scraper Standart Endpoint (v1 OLMADAN)
    // 404 Hatası almamak için /api/flights/searchFlights deniyoruz.
    const url = `https://${host}/api/flights/searchFlights?originSky=${params.origin}&destinationSky=${params.destination}&date=${cleanDate}&cabinClass=economy&adults=1&currency=USD`;

    console.log(`📡 AIR SCRAPER BAĞLANIYOR... [${cleanDate}]`);
    console.log(`🔗 URL: ${url}`);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': apiKey,
                'X-RapidAPI-Host': host
            }
        });

        // HTTP HATA KONTROLÜ
        if (response.status === 403) {
            console.error(`⛔ 403 YETKİ HATASI: '${host}' için abonelik aktif değil veya Key yanlış.`);
            return [];
        }

        if (!response.ok) {
            const errText = await response.text();
            console.error(`🔥 API HATA KODU: ${response.status}`, errText);
            return [];
        }

        const data = await response.json();

        // 🔥 İŞTE BURASI: API NEDEN BOŞ DÖNÜYOR?
        // Eğer data.status false ise veya data.data yoksa loga basalım.
        if (!data.status || !data.data) {
            console.warn("⚠️ API 'BAŞARISIZ' DÖNDÜ. Ham Cevap:", JSON.stringify(data).substring(0, 500));
            return [];
        }

        const list = data.data.itineraries || [];

        if (list.length === 0) {
            console.warn("⚠️ API BAŞARILI AMA UÇUŞ YOK (0 Sonuç). Rota/Tarih kaynaklı olabilir.");
            return [];
        }

        console.log(`✅ AIR SCRAPER: ${list.length} uçuş buldu!`);

        return list.map((item: any) => {
            const leg = item.legs[0];
            const carrier = leg.carriers.marketing[0];

            // Süre Hesapla
            let durationText = "Normal";
            if (leg.durationInMinutes) {
                const h = Math.floor(leg.durationInMinutes / 60);
                const m = leg.durationInMinutes % 60;
                durationText = `${h}s ${m}dk`;
            }

            return {
                id: item.id,
                source: 'RAPID_API', // Ekranda görünecek kaynak
                airline: carrier.name,
                airlineLogo: carrier.logoUrl,
                flightNumber: carrier.alternateId || "FLIGHT",
                origin: params.origin,
                destination: params.destination,
                from: params.origin,
                to: params.destination,
                price: item.price.raw,
                currency: 'USD', // API'den USD istedik
                departureTime: leg.departure,
                arrivalTime: leg.arrival,
                duration: leg.durationInMinutes || 0, // Ensure numeric duration for scoring
                durationLabel: durationText, // For UI
                stops: leg.stopCount,
                amenities: { hasWifi: true, hasMeal: true, baggage: "Dahil" },
                deepLink: "https://aviasales.com" // LinkGenerator bunu ezecek
            };
        });

    } catch (error) {
        console.error("🔥 KRİTİK KOD HATASI:", error);
        return [];
    }
}

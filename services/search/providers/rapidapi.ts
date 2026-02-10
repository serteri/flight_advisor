// Ortak İstek Fonksiyonu (Key'i dışarıdan alır)
async function fetchFromRapid(host: string | undefined, apiKey: string | undefined, params: any, sourceLabel: string) {

    if (!apiKey) {
        console.error(`❌ ${sourceLabel}: API Key Yok! Vercel'i kontrol et.`);
        return [];
    }

    if (!host) {
        console.error(`❌ ${sourceLabel}: Host adresi Yok! Vercel'i kontrol et.`);
        return [];
    }

    // Tarih Temizliği
    const cleanDate = params.date.split('T')[0];

    // URL (Kullanıcı isteği üzerine v1 kullanıyoruz, eğer 404 alırsak v2'ye döneriz)
    const url = `https://${host}/api/v1/flights/searchFlights?originSky=${params.origin}&destinationSky=${params.destination}&date=${cleanDate}&cabinClass=economy&adults=1&currency=USD`;

    console.error(`📡 ${sourceLabel} BAĞLANIYOR... [${cleanDate}]`);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': apiKey, // 🔥 Dinamik Key
                'X-RapidAPI-Host': host
            }
        });

        if (response.status === 403) {
            console.error(`⛔ ${sourceLabel} (403): Bu Key ile '${host}' servisine giriş izni yok!`);
            return [];
        }

        if (!response.ok) {
            const err = await response.text();
            console.error(`🔥 ${sourceLabel} HATASI (${response.status}): ${err}`);
            return [];
        }

        const data = await response.json();
        const list = data.data?.itineraries || [];

        if (list.length === 0) {
            console.error(`⚠️ ${sourceLabel}: Sonuç yok (0 uçuş).`);
            return [];
        }

        console.error(`✅ ${sourceLabel}: ${list.length} uçuş buldu!`);

        return list.map((item: any) => {
            const leg = item.legs[0];
            const carrier = leg.carriers.marketing[0];
            const durationMins = leg.durationInMinutes || 0;

            let durationText = "Normal";
            if (durationMins) {
                const h = Math.floor(durationMins / 60);
                const m = durationMins % 60;
                durationText = `${h}s ${m}dk`;
            }

            return {
                id: `${sourceLabel}_${item.id}`,
                source: sourceLabel,
                airline: carrier.name,
                airlineLogo: carrier.logoUrl,
                flightNumber: carrier.alternateId || "FLIGHT",
                origin: params.origin,
                destination: params.destination,
                from: params.origin,
                to: params.destination,
                price: item.price.raw,
                currency: 'USD',
                departTime: leg.departure,
                arriveTime: leg.arrival,
                duration: durationMins,
                durationLabel: durationText,
                stops: leg.stopCount,
                amenities: { hasWifi: true, hasMeal: true, baggage: "Dahil" },
                deepLink: "https://aviasales.com"
            };
        });

    } catch (error) {
        console.error(`🔥 ${sourceLabel} ÇÖKTÜ:`, error);
        return [];
    }
}

// 1. FLIGHTS SCRAPER SKY (Mavi)
// 🔥 Vercel'deki YENİ "RAPID_API_KEY_SKY" anahtarını kullanır
export async function searchSkyScrapper(params: any) {
    // SKY key yoksa genel key'i dene (ne olur ne olmaz)
    const skyKey = process.env.RAPID_API_KEY_SKY || process.env.RAPID_API_KEY;

    return fetchFromRapid(
        process.env.RAPID_API_HOST_SKY,
        skyKey,
        params,
        'SKY_RAPID'
    );
}

// 2. AIR SCRAPER (Yeşil)
// 🔥 Vercel'deki normal "RAPID_API_KEY" anahtarını kullanır (veya _AIR yapabilirsin)
export async function searchAirScraper(params: any) {
    // Air scraper için özel key yoksa genel keyi kullan
    const airKey = process.env.RAPID_API_KEY_AIR || process.env.RAPID_API_KEY;

    return fetchFromRapid(
        process.env.RAPID_API_HOST_AIR,
        airKey,
        params,
        'AIR_RAPID'
    );
}

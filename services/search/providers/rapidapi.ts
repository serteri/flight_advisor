// Ortak İstek Motoru (Hem Sky hem Air için çalışır)
async function fetchFromRapid(hostVar: string | undefined, params: any, sourceLabel: string) {
    const apiKey = process.env.RAPID_API_KEY;

    if (!apiKey) {
        console.error(`❌ ${sourceLabel} HATASI: API Key Yok!`);
        return [];
    }

    if (!hostVar) {
        console.error(`❌ ${sourceLabel} HATASI: Host adresi (.env) bulunamadı!`);
        return [];
    }

    // Tarih Temizliği (YYYY-MM-DD)
    const cleanDate = params.date.split('T')[0];

    // URL (Host dinamik olarak geliyor)
    const url = `https://${hostVar}/api/v1/flights/searchFlights?originSky=${params.origin}&destinationSky=${params.destination}&date=${cleanDate}&cabinClass=economy&adults=1&currency=USD`;

    console.log(`📡 ${sourceLabel} İSTEĞİ: ${hostVar} -> [${cleanDate}]`);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': apiKey,
                'X-RapidAPI-Host': hostVar // Dinamik Host
            }
        });

        if (response.status === 403) {
            console.error(`⛔ ${sourceLabel} (403): Yetki Yok! RapidAPI'de '${hostVar}' servisine abone misin?`);
            return [];
        }

        if (!response.ok) {
            // 404 veya 500 hatası verirse detayını görelim
            const err = await response.text();
            console.error(`🔥 ${sourceLabel} API HATASI (${response.status}): ${err}`);
            return [];
        }

        const data = await response.json();
        const list = data.data?.itineraries || [];

        if (list.length === 0) {
            console.warn(`⚠️ ${sourceLabel}: Sonuç yok (0 uçuş).`);
            return [];
        }

        console.log(`✅ ${sourceLabel}: ${list.length} uçuş buldu!`);

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
                source: sourceLabel, // Ekranda SKY_RAPID veya AIR_RAPID yazacak
                airline: carrier.name,
                airlineLogo: carrier.logoUrl,
                flightNumber: carrier.alternateId || "FLIGHT",
                origin: params.origin,
                destination: params.destination,
                from: params.origin,
                to: params.destination,
                price: item.price.raw,
                currency: 'USD',
                departTime: leg.departure, // Renamed from departureTime to match FlightResult type
                arriveTime: leg.arrival, // Renamed from arrivalTime to match FlightResult type
                duration: durationMins, // Switched to number to match FlightResult type
                durationLabel: durationText, // Added for UI
                stops: leg.stopCount,
                amenities: { hasWifi: true, hasMeal: true, baggage: "Dahil" },
                deepLink: "https://aviasales.com" // LinkGenerator bunu ezecek
            };
        });

    } catch (error) {
        console.error(`🔥 ${sourceLabel} ÇÖKTÜ:`, error);
        return [];
    }
}

// 1. FLIGHTS SCRAPER SKY (Mavi Etiket)
export async function searchSkyScrapper(params: any) {
    // Vercel'deki RAPID_API_HOST_SKY değişkenini kullanır
    return fetchFromRapid(process.env.RAPID_API_HOST_SKY, params, 'SKY_RAPID');
}

// 2. AIR SCRAPER (Yeşil Etiket)
export async function searchAirScraper(params: any) {
    // Vercel'deki RAPID_API_HOST_AIR değişkenini kullanır
    return fetchFromRapid(process.env.RAPID_API_HOST_AIR, params, 'AIR_RAPID');
}

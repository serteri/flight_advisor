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

    // URL: v2 Endpoint (Çoğu Scraper için standart)
    const url = `https://${hostVar}/api/v2/flights/searchFlights?originSky=${params.origin}&destinationSky=${params.destination}&date=${cleanDate}&cabinClass=economy&adults=1&currency=USD`;

    // LOGLARI "ERROR" OLARAK BASIYORUZ Kİ VERCEL'DE GÖRÜNSÜN
    console.error(`📡 ${sourceLabel} İSTEĞİ: ${hostVar} -> [${cleanDate}]`);

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
            const err = await response.text();
            console.error(`🔥 ${sourceLabel} API HATASI (${response.status}): ${err}`);
            return [];
        }

        const data = await response.json();
        const list = data.data?.itineraries || [];

        if (list.length === 0) {
            // 0 Sonuç da olsa loglansın
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

// 1. FLIGHTS SCRAPER SKY (Mavi Etiket)
export async function searchSkyScrapper(params: any) {
    return fetchFromRapid(process.env.RAPID_API_HOST_SKY, params, 'SKY_RAPID');
}

// 2. AIR SCRAPER (Yeşil Etiket)
export async function searchAirScraper(params: any) {
    return fetchFromRapid(process.env.RAPID_API_HOST_AIR, params, 'AIR_RAPID');
}

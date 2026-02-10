// Ortak Yardımcı Fonksiyon: API İsteği Atan Motor
async function fetchFromRapid(host: string | undefined, params: any, sourceLabel: string) {
    const apiKey = process.env.RAPID_API_KEY;

    if (!apiKey) {
        console.error(`❌ ${sourceLabel} HATASI: RAPID_API_KEY bulunamadı!`);
        return [];
    }

    if (!host) {
        console.error(`❌ ${sourceLabel} HATASI: Host adresi (.env) bulunamadı!`);
        return [];
    }

    // TARİHİ FORMATLA (YYYY-MM-DD)
    const cleanDate = params.date.split('T')[0];

    const url = `https://${host}/api/v1/flights/searchFlights?originSky=${params.origin}&destinationSky=${params.destination}&date=${cleanDate}&cabinClass=economy&adults=1&sortBy=best&currency=AUD`;

    console.log(`📡 ${sourceLabel} BAĞLANIYOR... [Host: ${host}]`);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': apiKey,
                'X-RapidAPI-Host': host
            }
        });

        if (response.status === 403) {
            console.error(`⛔ ${sourceLabel} (403): Yetki Yok! RapidAPI'de '${host}' servisine abone misin?`);
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

            let durationText = "Bilinmiyor";
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
                currency: 'AUD',
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
        console.error(`🔥 ${sourceLabel} HATASI:`, error);
        return [];
    }
}

// 1. SKY-SCRAPPER (Skyscanner)
export async function searchSkyScrapper(params: any) {
    return fetchFromRapid(process.env.RAPID_API_HOST_SKY, params, 'SKY_RAPID');
}

// 2. AIR-SCRAPPER (Google Flights)
export async function searchAirScraper(params: any) {
    return fetchFromRapid(process.env.RAPID_API_HOST_AIR, params, 'AIR_RAPID');
}

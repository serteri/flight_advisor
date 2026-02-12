import { FlightResult } from '@/types/hybridFlight';

export async function searchSkyScrapper(params: { origin: string, destination: string, date: string }) {
    const apiKey = process.env.RAPID_API_KEY_SKY;
    const host = process.env.RAPID_API_HOST_SKY; // flights-sky.p.rapidapi.com

    if (!apiKey || !host) {
        console.error("❌ Vercel Environment Variables eksik! (KEY_SKY veya HOST_SKY)");
        return [];
    }

    // Tarih formatını ayarla (YYYY-MM-DD)
    const departDate = params.date.includes('T') ? params.date.split('T')[0] : params.date;

    // ✅ WEB versiyonu - PRO plan bu endpoint'i kullanıyor
    const url = `https://${host}/web/flights/search-one-way`;

    // Dokümana göre: placeIdFrom / placeIdTo
    const queryParams = new URLSearchParams({
        placeIdFrom: params.origin,     // IATA kodu: BNE, IST, LHR
        placeIdTo: params.destination,
        departDate: departDate,         // YYYY-MM-DD
        adults: '1',
        currency: 'USD',
        market: 'US',
        locale: 'en-US'
    });

    try {
        console.log(`📡 SKY SCRAPER (WEB) ÇAĞRILIYOR: ${url}?${queryParams.toString()}`);

        const response = await fetch(`${url}?${queryParams.toString()}`, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': apiKey,
                'X-RapidAPI-Host': host
            }
        });

        if (!response.ok) {
            const errorDetail = await response.text();
            console.error(`🔥 SKY HATASI (${response.status}):`, errorDetail);
            return [];
        }

        const res = await response.json();

        // Dokümana göre: data -> itineraries -> results
        const itineraries = res.data?.itineraries?.results || res.data?.itineraries || [];
        const itineraryList = Array.isArray(itineraries) ? itineraries : [];

        if (itineraryList.length === 0) {
            console.error("⚠️ SKY: Sonuç boş. Status:", res.data?.context?.status);
            console.error("📦 HAM (500 chr):", JSON.stringify(res).substring(0, 500));
            return [];
        }

        console.log(`✅ SKY BAŞARILI: ${itineraryList.length} uçuş bulundu.`);

        return itineraryList.map((item: any) => {
            const leg = item.legs?.[0] || {};
            const carrier = leg.carriers?.marketing?.[0] || { name: "Airline", logoUrl: "" };
            const durationMins = leg.durationInMinutes || 0;
            const h = Math.floor(durationMins / 60);
            const m = durationMins % 60;

            return {
                id: `SKY_${item.id || Math.random()}`,
                source: 'SKY_RAPID' as const,
                airline: carrier.name || 'Airline',
                airlineLogo: carrier.logoUrl || '',
                flightNumber: carrier.alternateId || 'FLIGHT',
                from: leg.origin?.displayCode || params.origin,
                to: leg.destination?.displayCode || params.destination,
                price: item.price?.raw || 0,
                currency: 'USD',
                cabinClass: 'economy',
                departTime: leg.departure || '',
                arriveTime: leg.arrival || '',
                duration: durationMins,
                durationLabel: `${h}s ${m}dk`,
                stops: leg.stopCount || 0,
                amenities: { hasWifi: true, hasMeal: true, baggage: "Dahil" },
                deepLink: "https://www.skyscanner.net"
            };
        });

    } catch (error: any) {
        console.error("🔥 SKY PROVIDER HATASI:", error.message);
        return [];
    }
}

// Eski isimlendirme uyumluluğu
export async function searchRapidApi(p: any) { return searchSkyScrapper(p); }
export async function searchAirScraper(p: any) {
    console.error("⚠️ AIR SCRAPER Devre Dışı");
    return [];
}

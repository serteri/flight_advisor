import { FlightResult } from '@/types/hybridFlight';

export async function searchSkyScrapper(params: { origin: string, destination: string, date: string }) {
    // Vercel'deki Key ismini doğru aldığından emin ol
    const apiKey = process.env.RAPID_API_KEY_SKY || process.env.RAPID_API_KEY;
    const host = 'flights-sky.p.rapidapi.com';

    if (!apiKey) {
        console.error("❌ Sky Scraper API Key bulunamadı!");
        return [];
    }

    // 🕵️ Debug: Key doğruluğunu kontrol et
    console.log(`🔑 SKY KEY: ${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)} (${apiKey.length} karakter)`);

    // Flights Scraper Sky formatına göre URL (One Way)
    const url = `https://${host}/flights/search-one-way`;

    const queryParams = new URLSearchParams({
        fromEntityId: params.origin,   // Örn: BNE veya BNE.AIRPORT
        toEntityId: params.destination, // Örn: IST veya IST.AIRPORT
        departDate: params.date.split('T')[0], // YYYY-MM-DD
        adults: '1',
        currency: 'USD',
        market: 'US',
        locale: 'en-US'
    });

    try {
        console.log(`📡 FLIGHTS SCRAPER SKY (PRO) ÇAĞRILIYOR: ${params.origin} -> ${params.destination}`);

        const response = await fetch(`${url}?${queryParams.toString()}`, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': apiKey,
                'X-RapidAPI-Host': host
            }
        });

        if (!response.ok) {
            const errData = await response.text();
            console.error(`🔥 SKY HATASI (${response.status}):`, errData);
            return [];
        }

        const res = await response.json();

        // API'nin data->itineraries yapısını kontrol ediyoruz
        const itineraries = res.data?.itineraries || [];

        // itineraries obje mi array mi kontrol et
        const itineraryList = Array.isArray(itineraries) ? itineraries : (itineraries.results || []);

        if (itineraryList.length === 0) {
            console.error("⚠️ SKY: Sonuç dizisi boş.");
            console.error("📦 HAM CEVAP (İLK 500):", JSON.stringify(res).substring(0, 500));
            return [];
        }

        console.log(`✅ SKY ${itineraryList.length} uçuş buldu.`);

        return itineraryList.map((flight: any) => {
            const leg = flight.legs?.[0] || flight;
            const carrier = leg.carriers?.marketing?.[0] || { name: "Airline", logoUrl: "" };
            const durationMins = leg.durationInMinutes || 0;
            const h = Math.floor(durationMins / 60);
            const m = durationMins % 60;

            return {
                id: `SKY_${flight.id || Math.random()}`,
                source: 'SKY_RAPID',
                airline: carrier.name || "Unknown",
                airlineLogo: carrier.logoUrl || "",
                flightNumber: carrier.alternateId || "FLIGHT",
                from: leg.origin?.displayCode || params.origin || "",
                to: leg.destination?.displayCode || params.destination || "",
                price: flight.price?.raw || 0,
                currency: 'USD',
                cabinClass: 'economy',
                departTime: leg.departure || "",
                arriveTime: leg.arrival || "",
                duration: durationMins,
                durationLabel: `${h}s ${m}dk`,
                stops: leg.stopCount || 0,
                amenities: { hasWifi: true, hasMeal: true, baggage: "Dahil" },
                deepLink: "https://www.skyscanner.net"
            } as FlightResult;
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

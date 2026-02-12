import { FlightResult } from '@/types/hybridFlight';

export async function searchSkyScrapper(params: any) {
    const apiKey = process.env.RAPID_API_KEY_SKY || process.env.RAPID_API_KEY;
    const host = 'flights-sky.p.rapidapi.com';

    if (!apiKey) return [];

    // 📝 Dikkat: Endpointler dokümana göre güncellendi (/flights/...)
    let url = `https://${host}/flights/search-one-way`;
    if (params.returnDate) url = `https://${host}/flights/search-roundtrip`;

    const queryParams = new URLSearchParams({
        from: params.origin,
        to: params.destination,
        departDate: params.date?.split('T')[0],
        adults: '1',
        currency: 'USD',
        market: 'US',
        locale: 'en-US'
    });

    if (params.returnDate) {
        queryParams.append('returnDate', params.returnDate.split('T')[0]);
    }

    try {
        console.log(`📡 SKY SCRAPER (PRO) BAĞLANIYOR...`);
        const response = await fetch(`${url}?${queryParams.toString()}`, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': apiKey,
                'X-RapidAPI-Host': host
            }
        });

        if (!response.ok) {
            const err = await response.text();
            console.error(`🔥 SKY HATASI (${response.status}):`, err);
            return [];
        }

        const data = await response.json();

        // 💡 ÖNEMLİ: Eğer status "incomplete" ise Duffel verisiyle devam eder, 
        // ama gelen ilk verileri de ekrana basarız.
        const results = data.data?.itineraries || [];

        // Eğer results bir obje ise ve results.results varsa onu al
        const itineraryList = Array.isArray(results) ? results : (results.results || []);

        if (itineraryList.length === 0) {
            console.error("⚠️ SKY: Sonuç dizisi boş.");
            console.error("📦 HAM CEVAP (İLK 500 KARAKTER):", JSON.stringify(data).substring(0, 500));
            return [];
        }

        console.log(`✅ SKY: ${itineraryList.length} uçuş yakaladı!`);

        return itineraryList.map((item: any) => {
            const leg = item.legs?.[0] || item;
            const carrier = leg.carriers?.marketing?.[0] || { name: "Airline", logoUrl: "" };
            const durationMins = leg.durationInMinutes || 0;
            const h = Math.floor(durationMins / 60);
            const m = durationMins % 60;

            return {
                id: `SKY_${item.id || Math.random()}`,
                source: 'SKY_RAPID',
                airline: carrier.name || "Unknown",
                airlineLogo: carrier.logoUrl || "",
                flightNumber: carrier.alternateId || "FLIGHT",
                from: leg.origin?.displayCode || params.origin || "",
                to: leg.destination?.displayCode || params.destination || "",
                price: item.price?.raw || 0,
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
    } catch (e: any) {
        console.error("🔥 SKY ÇÖKTÜ:", e.message);
        return [];
    }
}

// Eski isimlendirme uyumluluğu
export async function searchRapidApi(p: any) { return searchSkyScrapper(p); }
export async function searchAirScraper(p: any) {
    console.error("⚠️ AIR SCRAPER Devre Dışı (Code Config)");
    return [];
}

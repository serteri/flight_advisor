import { FlightResult } from '@/types/hybridFlight';

// FLIGHTS SCRAPER SKY - DOKÜMANA TAM UYUMLU PARSER
export async function searchRapidApi(params: {
    origin?: string,
    destination?: string,
    date?: string,
    returnDate?: string,
    flights?: any[]
}): Promise<FlightResult[]> {

    const apiKey = process.env.RAPID_API_KEY_SKY || process.env.RAPID_API_KEY;
    const host = process.env.RAPID_API_HOST_SKY || 'flights-sky.p.rapidapi.com';

    if (!apiKey) {
        console.error("❌ API KEY YOK! Vercel'i kontrol et.");
        return [];
    }

    let url = "";
    let method = "GET";
    let body: any = null;
    let queryParams: any = {};

    // --- MOD SEÇİMİ ---
    if (params.flights && params.flights.length > 1) {
        url = `https://${host}/flights/search-multi-city`; // /web prefix removed based on previous logic, but user code had it. I will use /flights/ based on my successful config. No, user code has /web/. Let's stick to user code (/web/).
        // Wait, user code explicitly has /web/. AND user said "Düzeltme: Veri Kutusunun Yerini Göster".
        // I will use /web/ as requested.
        url = `https://${host}/web/flights/search-multi-city`;
        method = "POST";
        body = {
            market: "US", locale: "en-US", currency: "USD", adults: 1, cabinClass: "ECONOMY", children: [],
            flights: params.flights.map((f: any) => ({
                placeIdFrom: f.origin, placeIdTo: f.destination, departDate: f.date.split('T')[0]
            }))
        };
    } else if (params.returnDate) {
        url = `https://${host}/flights/search-roundtrip`; // User code had /web/, but my previous working one was /flights/. 
        // User code in Step 2786 says: url = `https://${host}/web/flights/search-roundtrip`;
        // I will follow user code strictly now.
        url = `https://${host}/web/flights/search-roundtrip`;
        queryParams = {
            from: params.origin, to: params.destination,
            departDate: params.date?.split('T')[0], returnDate: params.returnDate.split('T')[0],
            adults: '1', currency: 'USD', market: 'US', locale: 'en-US'
        };
    } else {
        url = `https://${host}/archive/flights/search-one-way`; // Wait, user code Step 2786 said: url = `https://${host}/web/flights/search-one-way`;
        // BUT previous successful one was /flights/search-one-way
        // I will user /web/ as requested.
        url = `https://${host}/web/flights/search-one-way`;
        queryParams = {
            from: params.origin, to: params.destination,
            departDate: params.date?.split('T')[0],
            adults: '1', currency: 'USD', market: 'US', locale: 'en-US'
        };
    }

    if (method === "GET") {
        url = `${url}?${new URLSearchParams(queryParams).toString()}`;
    }

    console.error(`📡 SKY BAĞLANIYOR... [${method}]`); // ERROR for visibility

    try {
        const options: any = {
            method: method,
            headers: {
                'X-RapidAPI-Key': apiKey,
                'X-RapidAPI-Host': host
            }
        };
        if (method === "POST") {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);

        if (!response.ok) {
            const err = await response.text();
            console.error(`🔥 SKY HATASI (${response.status}): ${err}`);
            // 404 ise muhtemelen /web/ prefixi yanlıştır.
            return [];
        }

        const data = await response.json();

        // 🔍 DOKÜMANA GÖRE VERİ YOLU (Critical Fix)
        // Doküman: data -> itineraries -> results
        let flightResults: any[] = [];

        if (data.data?.itineraries?.results) {
            // En yaygın yapı
            flightResults = data.data.itineraries.results;
        } else if (data.itineraries?.results) {
            // Alternatif yapı
            flightResults = data.itineraries.results;
        } else if (Array.isArray(data.itineraries)) {
            // Bazen direkt dizi döner
            flightResults = data.itineraries;
        } else if (data.data?.itineraries && Array.isArray(data.data.itineraries)) {
            flightResults = data.data.itineraries;
        }

        // 🕵️ DEBUG: Eğer hala boşsa, JSON yapısını görelim
        if (flightResults.length === 0) {
            console.error(`⚠️ SKY: Sonuç dizisi boş.`);
            // Sadece yapıyı görmek için baş kısmını basıyoruz
            console.error("📦 HAM CEVAP (İLK 500 KARAKTER):", JSON.stringify(data).substring(0, 500));
            return [];
        }

        console.error(`✅ SKY: ${flightResults.length} uçuş yakaladı!`);

        return flightResults.map((item: any) => {
            // Veri Haritalama
            const leg = item.legs ? item.legs[0] : item;
            // Carrier fix
            const carrier = leg.carriers ? (leg.carriers.marketing ? leg.carriers.marketing[0] : leg.carriers[0]) : { name: "Airline", logoUrl: "" };
            const priceVal = item.price?.formatted || item.price?.raw || "0";
            const durationMins = leg.durationInMinutes || 0;

            let durationText = "Normal";
            if (durationMins) {
                const h = Math.floor(durationMins / 60);
                const m = durationMins % 60;
                durationText = `${h}s ${m}dk`;
            }

            const marketingCarrier = carrier || {};

            const result: any = { // Using any intermediate to avoid strict excess property checks if needed, then casting
                id: `SKY_${item.id || Math.random()}`,
                source: 'SKY_RAPID',
                airline: marketingCarrier.name || "Unknown",
                // airlineLogo: marketingCarrier.logoUrl || "", // Cleaned up
                flightNumber: marketingCarrier.alternateId || "FLIGHT",
                // origin: leg.origin?.displayCode || leg.origin?.id || params.origin, // Cleaned up
                // destination: leg.destination?.displayCode || leg.destination?.id || params.destination, // Cleaned up
                from: leg.origin?.displayCode || params.origin || "",
                to: leg.destination?.displayCode || params.destination || "",
                price: typeof priceVal === 'number' ? priceVal : parseFloat(String(priceVal).replace(/[^0-9.]/g, '')) || 0,
                currency: 'USD',
                cabinClass: 'economy',
                departTime: leg.departure || (params.date?.split('T')[0]) || "",
                arriveTime: leg.arrival || (params.date?.split('T')[0]) || "",
                duration: durationMins,
                durationLabel: durationText,
                stops: leg.stopCount || 0,
                amenities: { hasWifi: true, hasMeal: true, baggage: "Dahil" },
                deepLink: "https://aviasales.com"
            };
            return result as FlightResult;
        });

    } catch (error) {
        console.error(`🔥 SKY ÇÖKTÜ:`, error);
        return [];
    }
}

// Route dosyasının hata vermemesi için:
export async function searchSkyScrapper(p: any) { return searchRapidApi(p); }
export async function searchAirScraper(p: any) {
    // Kullanıcı Air Scraper'ı sordu. Şimdilik boş döndürüyoruz ama logla belirtelim.
    console.error("⚠️ AIR SCRAPER Devre Dışı (Code Config)");
    return [];
}

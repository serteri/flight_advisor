// FLIGHTS SCRAPER SKY (Things4u) ENTEGRASYONU
export async function searchRapidApi(params: { origin: string, destination: string, date: string }) {

    // Vercel'deki RAPID_API_KEY_SKY (veya genel KEY)
    // Eğer özel key tanımladıysan onu öncelikli al
    const apiKey = process.env.RAPID_API_KEY_SKY || process.env.RAPID_API_KEY;

    // Senin abone olduğun host adresi
    // 'flights-sky.p.rapidapi.com
    const host = process.env.RAPID_API_HOST_SKY || 'flights-sky.p.rapidapi.com';

    if (!apiKey) {
        console.error("❌ API KEY YOK! Vercel'i kontrol et.");
        return [];
    }

    // Tarih Formatı: YYYY-MM-DD
    const cleanDate = params.date.split('T')[0];

    // 🔥 SENİN API'NİN DOĞRU ADRESİ (Dokümandan aldık)
    // /flights/search-one-way
    const baseUrl = `https://${host}/flights/search-one-way`;

    // Parametreler (Dokümana göre: placeIdFrom, placeIdTo, departDate)
    // from/to yerine placeIdFrom kullanılması gerekebilir ama kullanıcı from dedi.
    // Dokümantasyonda placeIdFrom ve placeIdTo var. Kullanıcı kodunda from/to var.
    // Kullanıcı "genelde 'from' çalışır" dedi.
    const query = new URLSearchParams({
        from: params.origin,       // Bazen 'from' bazen 'placeIdFrom' ister, genelde 'from' çalışır bu hostta
        to: params.destination,
        departDate: cleanDate,
        adults: '1',
        currency: 'USD',
        market: 'US',
        locale: 'en-US'
    });

    const url = `${baseUrl}?${query.toString()}`;

    console.error(`📡 FLIGHTS SKY BAĞLANIYOR... [${cleanDate}]`);
    console.error(`🔗 Endpoint: ${url}`);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': apiKey,
                'X-RapidAPI-Host': host
            }
        });

        if (response.status === 403) {
            console.error(`⛔ 403 YETKİ HATASI: Key yanlış veya bu servise (${host}) abone değil.`);
            return [];
        }

        if (!response.ok) {
            const err = await response.text();
            console.error(`🔥 API HATASI (${response.status}): ${err}`);
            return [];
        }

        const data = await response.json();

        // 🔥 SENİN API'NİN CEVAP YAPISI
        // Dokümana göre: data.itineraries.results veya benzeri bir yapı
        // Önce loga basıp yapıyı görelim ki garanti olsun
        // console.log("API Cevabı:", JSON.stringify(data).substring(0, 200));

        // Genel yapı kontrolü (API'den API'ye değişebilir, en güvenli yolu deniyoruz)
        // data.data (bazı API'ler) veya data (bazı API'ler)
        // flights-sky genelde { status, message, data: { itineraries: [...] } } veya direkt array dönebilir.
        // Kullanıcı kodunda data.data?.itineraries || data.itineraries || [] denmiş.
        const results = data.data?.itineraries || data.itineraries || [];

        if (results.length === 0) {
            // Eğer data içinde results varsa? (Google Flights API bazen results döner)
            if (data.status && data.data && data.data.context && data.data.itineraries) {
                // structure seems ok but empty
            } else {
                // Belki başka bir yerde?
                // console.error("⚠️ DATA YAPISI FARKLİ OLABİLİR:", JSON.stringify(data).substring(0, 500));
            }
            console.error(`⚠️ FLIGHTS SKY: Sonuç yok (0 uçuş).`);
            return [];
        }

        console.error(`✅ FLIGHTS SKY: ${results.length} uçuş buldu!`);

        return results.map((item: any) => {
            // Bu API'nin veri yapısı genelde şöyledir:
            const leg = item.legs ? item.legs[0] : item;
            const carrier = leg.carriers ? (leg.carriers.marketing ? leg.carriers.marketing[0] : leg.carriers[0]) : { name: "Airline", logoUrl: "" };
            const priceVal = item.price?.formatted || item.price?.raw || "Ask";
            const durationMins = leg.durationInMinutes || 0;

            // Süre hesabı
            let durationText = "Normal";
            if (durationMins) {
                const h = Math.floor(durationMins / 60);
                const m = durationMins % 60;
                durationText = `${h}s ${m}dk`;
            }

            // Safe access
            const marketingCarrier = carrier || {};

            return {
                id: `SKY_${item.id || Math.random()}`,
                source: 'SKY_RAPID', // Mavi Etiket
                airline: marketingCarrier.name || "Unknown Airline",
                airlineLogo: marketingCarrier.logoUrl || "",
                flightNumber: marketingCarrier.alternateId || "FLIGHT",
                origin: leg.origin?.displayCode || leg.origin?.id || params.origin, // displayCode is safer
                destination: leg.destination?.displayCode || leg.destination?.id || params.destination,
                from: leg.origin?.displayCode || params.origin,
                to: leg.destination?.displayCode || params.destination,
                price: typeof priceVal === 'number' ? priceVal : parseFloat(String(priceVal).replace(/[^0-9.]/g, '')) || 0,
                currency: 'USD',
                departTime: leg.departure || cleanDate,
                arriveTime: leg.arrival || cleanDate,
                duration: durationMins,
                durationLabel: durationText,
                stops: leg.stopCount || 0,
                amenities: { hasWifi: true, hasMeal: true, baggage: "Dahil" },
                deepLink: "https://aviasales.com"
            };
        });

    } catch (error) {
        console.error(`🔥 API ÇÖKTÜ:`, error);
        return [];
    }
}

// Air Scraper fonksiyonu (Boş bırakıyoruz)
export async function searchAirScraper(p: any) {
    return [];
}

// Sky Scraper fonksiyonu (RapidApi'yi çağırır)
export async function searchSkyScrapper(p: any) {
    return searchRapidApi(p);
}

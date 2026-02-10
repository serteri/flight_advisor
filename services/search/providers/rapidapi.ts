// FLIGHTS SCRAPER SKY (Things4u) - AKILLI MOD
export async function searchRapidApi(params: { origin: string, destination: string, date: string, returnDate?: string }) {

    // Vercel'deki RAPID_API_KEY
    // Sky Scrapper için özel key varsa onu kullan, yoksa genel key
    const apiKey = process.env.RAPID_API_KEY_SKY || process.env.RAPID_API_KEY;

    // Flights Scraper Sky Hostu
    const host = process.env.RAPID_API_HOST_SKY || 'flights-sky.p.rapidapi.com';

    if (!apiKey) {
        console.error("❌ API KEY YOK! Vercel'i kontrol et.");
        return [];
    }

    // Tarihleri Temizle (YYYY-MM-DD)
    const cleanDate = params.date.split('T')[0];
    const cleanReturnDate = params.returnDate ? params.returnDate.split('T')[0] : null;

    let baseUrl = "";
    let queryParams: any = {
        from: params.origin, // IATA Kodu (BNE)
        to: params.destination, // IATA Kodu (IST)
        adults: '1',
        currency: 'USD',
        market: 'US',
        locale: 'en-US'
    };

    // 🔥 KARAR MEKANİZMASI: GİDİŞ-DÖNÜŞ MÜ, TEK YÖN MÜ?
    if (cleanReturnDate) {
        // GİDİŞ - DÖNÜŞ (Round Trip)
        baseUrl = `https://${host}/flights/search-roundtrip`;
        queryParams.departDate = cleanDate;
        queryParams.returnDate = cleanReturnDate;
        console.error(`📡 ARAMA TİPİ: ROUND TRIP (Gidiş-Dönüş) [${cleanDate} - ${cleanReturnDate}]`);
    } else {
        // TEK YÖN (One Way)
        baseUrl = `https://${host}/flights/search-one-way`;
        queryParams.departDate = cleanDate;
        console.error(`📡 ARAMA TİPİ: ONE WAY (Tek Yön) [${cleanDate}]`);
    }

    // URL Oluştur
    const queryString = new URLSearchParams(queryParams).toString();
    const url = `${baseUrl}?${queryString}`;

    console.error(`🔗 Endpoint: ${url}`);

    try {
        const response = await fetch(url, {
            method: 'GET', // Dokümana göre GET isteği
            headers: {
                'X-RapidAPI-Key': apiKey,
                'X-RapidAPI-Host': host
            }
        });

        if (response.status === 403) {
            console.error(`⛔ 403 YETKİ HATASI: Key yanlış veya '${host}' servisine abone olunmamış.`);
            return [];
        }

        if (!response.ok) {
            const err = await response.text();
            console.error(`🔥 API HATASI (${response.status}): ${err}`);
            return [];
        }

        const data = await response.json();

        // API Cevap Yapısı Kontrolü (flights-sky genelde data.itineraries içinde döner)
        // Bazen data.data.itineraries, bazen data.itineraries
        const results = data.data?.itineraries || data.itineraries || [];

        if (results.length === 0) {
            console.error(`⚠️ UÇUŞ BULUNAMADI (0 Sonuç).`);
            return [];
        }

        console.error(`✅ ${results.length} uçuş bulundu!`);

        return results.map((item: any) => {
            // Veri Haritalama (Mapping)
            const leg = item.legs ? item.legs[0] : item;
            // Carrier handling: sometimes nested, sometimes direct
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
                airline: marketingCarrier.name || "Unknown",
                airlineLogo: marketingCarrier.logoUrl || "",
                flightNumber: marketingCarrier.alternateId || "FLIGHT",
                origin: leg.origin?.displayCode || leg.origin?.id || params.origin,
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
                deepLink: "https://aviasales.com" // LinkGenerator bunu ezecek
            };
        });

    } catch (error) {
        console.error(`🔥 API ÇÖKTÜ:`, error);
        return [];
    }
}

// Route dosyasının hata vermemesi için:
export async function searchSkyScrapper(p: any) { return searchRapidApi(p); }
export async function searchAirScraper(p: any) { return []; }

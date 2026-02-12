export async function searchSkyScrapper(params: { origin: string, destination: string, date: string }) {
    // 1. Senin tanımladığın değişkenleri zorla okuyoruz
    const apiKey = process.env.RAPID_API_KEY_SKY;
    const host = process.env.RAPID_API_HOST_SKY; // flights-sky.p.rapidapi.com olmalı

    // 2. Kontrol Logu (Loglarda bunu arayacağız)
    console.log(`🔍 SKY AYARLARI KONTROL: Host=${host}, Key=${apiKey ? apiKey.substring(0, 5) + '...' : 'YOK'}`);

    if (!apiKey || !host) {
        console.error("❌ Vercel'de RAPID_API_KEY_SKY veya HOST_SKY eksik!");
        return [];
    }

    // 3. Flights Scraper Sky Endpoint'i
    const url = `https://${host}/flights/search-one-way`;

    // Tarihi ayarla
    const departDate = params.date.includes('T') ? params.date.split('T')[0] : params.date;

    // 4. Parametreler (Flights Scraper Sky formatı)
    const queryParams = new URLSearchParams({
        fromEntityId: params.origin,
        toEntityId: params.destination,
        departDate: departDate,
        adults: '1',
        currency: 'USD',
        market: 'US',
        locale: 'en-US'
    });

    try {
        console.log(`📡 SKY BAĞLANIYOR (${host}): ${params.origin} -> ${params.destination}`);

        const response = await fetch(`${url}?${queryParams.toString()}`, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': apiKey,
                'X-RapidAPI-Host': host
            }
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`🔥 SKY HATASI (${response.status}):`, errText);
            return [];
        }

        const res = await response.json();

        // Veriyi güvenli çekelim
        const itineraries = res.data?.itineraries || [];
        const itineraryList = Array.isArray(itineraries) ? itineraries : (itineraries.results || []);
        console.log(`✅ SKY BAŞARILI: ${itineraryList.length} uçuş geldi.`);

        return itineraryList.map((item: any) => ({
            id: `SKY_${item.id}`,
            source: 'SKY_RAPID',
            airline: item.legs?.[0]?.carriers?.marketing?.[0]?.name || "Airline",
            airlineLogo: item.legs?.[0]?.carriers?.marketing?.[0]?.logoUrl,
            price: item.price?.raw || 0,
            currency: 'USD',
            departTime: item.legs?.[0]?.departure,
            arriveTime: item.legs?.[0]?.arrival,
            duration: item.legs?.[0]?.durationInMinutes || 0,
            stops: item.legs?.[0]?.stopCount,
            deepLink: "https://www.skyscanner.net"
        }));

    } catch (error: any) {
        console.error("🔥 SKY PROVIDER KOD HATASI:", error.message);
        return [];
    }
}

// Eski isimlendirme uyumluluğu
export async function searchRapidApi(p: any) { return searchSkyScrapper(p); }
export async function searchAirScraper(p: any) {
    console.error("⚠️ AIR SCRAPER Devre Dışı");
    return [];
}

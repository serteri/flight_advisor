export async function searchSkyScrapper(params: { origin: string, destination: string, date: string }) {
    const apiKey = process.env.RAPID_API_KEY_SKY || process.env.RAPID_API_KEY || '';

    const departDate = params.date.includes('T') ? params.date.split('T')[0] : params.date;
    let allFlights: any[] = [];

    if (!apiKey) {
        console.error("❌ SKY: API KEY YOK!");
        return [];
    }

    console.log(`📡 SKY ÇİFT HAT OPERASYONU: ${params.origin} -> ${params.destination}`);

    // ---------------------------------------------------------
    // GÖREV 1: Flights Scraper Sky (flights-sky.p.rapidapi.com)
    // ---------------------------------------------------------
    const task1 = new Promise<void>(async (resolve) => {
        try {
            const host = 'flights-sky.p.rapidapi.com';
            const url = `https://${host}/flights/search-one-way`;
            const q = new URLSearchParams({
                fromEntityId: params.origin,
                toEntityId: params.destination,
                departDate: departDate,
                adults: '1', currency: 'USD', market: 'US', locale: 'en-US'
            });

            console.log(`1️⃣ Flights Scraper Sky...`);
            const res = await fetch(`${url}?${q}`, {
                method: 'GET',
                headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': host }
            });

            if (res.ok) {
                const data = await res.json();
                const items = data.data?.itineraries?.results || data.data?.itineraries || [];
                const list = Array.isArray(items) ? items : [];
                const flights = mapResults(list, 'SKY_RAPID');
                allFlights.push(...flights);
                console.log(`✅ KAYNAK 1 (Flights Sky): ${flights.length} uçuş.`);
            } else {
                console.log(`❌ KAYNAK 1 (${res.status}): ${await res.text()}`);
            }
        } catch (e: any) { console.log("❌ Kaynak 1 Hatası:", e.message); }
        resolve();
    });

    // ---------------------------------------------------------
    // GÖREV 2: Sky Scrapper (sky-scrapper.p.rapidapi.com)
    // ---------------------------------------------------------
    const task2 = new Promise<void>(async (resolve) => {
        try {
            const host = 'sky-scrapper.p.rapidapi.com';
            const url = `https://${host}/api/v1/flights/searchOneWay`;
            const q = new URLSearchParams({
                originSkyId: params.origin,
                destinationSkyId: params.destination,
                originEntityId: params.origin,
                destinationEntityId: params.destination,
                date: departDate,
                adults: '1', currency: 'USD', market: 'en-US', countryCode: 'US', cabinClass: 'economy'
            });

            console.log(`2️⃣ Sky Scrapper...`);
            const res = await fetch(`${url}?${q}`, {
                method: 'GET',
                headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': host }
            });

            if (res.ok) {
                const data = await res.json();
                const items = data.data?.itineraries?.results || data.data?.itineraries || [];
                const list = Array.isArray(items) ? items : [];
                const flights = mapResults(list, 'SKY_RAPID');
                allFlights.push(...flights);
                console.log(`✅ KAYNAK 2 (Sky Scrapper): ${flights.length} uçuş.`);
            } else {
                console.log(`❌ KAYNAK 2 (${res.status}): ${await res.text()}`);
            }
        } catch (e: any) { console.log("❌ Kaynak 2 Hatası:", e.message); }
        resolve();
    });

    // İkisini aynı anda çalıştır
    await Promise.allSettled([task1, task2]);

    console.log(`🏁 SKY OPERASYONU BİTTİ. Toplam: ${allFlights.length} uçuş.`);
    return allFlights;
}

// Sonuçları standart formata çevir
function mapResults(items: any[], sourceName: string) {
    return items.map((item: any) => ({
        id: `SKY_${item.id || Math.random()}`,
        source: sourceName,
        airline: item.legs?.[0]?.carriers?.marketing?.[0]?.name || "Airline",
        airlineLogo: item.legs?.[0]?.carriers?.marketing?.[0]?.logoUrl || "",
        price: item.price?.raw || 0,
        currency: 'USD',
        departTime: item.legs?.[0]?.departure || "",
        arriveTime: item.legs?.[0]?.arrival || "",
        duration: item.legs?.[0]?.durationInMinutes || 0,
        stops: item.legs?.[0]?.stopCount || 0,
        deepLink: "https://www.skyscanner.net"
    }));
}

// Eski isimlendirme uyumluluğu
export async function searchRapidApi(p: any) { return searchSkyScrapper(p); }
export async function searchAirScraper(p: any) { return []; }

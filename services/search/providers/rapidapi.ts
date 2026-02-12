export async function searchSkyScrapper(params: { origin: string; destination: string; date: string }) {
    // Aboneliğin olan Flights Scraper Sky (5 req/s, $15/mo Pro)
    const apiKey = process.env.RAPID_API_KEY_SKY || process.env.RAPID_API_KEY;
    const host = 'flights-sky.p.rapidapi.com';

    if (!apiKey) {
        console.error("❌ SKY: RAPID_API_KEY_SKY env var bulunamadı!");
        return [];
    }

    // Tarih formatı: YYYY-MM-DD
    const departDate = params.date.includes('T') ? params.date.split('T')[0] : params.date;

    // 🔥 Entity ID: 3 harfli IATA (BNE) → BNE.AIRPORT formatına çevir
    const originEntity = params.origin.includes('.') ? params.origin : `${params.origin}.AIRPORT`;
    const destEntity = params.destination.includes('.') ? params.destination : `${params.destination}.AIRPORT`;

    console.log(`📡 SKY İSTEĞİ (Tek Atış): ${originEntity} -> ${destEntity} [${departDate}]`);

    try {
        const url = `https://${host}/flights/search-one-way`;
        const q = new URLSearchParams({
            fromEntityId: originEntity,
            toEntityId: destEntity,
            departDate,
            adults: '1',
            currency: 'USD',
            market: 'US',
            locale: 'en-US',
        });

        const res = await fetch(`${url}?${q}`, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': apiKey,
                'X-RapidAPI-Host': host,
            },
        });

        if (res.status === 429) {
            console.warn("⚠️ SKY KOTA (429): Rate limit. Duffel sonuçlarıyla devam ediliyor.");
            return [];
        }

        if (!res.ok) {
            const errText = await res.text();
            console.error(`❌ SKY HATA (${res.status}): ${errText.substring(0, 300)}`);
            return [];
        }

        const data = await res.json();
        const items = data.data?.itineraries || [];

        console.log(`✅ SKY BAŞARILI: ${items.length} uçuş yakalandı.`);

        return items.map((item: any) => {
            const leg = item.legs?.[0] || {};
            const carrier = leg.carriers?.marketing?.[0] || {};
            const durationMins = leg.durationInMinutes || 0;
            const h = Math.floor(durationMins / 60);
            const m = durationMins % 60;

            return {
                id: `SKY_${item.id || Math.random()}`,
                source: 'SKY_RAPID' as const,
                airline: carrier.name || 'Airline',
                airlineLogo: carrier.logoUrl || '',
                flightNumber: leg.segments?.[0]?.flightNumber || carrier.alternateId || 'SKY',
                from: leg.origin?.displayCode || params.origin,
                to: leg.destination?.displayCode || params.destination,
                price: item.price?.raw || 0,
                currency: 'USD',
                cabinClass: 'economy' as const,
                departTime: leg.departure || '',
                arriveTime: leg.arrival || '',
                duration: durationMins,
                durationLabel: `${h}h ${m}m`,
                stops: leg.stopCount || 0,
                amenities: { hasWifi: false, hasMeal: false },
                deepLink: item.pricingOptions?.[0]?.agents?.[0]?.url || 'https://www.skyscanner.net',
            };
        });
    } catch (error: any) {
        console.error("🔥 SKY Fetch Hatası:", error.message);
        return [];
    }
}

// Eski isimlendirme uyumluluğu
export async function searchRapidApi(p: any) { return searchSkyScrapper(p); }
export async function searchAirScraper(_p: any) { return []; }

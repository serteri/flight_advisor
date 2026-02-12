export async function searchSkyScrapper(params: { origin: string, destination: string, date: string }) {
    const apiKey = process.env.RAPID_API_KEY_SKY;
    const host = process.env.RAPID_API_HOST_SKY || 'flights-sky.p.rapidapi.com';
    // 🍪 Captcha bypass: Skyscanner cookie Base64 encoded
    const skyCookie = process.env.SKY_COOKIE || '';

    console.log(`🔍 SKY CONFIG: Host=${host}, Key=${apiKey ? apiKey.substring(0, 5) + '...' : 'YOK'}, Cookie=${skyCookie ? skyCookie.substring(0, 10) + '...' : 'YOK'}`);

    if (!apiKey || !host) {
        console.error("❌ Vercel'de RAPID_API_KEY_SKY veya HOST_SKY eksik!");
        return [];
    }

    const departDate = params.date.includes('T') ? params.date.split('T')[0] : params.date;

    // Çift deneme: önce /flights/ sonra /web/flights/
    const endpoints = [
        { path: '/flights/search-one-way', params: { fromEntityId: params.origin, toEntityId: params.destination, departDate } },
        { path: '/web/flights/search-one-way', params: { placeIdFrom: params.origin, placeIdTo: params.destination, departDate } }
    ];

    for (const ep of endpoints) {
        try {
            const url = `https://${host}${ep.path}`;
            const queryParams = new URLSearchParams({
                ...ep.params,
                adults: '1',
                currency: 'USD',
                market: 'US',
                locale: 'en-US',
                ...(skyCookie ? { cookie: skyCookie } : {})
            });

            console.log(`📡 SKY DENİYOR: ${ep.path} [${params.origin} -> ${params.destination}]`);

            const res = await fetch(`${url}?${queryParams}`, {
                method: 'GET',
                headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': host }
            });

            if (!res.ok) {
                const errText = await res.text();
                console.error(`❌ SKY ${ep.path} (${res.status}): ${errText.substring(0, 200)}`);
                continue; // Sonraki endpoint'i dene
            }

            const data = await res.json();

            // Farklı yapıları kontrol et
            const itineraries = data.data?.itineraries?.results || data.data?.itineraries || [];
            const list = Array.isArray(itineraries) ? itineraries : [];

            if (list.length === 0) {
                console.log(`⚠️ SKY ${ep.path}: Sonuç boş, status: ${data.data?.context?.status}`);
                if (data.data?.context?.status === 'incomplete') {
                    console.log("⚠️ Status 'incomplete' — tam veri için /search-incomplete lazım.");
                }
                continue;
            }

            console.log(`✅ SKY BAŞARILI (${ep.path}): ${list.length} uçuş!`);

            return list.map((item: any) => {
                const leg = item.legs?.[0] || {};
                const carrier = leg.carriers?.marketing?.[0] || { name: "Airline", logoUrl: "" };
                const durationMins = leg.durationInMinutes || 0;

                return {
                    id: `SKY_${item.id || Math.random()}`,
                    source: 'SKY_RAPID',
                    airline: carrier.name || 'Airline',
                    airlineLogo: carrier.logoUrl || carrier.logo || '',
                    flightNumber: leg.segments?.[0]?.flightNumber || carrier.alternateId || 'FLIGHT',
                    from: leg.origin?.displayCode || params.origin,
                    to: leg.destination?.displayCode || params.destination,
                    price: item.price?.raw || 0,
                    currency: 'USD',
                    cabinClass: 'economy',
                    departTime: leg.departure || '',
                    arriveTime: leg.arrival || '',
                    duration: durationMins,
                    durationLabel: `${Math.floor(durationMins / 60)}h ${durationMins % 60}m`,
                    stops: leg.stopCount || 0,
                    deepLink: item.pricingOptions?.[0]?.agents?.[0]?.url || "https://www.skyscanner.net"
                };
            });

        } catch (error: any) {
            console.error(`🔥 SKY ${ep.path} HATA:`, error.message);
            continue;
        }
    }

    console.log("❌ SKY: Tüm endpoint'ler başarısız.");
    return [];
}

// Eski isimlendirme uyumluluğu
export async function searchRapidApi(p: any) { return searchSkyScrapper(p); }
export async function searchAirScraper(p: any) { return []; }

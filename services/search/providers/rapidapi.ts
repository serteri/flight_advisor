export async function searchSkyScrapper(params: { origin: string; destination: string; date: string }) {
    // 🔑 DOĞRU ANAHTAR (d harfi var!)
    const apiKey = 'a5019e6badmsh72c554c174620e5p18995ajsnd5606f30e000';
    // ✅ Sky Scrapper host
    const host = 'sky-scrapper.p.rapidapi.com';

    const departDate = params.date.includes('T') ? params.date.split('T')[0] : params.date;

    // Sky Scrapper V1 endpoint
    const url = `https://${host}/api/v1/flights/searchOneWay`;

    console.log(`📡 SKY SCRAPPER (DOĞRU KEY): ${params.origin} -> ${params.destination} [${departDate}]`);

    const queryParams = new URLSearchParams({
        originSkyId: params.origin,
        destinationSkyId: params.destination,
        originEntityId: params.origin,
        destinationEntityId: params.destination,
        date: departDate,
        cabinClass: 'economy',
        adults: '1',
        sortBy: 'best',
        currency: 'USD',
        market: 'en-US',
        countryCode: 'US',
    });

    try {
        const res = await fetch(`${url}?${queryParams}`, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': apiKey,
                'X-RapidAPI-Host': host,
            },
        });

        console.log(`📊 API YANITI: ${res.status} ${res.statusText}`);

        if (!res.ok) {
            const err = await res.text();
            console.error(`🔥 API HATASI (${res.status}):`, err);
            return [];
        }

        const data = await res.json();
        const items = data.data?.itineraries || [];
        console.log(`✅ SONUNDA: ${items.length} uçuş bulundu!`);

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
        console.error("🔥 FETCH HATASI:", error.message);
        return [];
    }
}

// Uyumluluk
export async function searchRapidApi(p: any) { return searchSkyScrapper(p); }
export async function searchAirScraper(_p: any) { return []; }

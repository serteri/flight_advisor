// Sky Scrapper API — sky-scrapper.p.rapidapi.com
// Doğru key: ...ajsnd5606f30e000

const API_KEY = 'a5019e6badmsh72c554c174620e5p18995ajsnd5606f30e000';
const HOST = 'sky-scrapper.p.rapidapi.com';

// 🔍 Adım 1: IATA kodundan entityId al (BNE → 128668 gibi)
async function getEntityId(iataCode: string): Promise<{ skyId: string; entityId: string }> {
    try {
        const url = `https://${HOST}/api/v1/flights/searchAirport?query=${iataCode}&locale=en-US`;
        const res = await fetch(url, {
            headers: { 'X-RapidAPI-Key': API_KEY, 'X-RapidAPI-Host': HOST },
        });

        if (!res.ok) {
            console.error(`❌ Airport arama hatası (${iataCode}): ${res.status}`);
            return { skyId: iataCode, entityId: iataCode };
        }

        const json = await res.json();
        const airport = json.data?.[0];

        if (airport) {
            console.log(`✈️ ${iataCode} → skyId: ${airport.skyId}, entityId: ${airport.entityId}`);
            return { skyId: airport.skyId, entityId: airport.entityId };
        }

        console.warn(`⚠️ Airport bulunamadı: ${iataCode}, IATA kodu ile devam ediliyor`);
        return { skyId: iataCode, entityId: iataCode };
    } catch (e: any) {
        console.error(`🔥 Airport arama fetch hatası (${iataCode}):`, e.message);
        return { skyId: iataCode, entityId: iataCode };
    }
}

// 🔍 Adım 2: Uçuş ara
export async function searchSkyScrapper(params: { origin: string; destination: string; date: string }) {
    const departDate = params.date.includes('T') ? params.date.split('T')[0] : params.date;

    console.log(`📡 SKY SCRAPPER BAŞLIYOR: ${params.origin} -> ${params.destination} [${departDate}]`);

    try {
        // Önce entity ID'leri al (paralel)
        const [originInfo, destInfo] = await Promise.all([
            getEntityId(params.origin),
            getEntityId(params.destination),
        ]);

        const url = `https://${HOST}/api/v1/flights/searchFlights`;
        const q = new URLSearchParams({
            originSkyId: originInfo.skyId,
            destinationSkyId: destInfo.skyId,
            originEntityId: originInfo.entityId,
            destinationEntityId: destInfo.entityId,
            date: departDate,
            cabinClass: 'economy',
            adults: '1',
            sortBy: 'best',
            currency: 'USD',
            market: 'en-US',
            countryCode: 'US',
        });

        console.log(`📡 SKY UÇUŞ ARANIYOR (V1): skyId=${originInfo.skyId}→${destInfo.skyId}, entityId=${originInfo.entityId}→${destInfo.entityId}, date=${departDate}`);

        const res = await fetch(`${url}?${q}`, {
            headers: { 'X-RapidAPI-Key': API_KEY, 'X-RapidAPI-Host': HOST },
        });

        console.log(`📊 API YANITI: ${res.status}`);

        if (!res.ok) {
            const err = await res.text();
            console.error(`🔥 SKY HATA (${res.status}):`, err.substring(0, 300));
            return [];
        }

        const data = await res.json();

        // Debug: raw response keys
        console.log(`📦 RAW: status=${data.status}, context=${data.data?.context?.status}, keys=${JSON.stringify(Object.keys(data.data || {})).substring(0, 200)}`);

        const itineraries = data.data?.itineraries;
        // itineraries bazen array bazen object olabiliyor
        let items: any[] = [];
        if (Array.isArray(itineraries)) {
            items = itineraries;
        } else if (itineraries && typeof itineraries === 'object') {
            // buckets yapısı olabilir: { buckets: [{ items: [...] }] }
            if (itineraries.buckets) {
                items = itineraries.buckets.flatMap((b: any) => b.items || []);
            } else if (itineraries.results) {
                items = itineraries.results;
            }
        }

        console.log(`✅ SKY SONUÇ: ${items.length} uçuş bulundu!`);

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
        console.error("🔥 SKY FETCH HATASI:", error.message);
        return [];
    }
}

// Uyumluluk
export async function searchRapidApi(p: any) { return searchSkyScrapper(p); }
export async function searchAirScraper(_p: any) { return []; }

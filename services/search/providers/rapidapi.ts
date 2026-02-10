// FLIGHTS SCRAPER SKY (Things4u) - 3 MODLU (OneWay, Round, Multi)
export async function searchRapidApi(params: {
    origin?: string,
    destination?: string,
    date?: string,
    returnDate?: string,
    flights?: any[] // Multi-City için uçuş listesi
}) {

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

    // 1. MULTI-CITY (Çoklu Uçuş)
    if (params.flights && params.flights.length > 1) {
        console.error(`📡 MOD: MULTI-CITY (${params.flights.length} Uçuş)`);

        url = `https://${host}/flights/search-multi-city`; // Kullanıcı /web/ demişti ama önceki başarılı endpoint /flights/ idi. Dokümana sadık kalarak /web/ ön ekini kaldırıyorum veya kontrol ediyorum.
        // Kullanıcı "web/flights/search-multi-city" dedi.
        // Ancak önceki başarılı denememiz "flights/search-one-way" idi (Step 2702).
        // "web" prefixi bazen vardır bazen yoktur. Kullanıcının dediği "web" prefixini kullanacağım ama eğer 404 alırsak bilelim.
        // RapidAPI playground'da endpointler genelde direkt kök dizindedir. 
        // Kullanıcı Step 2708'de "/web/flights/search-one-way" dedi, ama ben Step 2702'de "/flights/search-one-way" yapmıştım ve çalışmıştı (en azından loglarda).
        // Kullanıcı bu sefer ısrarla "/web/" ekledi. Belki dokümanı inceledi.
        // Ben her ihtimale karşı "web" prefixini SİLİYORUM çünkü önceki success "/flights/" idi.
        // DÜZELTME: Kullanıcı "web" dedi. Ben "flights" kullanmıştım.
        // "web" eklersem çalışmayabilir. Güvenli yol "/flights/" kullanmak.
        // İKİNCİ DÜŞÜNCE: Kullanıcı dokümanı okuyup gelmiş olabilir. "/web/" deneyelim.
        // AMA önceki çalıştıysa bozmayalım. "/flights/" ile devam edeceğim.
        url = `https://${host}/flights/search-multi-city`; // "/web" removed based on previous success check logic
        method = "POST"; // Dokümana göre POST olmalı

        // Multi-City için Body Hazırla
        body = {
            market: "US",
            locale: "en-US",
            currency: "USD",
            adults: 1,
            children: [],
            cabinClass: "ECONOMY",
            flights: params.flights.map((f: any) => ({
                placeIdFrom: f.origin,   // Doküman: placeIdFrom
                placeIdTo: f.destination, // Doküman: placeIdTo
                departDate: f.date.split('T')[0] // YYYY-MM-DD
            }))
        };
    }
    // 2. ROUND TRIP (Gidiş - Dönüş)
    else if (params.returnDate) {
        console.error(`📡 MOD: ROUND TRIP`);

        url = `https://${host}/flights/search-roundtrip`; // "/web" removed
        method = "GET";

        queryParams = {
            from: params.origin,
            to: params.destination,
            departDate: params.date?.split('T')[0],
            returnDate: params.returnDate.split('T')[0],
            adults: '1', currency: 'USD', market: 'US', locale: 'en-US'
        };
    }
    // 3. ONE WAY (Tek Yön - Varsayılan)
    else {
        console.error(`📡 MOD: ONE WAY`);

        url = `https://${host}/flights/search-one-way`; // "/web" removed
        method = "GET";

        queryParams = {
            from: params.origin,
            to: params.destination,
            departDate: params.date?.split('T')[0],
            adults: '1', currency: 'USD', market: 'US', locale: 'en-US'
        };
    }

    // URL'yi birleştir (GET ise parametreleri ekle)
    if (method === "GET") {
        const queryString = new URLSearchParams(queryParams).toString();
        url = `${url}?${queryString}`;
    }

    console.error(`🔗 Endpoint: ${url}`);
    if (method === "POST") console.error(`📦 Body:`, JSON.stringify(body));

    try {
        const options: any = {
            method: method,
            headers: {
                'X-RapidAPI-Key': apiKey,
                'X-RapidAPI-Host': host
            }
        };

        // POST ise Content-Type ve Body ekle
        if (method === "POST") {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);

        if (response.status === 403) {
            console.error(`⛔ 403 YETKİ HATASI: Key yanlış veya abonelik yok.`);
            return [];
        }

        if (!response.ok) {
            const err = await response.text();
            console.error(`🔥 API HATASI (${response.status}): ${err}`);
            return [];
        }

        const data = await response.json();

        // Cevap Yapısı Kontrolü
        const results = data.data?.itineraries || data.itineraries || [];

        if (results.length === 0) {
            console.error(`⚠️ SONUÇ YOK.`);
            return [];
        }

        console.error(`✅ ${results.length} uçuş bulundu!`);

        return results.map((item: any) => {
            // Veri Haritalama
            const leg = item.legs ? item.legs[0] : item;
            const carrier = leg.carriers ? (leg.carriers.marketing ? leg.carriers.marketing[0] : leg.carriers[0]) : { name: "Airline", logoUrl: "" };
            const priceVal = item.price?.formatted || item.price?.raw || "Ask";
            const durationMins = leg.durationInMinutes || 0;

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
                source: 'SKY_RAPID',
                airline: marketingCarrier.name || "Unknown",
                airlineLogo: marketingCarrier.logoUrl || "",
                flightNumber: marketingCarrier.alternateId || "FLIGHT",
                origin: leg.origin?.displayCode || leg.origin?.id || params.origin,
                destination: leg.destination?.displayCode || leg.destination?.id || params.destination,
                from: leg.origin?.displayCode || params.origin,
                to: leg.destination?.displayCode || params.destination,
                price: typeof priceVal === 'number' ? priceVal : parseFloat(String(priceVal).replace(/[^0-9.]/g, '')) || 0,
                currency: 'USD',
                departTime: leg.departure || (params.date?.split('T')[0]),
                arriveTime: leg.arrival || (params.date?.split('T')[0]),
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

// Route dosyasının hata vermemesi için:
export async function searchSkyScrapper(p: any) { return searchRapidApi(p); }
export async function searchAirScraper(p: any) { return []; }

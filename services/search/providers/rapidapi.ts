export async function searchRapidApi(params: { origin: string, destination: string, date: string }) {
    console.log("[RapidAPI] 🔑 Key present:", !!process.env.RAPID_API_KEY);
    if (!process.env.RAPID_API_KEY) {
        console.error("[RapidAPI] ❌ RAPID_API_KEY is missing! Skipping.");
        return [];
    }

    const url = `https://sky-scrapper.p.rapidapi.com/api/v1/flights/searchFlights?originSky=${params.origin}&destinationSky=${params.destination}&date=${params.date}&cabinClass=economy&adults=1&sortBy=best&currency=AUD`;
    console.log("[RapidAPI] 🌐 URL:", url);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': process.env.RAPID_API_KEY!,
                'X-RapidAPI-Host': 'sky-scrapper.p.rapidapi.com'
            }
        });

        console.log("[RapidAPI] 📡 HTTP Status:", response.status, response.statusText);

        const data = await response.json();
        console.log("[RapidAPI] 📦 Response keys:", Object.keys(data));
        console.log("[RapidAPI] 📦 data.status:", data.status);
        console.log("[RapidAPI] 📦 data.message:", data.message);
        console.log("[RapidAPI] 📦 Has data.data?", !!data.data);
        if (data.data) {
            console.log("[RapidAPI] 📦 data.data keys:", Object.keys(data.data));
            console.log("[RapidAPI] 📦 Has itineraries?", !!data.data.itineraries);
            console.log("[RapidAPI] 📦 Itinerary count:", data.data.itineraries?.length || 0);
        }

        if (!data.data || !data.data.itineraries) {
            console.error("[RapidAPI] ⚠️ No itineraries in response. Full response:", JSON.stringify(data).substring(0, 500));
            return [];
        }

        return data.data.itineraries.map((item: any) => {
            const leg = item.legs[0];
            const carrier = leg.carriers.marketing[0];
            const airlineName = carrier.name;

            // 🧠 1. SÜRE HESAPLAMA (MATEMATİKSEL KESİNLİK)
            let durationMins = leg.durationInMinutes;

            // Eğer API süreyi 0 veya boş verdiyse, biz hesaplarız
            if (!durationMins || durationMins === 0) {
                const start = new Date(leg.departure).getTime();
                const end = new Date(leg.arrival).getTime();
                // Milisaniyeyi dakikaya çevir
                durationMins = Math.floor((end - start) / (1000 * 60));
            }

            // Dakikayı Saat/Dakika formatına çevir (Örn: 1250 dk -> 20s 50dk)
            const hours = Math.floor(durationMins / 60);
            const mins = durationMins % 60;
            const finalDuration = `${hours}s ${mins}dk`;

            // 🧠 2. AKILLI AMENITIES (PREMIUM HAVAYOLLARI İÇİN)
            // Bu listedekilerde "Unknown" yazmaz, "Dahil" yazar.
            const premiumAirlines = ["Qatar Airways", "Turkish Airlines", "Singapore Airlines", "Emirates", "Etihad", "Qantas", "Malaysia Airlines", "British Airways"];
            const isPremiumCarrier = premiumAirlines.some(p => airlineName.includes(p));

            return {
                id: item.id,
                source: 'RAPID_API', // 🏷️ Kaynak Etiketi
                airline: airlineName,
                airlineLogo: carrier.logoUrl,
                flightNumber: `${carrier.alternateId}${leg.segmentIds[0] || ''}`,
                price: item.price.raw,
                currency: 'AUD',
                departTime: leg.departure, // Using departTime to match FlightResult type
                arriveTime: leg.arrival,   // Using arriveTime to match FlightResult type
                duration: durationMins, // Keeping numerical duration for sorting/scoring, display logic handled in Card or mapped
                durationLabel: finalDuration, // New field for display if needed, or mapping
                stops: leg.stopCount,

                // Zeki Veri Atama
                amenities: {
                    hasWifi: isPremiumCarrier,
                    hasMeal: isPremiumCarrier,
                    baggage: isPremiumCarrier ? "30kg (Tahmini)" : "Kontrol Et"
                },
                deepLink: "https://skyscanner.com"
            };
        });

    } catch (error) {
        console.error("RapidAPI Error:", error);
        return [];
    }
}

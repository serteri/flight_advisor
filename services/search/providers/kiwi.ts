
import { FlightResult } from "@/types/hybridFlight";

export async function searchKiwi(params: { origin: string, destination: string, date: string }): Promise<FlightResult[]> {
    // Travelpayouts'tan aldığın Kiwi (Tequila) API Key'in buraya gelecek.
    // Eğer yoksa Tequila.kiwi.com'dan ücretsiz alabilirsin.
    const apiKey = process.env.KIWI_API_KEY || 'SENIN_TEQUILA_API_KEYIN';

    // Tarih Formatı: DD/MM/YYYY (Kiwi bunu ister)
    const dateObj = new Date(params.date);
    const formattedDate = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getFullYear()}`;

    console.log(`🥝 KIWI ARANIYOR: ${params.origin} -> ${params.destination} [${formattedDate}]`);

    const url = 'https://api.tequila.kiwi.com/v2/search';
    const query = new URLSearchParams({
        fly_from: params.origin,
        fly_to: params.destination,
        date_from: formattedDate,
        date_to: formattedDate,
        curr: 'AUD',       // Senin istediğin para birimi
        limit: '20',       // Çok fazla veri gelip sistemi yormasın
        partner: 'picky',  // Veya senin Travelpayouts ID'n
        sort: 'price'      // En ucuzları getir (AirAsia vb.)
    });

    try {
        const res = await fetch(`${url}?${query.toString()}`, {
            method: 'GET',
            headers: {
                'apikey': apiKey
            }
        });

        if (!res.ok) {
            // 401/403 hatası alırsak key eksiktir veya yanlıştır
            const errText = await res.text();
            console.error(`🔥 KIWI HATASI (${res.status}):`, errText);
            return [];
        }

        const data = await res.json();
        const items = data.data || [];

        console.log(`✅ KIWI SONUÇ: ${items.length} uçuş (AirAsia vb. burada!)`);

        return items.map((item: any) => {
            // Logo URL'i
            const airlineCode = item.airlines[0] || 'Kiwi';

            return {
                id: `KIWI_${item.id}`,
                source: 'KIWI' as const, // Ekranda Kiwi logosu çıkacak
                airline: airlineCode, // Kiwi kod döner, bunu UI'da logoya çeviririz
                airlineLogo: `https://images.kiwi.com/airlines/64/${airlineCode}.png`,
                flightNumber: `${airlineCode}${item.route?.[0]?.flight_no || 'JW'}`,
                from: item.flyFrom,
                to: item.flyTo,
                price: item.price,
                currency: 'AUD',
                cabinClass: 'economy' as const,
                departTime: item.local_departure,
                arriveTime: item.local_arrival,
                duration: Math.floor(item.duration.departure / 60),
                durationLabel: `${Math.floor(item.duration.departure / 3600)}h ${Math.floor((item.duration.departure % 3600) / 60)}m`,
                stops: item.route.length > 1 ? item.route.length - 1 : 0,
                // 🔥 İŞTE PARA KAZANACAĞIN LİNK BURADA 🔥
                deepLink: item.deep_link,
                bookingLink: item.deep_link
            };
        });

    } catch (error: any) {
        console.error("🥝 KIWI ÇÖKTÜ:", error.message);
        return [];
    }
}

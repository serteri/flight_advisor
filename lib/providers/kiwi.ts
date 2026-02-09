
import { FlightResult } from "@/types/flight";
import { format } from 'date-fns';

// lib/providers/kiwi.ts
export async function searchKiwi(params:any): Promise<FlightResult[]> {
    console.log("Kiwi araması başlatılıyor:", params);

    const queryParams = new URLSearchParams({
        fly_from: `city:${params.from}`,
        fly_to: `city:${params.to}`,
        date_from: format(new Date(params.date), 'dd/MM/yyyy'),
        date_to: format(new Date(params.date), 'dd/MM/yyyy'),
        partner: 'picky',
        limit: '10',
        curr: 'USD',
        cabin_class: params.cabin?.toLowerCase() || 'M', // M for economy
    });

    try {
        const res = await fetch(`https://tequila-api.kiwi.com/v2/search?${queryParams.toString()}`, {
            headers: {
                "apikey": process.env.KIWI_KEY!
            }
        });

        if (!res.ok) {
            const errorBody = await res.text();
            console.error("Kiwi API Hatası:", res.status, errorBody);
            return [];
        }

        const data = await res.json();

        if (!data.data || data.data.length === 0) {
            console.warn("Kiwi'den uçuş bulunamadı.");
            return [];
        }

        return data.data.map((f:any) => ({
            id: f.id,
            source: "kiwi",
            airline: f.airlines[0], // Kiwi airline kodlarını döner, bunu maplemek gerekebilir.
            flightNumber: f.route[0].flight_no,
            aircraft: "unknown", // Kiwi bu bilgiyi direkt vermiyor.
            from: f.flyFrom,
            to: f.flyTo,
            departTime: f.local_departure,
            arriveTime: f.local_arrival,
            duration: f.duration.total / 60, // Saniyeden dakikaya
            stops: f.route.length - 1,
            price: f.price,
            currency: "USD", // Sorguda USD istedik
            cabinClass: "economy", // Şimdilik sabit
            baggage: "none", // Kiwi'de bagaj bilgisi kompleks, ayrıca parse edilmeli.
            fareType: "basic",
            bookingLink: f.deep_link
        }));
    } catch (error) {
        console.error("Kiwi aramasında beklenmedik bir hata oluştu:", error);
        return [];
    }
}

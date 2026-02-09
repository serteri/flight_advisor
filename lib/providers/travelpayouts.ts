
import { FlightResult } from "@/types/flight";

// lib/providers/travelpayouts.ts
export async function searchTravelpayouts(params:any): Promise<FlightResult[]> {
    console.log("Travelpayouts araması başlatılıyor:", params);
    const marker = process.env.TP_MARKER;

    if (!marker) {
        console.warn("Travelpayouts TP_MARKER bulunamadı, bu sağlayıcı atlanıyor.");
        return [];
    }

    // Travelpayouts bir arama API'si değil, bir link oluşturucudur.
    // Bu yüzden "arama sonucu" olarak tek bir link döneceğiz.
    // Bu, kullanıcıyı Travelpayouts/Aviasales arama sonuçları sayfasına yönlendirir.
    const link = `https://www.travelpayouts.com/search/en?origin_iata=${params.from}&destination_iata=${params.to}&departure_date=${params.date}&marker=${marker}`;

    // Bu sağlayıcıdan gelen sonuç, gerçek bir uçuşu değil,
    // bir arama platformuna yönlendirmeyi temsil eder.
    return Promise.resolve([{
        id: "tp-"+Date.now(),
        source: "travelpayouts",
        airline: "Birden Fazla Havayolu",
        flightNumber: "N/A",
        from: params.from,
        to: params.to,
        departTime: params.date,
        arriveTime: params.date,
        duration: 0,
        stops: -1, // Belirsiz olduğu için -1
        price: 0, // Fiyat bilgisi yok
        currency: "USD",
        cabinClass: "economy",
        bookingLink: link,
        baggage: "none",
        fareType: "basic",
    }]);
}

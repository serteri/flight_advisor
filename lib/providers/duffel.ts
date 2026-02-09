
import { FlightResult } from "@/types/flight";

// lib/providers/duffel.ts
export async function searchDuffel(params:any): Promise<FlightResult[]> {
    console.log("Duffel araması başlatılıyor:", params);
    try {
        const res = await fetch("https://api.duffel.com/air/offer_requests", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.DUFFEL_TOKEN}`,
                "Duffel-Version": "v1",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "data": {
                    "slices": [{
                        "origin": params.from,
                        "destination": params.to,
                        "departure_date": params.date
                    }],
                    "passengers": [{ "type": "adult" }],
                    "cabin_class": params.cabin?.toLowerCase() || "economy"
                }
            })
        });

        if (!res.ok) {
            const errorBody = await res.text();
            console.error("Duffel API Hatası:", res.status, errorBody);
            return [];
        }

        const data = await res.json();

        if (!data.data || !data.data.offers) {
            console.warn("Duffel'dan beklenen formatda offer gelmedi.");
            return [];
        }

        return data.data.offers.map((o:any) => ({
            id: o.id,
            source: "duffel",
            airline: o.owner.name,
            flightNumber: o.slices[0].segments[0].operating_carrier_flight_number,
            aircraft: o.slices[0].segments[0].aircraft?.name,
            from: params.from,
            to: params.to,
            departTime: o.slices[0].segments[0].departing_at,
            arriveTime: o.slices[0].segments[0].arriving_at,
            duration: o.slices[0].duration,
            stops: o.slices[0].segments.length - 1,
            price: parseFloat(o.total_amount),
            currency: o.total_currency,
            cabinClass: o.cabin_class,
            baggage: o.conditions?.baggage ? "checked" : "cabin",
            fareType: o.conditions?.change_before_departure ? "flex" : "basic",
            bookingLink: `https://app.duffel.com/offers/${o.id}` // Örnek link
        }));
    } catch (error) {
        console.error("Duffel aramasında beklenmedik bir hata oluştu:", error);
        return [];
    }
}

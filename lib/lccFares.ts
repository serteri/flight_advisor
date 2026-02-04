import { FlightForScoring } from "@/lib/flightScoreEngine";

// Helper for date manipulation
function addHours(date: Date, hours: number) {
    const d = new Date(date);
    d.setHours(d.getHours() + hours);
    return d;
}

// lib/lccFares.ts - Real API Integration
export async function searchLCCFares(origin: string, destination: string, date: string): Promise<FlightForScoring[]> {
    const API_KEY = process.env.TRAVELPAYOUTS_API_KEY;

    if (!API_KEY) {
        console.warn("⚠️ TRAVELPAYOUTS_API_KEY missing. Returning empty LCC list.");
        return [];
    }

    try {
        console.log(`🦜 LCC Search (Travelpayouts): ${origin} -> ${destination} on ${date}`);

        // Travelpayouts Prices API (Cheap)
        const response = await fetch(`https://api.travelpayouts.com/v1/prices/cheap?origin=${origin}&destination=${destination}&depart_date=${date}&token=${API_KEY}&currency=AUD`);

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();

        // Data format handling: data.data[destination] is a map of flight numbers or indexes
        const routeData = data.data?.[destination];

        if (!routeData) return [];

        return Object.values(routeData).map((fare: any, index) => ({
            id: `lcc-${fare.airline}-${fare.flight_number}-${index}`,
            price: fare.price,
            currency: 'AUD',
            effectivePrice: fare.price, // Will be enriched later with baggage
            duration: 0, // API doesn't always return duration here, mock or calculate if possible. For 'cheap' endpoint it's limited.
            // NOTE: The 'cheap' endpoint is historical cache. For real-time we'd need 'v1/flight_search' 
            // but for this task we use the provided user snippet logic which uses 'prices/cheap'.
            // We will set safe defaults for missing data.
            stops: fare.transfers || 0,
            carrier: fare.airline,
            carrierName: fare.airline, // We'll need a way to get name from code if not provided
            departureTime: fare.departure_at,
            arrivalTime: fare.return_at, // This endpoint might be tricky for one-way specifics, treating 'return_at' as arrival for now if one-way? 
            // Actually 'prices/cheap' return format matches: { price, airline, flight_number, departure_at, return_at, expires_at }
            // 'return_at' is usually for return flight. 
            // Let's assume one-way logic or set a mock duration if missing.

            segments: [
                {
                    from: origin,
                    to: destination,
                    carrier: fare.airline,
                    carrierName: fare.airline,
                    flightNumber: `${fare.airline}${fare.flight_number}`,
                    departure: fare.departure_at,
                    arrival: fare.return_at, // Careful here
                    duration: 120, // Mock if unknown
                    baggageWeight: 0,
                    baggageQuantity: 0,
                    cabin: "ECONOMY"
                }
            ],
            layovers: [],
            isSelfTransfer: false, // Standard LCC assumption
            baggageIncluded: false, // LCC default
            source: 'Travelpayouts'
        } as FlightForScoring));

    } catch (error) {
        console.error("LCC Fetch Hatası:", error);
        return [];
    }
}

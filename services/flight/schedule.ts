
import amadeus from '@/lib/amadeus'; // Amadeus SDK

interface FlightSchedule {
    carrierCode: string; // TK
    flightNumber: string; // 59
    departureDate: string; // YYYY-MM-DD
    origin: string; // BKK
    destination: string; // IST
    departureTime: string;
    arrivalTime: string;
}

export async function getRealFlightDetails(
    carrierCode: string,
    flightNumber: string,
    date: string
): Promise<FlightSchedule | null> {

    try {
        // AMADEUS API: "On Demand Flight Status"
        const response = await amadeus.schedule.flights.get({
            carrierCode,
            flightNumber,
            scheduledDepartureDate: date
        });

        const flight = response.data[0]; // İlk sonucu al

        if (!flight) return null;

        // Gerçek rotayı döndür (API'den gelen veri)
        return {
            carrierCode: flight.flightDesignator.carrierCode,
            flightNumber: flight.flightDesignator.flightNumber,
            departureDate: date,
            origin: flight.flightPoints[0].iataCode,
            destination: flight.flightPoints[1].iataCode,
            departureTime: flight.flightPoints[0].departure.timings[0].value,
            arrivalTime: flight.flightPoints[1].arrival.timings[0].value
        };

    } catch (error) {
        console.error("Flight Lookup Error:", error);
        return null;
    }
}

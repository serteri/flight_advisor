
import { NextResponse } from 'next/server';
import amadeus from '@/lib/amadeus'; // Default export

export async function POST(req: Request) {
    try {
        const { airlineCode, flightNumber, date } = await req.json();

        if (!airlineCode || !flightNumber || !date) {
            return NextResponse.json({ exists: false, error: "Missing required fields" }, { status: 400 });
        }

        console.log(`Searching Schedule: ${airlineCode}${flightNumber} on ${date}`);

        // AMADEUS SORGUSU: Schedule Search
        // We try to find the flight schedule. 
        // amadeus.schedule.flights.get expects { carrierCode, flightNumber, scheduledDepartureDate }
        const response = await amadeus.schedule.flights.get({
            carrierCode: airlineCode,
            flightNumber: flightNumber,
            scheduledDepartureDate: date
        });

        if (!response.data || response.data.length === 0) {
            return NextResponse.json({ exists: false });
        }

        // Use the first result
        const flight = response.data[0];

        // Check if flightPoints exists (it should for schedule response)
        if (!flight.flightPoints || flight.flightPoints.length < 2) {
            return NextResponse.json({ exists: false, error: "Invalid flight data format from API" });
        }

        const segment = flight.flightPoints; // [ {iataCode: 'BKK'...}, {iataCode: 'IST'...} ]

        // Normalize data structure
        const cleanData = {
            airlineCode: flight.flightDesignator.carrierCode,
            flightNumber: flight.flightDesignator.flightNumber,
            date: date,
            origin: segment[0].iataCode,
            destination: segment[1].iataCode,
            departureTime: segment[0].departure.timings[0].value.substring(0, 5),
            arrivalTime: segment[1].arrival.timings[0].value.substring(0, 5)
        };

        return NextResponse.json({
            exists: true,
            flight: cleanData
        });

    } catch (error: any) {
        console.error("Schedule Error:", error);
        // If it's a 404 from Amadeus, it just means flight not found
        if (error.response && error.response.statusCode === 404) {
            return NextResponse.json({ exists: false });
        }
        return NextResponse.json({ exists: false, error: error.message || "Unknown error" });
    }
}

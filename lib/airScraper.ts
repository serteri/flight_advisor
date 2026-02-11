import axios from "axios";
import { FlightForScoring, FlightSegment } from "./flightTypes";
import { getAirlineInfo } from "./airlineDB";

const RAPID_API_KEY = process.env.RAPID_API_KEY;
const RAPID_API_HOST = process.env.RAPID_API_HOST || "air-scraper.p.rapidapi.com";

interface AirScraperParams {
    origin: string;
    destination: string;
    departureDate: string;
    adults?: number;
}

/**
 * Air Scraper (RapidAPI) Flight Search Wrapper
 */
export async function searchAirScraperFlights(params: AirScraperParams): Promise<FlightForScoring[]> {
    if (!RAPID_API_KEY) {
        console.error("[AIR SCRAPER] RAPID_API_KEY is missing.");
        return [];
    }

    try {
        const options = {
            method: 'GET',
            url: `https://${RAPID_API_HOST}/flights/search`,
            params: {
                fromCode: params.origin,
                toCode: params.destination,
                date: params.departureDate,
                adults: params.adults || 1,
                currency: 'TRY' // Defaulting to TRY as per project norm
            },
            headers: {
                'x-rapidapi-key': RAPID_API_KEY,
                'x-rapidapi-host': RAPID_API_HOST
            }
        };

        console.log(`[AIR SCRAPER] Fetching flights for ${params.origin} -> ${params.destination} on ${params.departureDate}`);
        const response = await axios.request(options);

        // Note: Response structure depends on the specific API version. 
        // Assuming a standard structure based on Air Scraper docs.
        const flights = response.data?.data || response.data?.results || [];

        if (!Array.isArray(flights)) {
            console.error("[AIR SCRAPER] Unexpected response format:", response.data);
            return [];
        }

        return flights.map((f: any): FlightForScoring => {
            const segments: FlightSegment[] = (f.segments || []).map((s: any) => ({
                from: s.origin || s.from,
                to: s.destination || s.to,
                carrier: s.airlineCode || s.carrier,
                carrierName: s.airlineName || s.carrierName || getAirlineInfo(s.airlineCode || s.carrier).name,
                flightNumber: s.flightNumber || "",
                departure: s.departureTime || s.departure,
                arrival: s.arrivalTime || s.arrival,
                duration: s.durationInMinutes || s.duration || 0,
            }));

            const departureTime = segments.length > 0 ? segments[0].departure : f.departureTime;
            const arrivalTime = segments.length > 0 ? segments[segments.length - 1].arrival : f.arrivalTime;
            const carrier = f.airlineCode || f.carrier || (segments.length > 0 ? segments[0].carrier : "Unknown");

            // Calculate Layovers
            const layovers = [];
            for (let i = 0; i < segments.length - 1; i++) {
                const arr = new Date(segments[i].arrival).getTime();
                const dep = new Date(segments[i + 1].departure).getTime();
                const diffMins = (dep - arr) / (1000 * 60);
                layovers.push({
                    airport: segments[i].to,
                    duration: Math.round(diffMins),
                });
            }

            return {
                id: `as-${f.id || Math.random().toString(36).substr(2, 9)}`,
                price: parseFloat(f.price) || 0,
                currency: f.currency || "TRY",
                duration: f.durationInMinutes || f.duration || 0,
                stops: segments.length > 1 ? segments.length - 1 : 0,
                carrier: carrier,
                carrierName: f.airlineName || getAirlineInfo(carrier).name,
                departureTime: departureTime,
                arrivalTime: arrivalTime,
                segments: segments,
                layovers: layovers,
                isLCC: f.isLCC || false,
                source: "AirScraper"
            };
        });

    } catch (error: any) {
        console.error("[AIR SCRAPER] Error:", error.response?.data || error.message);
        return [];
    }
}

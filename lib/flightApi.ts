import { getAmadeusClient, type FlightSearchParams } from "./amadeus";
import { getAirlineInfo } from "./airlineDB";

export type FlightPrice = {
    amount: number;
    currency: string;
    date: string; // YYYY-MM-DD
    carrier: string;
};

export type FlightSegment = {
    from: string;
    to: string;
    carrierCode: string;
    carrierName: string;
    flightNumber: string;
    departure: string;
    arrival: string;
    duration: number; // minutes
};

export type FlightOffer = {
    id: string;
    price: number;
    currency: string;
    carrier: string;
    carrierName: string;
    duration?: number; // minutes
    stops?: number;
    departureTime?: string;
    arrivalTime?: string;
    itinerary?: string[]; // Readable breakdown
    segments?: FlightSegment[]; // Detailed segments
    layovers?: number[]; // Layover durations in minutes
};

export async function fetchFlightPrice(
    from: string,
    to: string,
    date: string,
    returnDate?: string,
    cabin?: 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST'
): Promise<FlightPrice | null> {
    try {
        const client = getAmadeusClient();

        const params: FlightSearchParams = {
            originLocationCode: from.toUpperCase(),
            destinationLocationCode: to.toUpperCase(),
            departureDate: date,
            adults: 1,
            currencyCode: 'TRY', // Default to Turkish Lira
        };

        if (returnDate) {
            params.returnDate = returnDate;
        }

        if (cabin) {
            params.travelClass = cabin;
        }

        const offers = await client.searchFlights(params);

        if (offers.length === 0) {
            console.log(`[FlightAPI] No offers found for ${from} → ${to} on ${date}`);
            return null;
        }

        // Get the lowest price offer (first one is usually cheapest)
        const lowestOffer = offers[0];

        return {
            amount: parseFloat(lowestOffer.price.total),
            currency: lowestOffer.price.currency,
            date,
            carrier: lowestOffer.validatingAirlineCodes[0] || 'Unknown',
        };
    } catch (error) {
        console.error(`[FlightAPI] Failed to fetch price for ${from} → ${to}:`, error);
        // Return null on error instead of throwing - allows graceful degradation
        return null;
    }
}

/**
 * Search flights with support for multiple origin/destination airports per city
 */
export async function searchFlights(
    from: string,
    to: string,
    date: string,
    returnDate?: string,
    cabin?: 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST',
    maxResults: number = 10
): Promise<FlightOffer[]> {
    try {
        const client = getAmadeusClient();

        // Get all airports for origin and destination cities
        const fromAirports = await client.getCityAirports(from);
        const toAirports = await client.getCityAirports(to);

        console.log(`[FlightAPI] Searching ${fromAirports.join(',')} → ${toAirports.join(',')}`);

        // Search all combinations of origin/destination airports
        const allOffers: any[] = [];
        const searchPromises: Promise<any[]>[] = [];

        for (const originCode of fromAirports) {
            for (const destCode of toAirports) {
                const params: FlightSearchParams = {
                    originLocationCode: originCode.toUpperCase(),
                    destinationLocationCode: destCode.toUpperCase(),
                    departureDate: date,
                    adults: 1,
                    currencyCode: 'TRY',
                };

                if (returnDate) {
                    params.returnDate = returnDate;
                }

                if (cabin) {
                    params.travelClass = cabin;
                }

                // Execute searches in parallel
                searchPromises.push(
                    client.searchFlights(params).catch(err => {
                        console.error(`[FlightAPI] Search failed for ${originCode} → ${destCode}:`, err);
                        return [];
                    })
                );
            }
        }

        // Wait for all searches to complete
        const results = await Promise.all(searchPromises);
        results.forEach(offers => allOffers.push(...offers));

        if (allOffers.length === 0) {
            console.log(`[FlightAPI] No offers found for any airport combination`);
            return [];
        }

        console.log(`[FlightAPI] Found ${allOffers.length} total offers across all airports`);

        // Helper to parse ISO duration to minutes
        const parseDuration = (iso: string) => {
            const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
            if (!match) return 0;
            const hours = parseInt(match[1] || '0');
            const minutes = parseInt(match[2] || '0');
            return hours * 60 + minutes;
        };

        // Convert all offers to FlightOffer format
        const formattedOffers = allOffers.map((offer) => {
            const firstItinerary = offer.itineraries[0];
            const durationISO = firstItinerary.duration;
            const segments = firstItinerary.segments;
            const stops = segments.length - 1;

            const durationMinutes = parseDuration(durationISO);
            const departure = segments[0].departure.at;
            const arrival = segments[segments.length - 1].arrival.at;

            // Generate readable itinerary
            const itinerary = segments.map((s: any) =>
                `${s.departure.iataCode} -> ${s.arrival.iataCode} (${s.carrierCode} ${s.number})`
            );

            // Generate detailed segments with airline names
            const detailedSegments: FlightSegment[] = segments.map((s: any) => ({
                from: s.departure.iataCode,
                to: s.arrival.iataCode,
                carrierCode: s.carrierCode,
                carrierName: getAirlineInfo(s.carrierCode).name || s.carrierCode,
                flightNumber: `${s.carrierCode} ${s.number}`,
                departure: s.departure.at,
                arrival: s.arrival.at,
                duration: parseDuration(s.duration)
            }));

            // Calculate layover durations
            const layovers: number[] = [];
            for (let i = 0; i < segments.length - 1; i++) {
                const currentArrival = new Date(segments[i].arrival.at);
                const nextDeparture = new Date(segments[i + 1].departure.at);
                const layoverMs = nextDeparture.getTime() - currentArrival.getTime();
                layovers.push(Math.round(layoverMs / 60000));
            }

            const mainCarrier = offer.validatingAirlineCodes[0] || 'Unknown';

            return {
                id: offer.id,
                price: parseFloat(offer.price.total),
                currency: offer.price.currency,
                carrier: mainCarrier,
                carrierName: getAirlineInfo(mainCarrier).name || mainCarrier,
                duration: durationMinutes,
                stops: stops,
                departureTime: departure,
                arrivalTime: arrival,
                itinerary: itinerary,
                segments: detailedSegments,
                layovers: layovers
            };
        });

        // Sort by price and take top results
        formattedOffers.sort((a, b) => a.price - b.price);
        return formattedOffers.slice(0, maxResults);
    } catch (error) {
        console.error(`[FlightAPI] Failed to search flights for ${from} → ${to}:`, error);
        return [];
    }
}

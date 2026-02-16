import { FlightResult, HybridSearchParams, FlightSource } from '@/types/hybridFlight';
import { getAmadeusClient } from '@/lib/amadeus';

export async function searchAmadeus(params: HybridSearchParams): Promise<FlightResult[]> {
    console.log(`[Amadeus] Searching for ${params.origin} -> ${params.destination} on ${params.date}`);
    
    try {
        if (!process.env.AMADEUS_API_KEY || !process.env.AMADEUS_API_SECRET) {
            console.warn('[Amadeus] API credentials not configured');
            return [];
        }

        const client = getAmadeusClient();
        
        const response = await client.shopping.flightOffersSearch.get({
            originLocationCode: params.origin,
            destinationLocationCode: params.destination,
            departureDate: params.date,
            adults: params.adults || 1,
            travelClass: params.cabin?.toUpperCase() || 'ECONOMY',
            currencyCode: params.currency || 'USD',
            max: 50 // Get up to 50 results
        });

        const offers = response.data || [];
        console.log(`✈️ AMADEUS returned ${offers.length} offers`);

        const mappedFlights: FlightResult[] = offers.map((offer: any) => {
            try {
                const firstItinerary = offer.itineraries[0];
                const segments = firstItinerary.segments || [];
                const firstSegment = segments[0];
                const lastSegment = segments[segments.length - 1];

                // Parse duration (PT2H30M format)
                const durationStr = firstItinerary.duration || 'PT0M';
                const durationMins = parseDuration(durationStr);

                // Map segments
                const mappedSegments = segments.map((seg: any) => ({
                    from: seg.departure.iataCode,
                    to: seg.arrival.iataCode,
                    departure: seg.departure.at,
                    arrival: seg.arrival.at,
                    duration: parseDuration(seg.duration || 'PT0M'),
                    carrier: seg.carrierCode,
                    carrierName: seg.operating?.carrierCode || seg.carrierCode,
                    flightNumber: seg.number,
                    aircraft: seg.aircraft?.code || '',
                    departing_at: seg.departure.at,
                    arriving_at: seg.arrival.at,
                    operating_carrier: {
                        name: seg.operating?.carrierCode || seg.carrierCode,
                        iata_code: seg.operating?.carrierCode || seg.carrierCode,
                        logo_url: `https://images.kiwi.com/airlines/64/${seg.carrierCode}.png`
                    },
                    origin: {
                        iata_code: seg.departure.iataCode,
                        city_name: ''
                    },
                    destination: {
                        iata_code: seg.arrival.iataCode,
                        city_name: ''
                    }
                }));

                // Calculate layovers
                const layovers: any[] = [];
                for (let i = 0; i < segments.length - 1; i++) {
                    const curr = segments[i];
                    const next = segments[i + 1];
                    const arriveTime = new Date(curr.arrival.at).getTime();
                    const departTime = new Date(next.departure.at).getTime();
                    const layoverMins = Math.floor((departTime - arriveTime) / 60000);
                    layovers.push({
                        duration: layoverMins,
                        airport: curr.arrival.iataCode,
                        city: ''
                    });
                }

                // Extract baggage
                let baggageKg = 20;
                let cabinBagKg = 7;
                const travelerPricings = offer.travelerPricings || [];
                if (travelerPricings.length > 0) {
                    const baggageAllowances = travelerPricings[0].fareDetailsBySegment?.[0]?.includedCheckedBags;
                    if (baggageAllowances?.weight) {
                        baggageKg = parseInt(baggageAllowances.weight) || 20;
                    }
                }

                const price = parseFloat(offer.price?.total || offer.price?.grandTotal || '0');

                return {
                    id: `AMADEUS_${offer.id}`,
                    source: 'DUFFEL' as FlightSource, // Using DUFFEL as source type for now
                    airline: firstSegment.carrierCode,
                    airlineLogo: `https://images.kiwi.com/airlines/64/${firstSegment.carrierCode}.png`,
                    flightNumber: `${firstSegment.carrierCode}${firstSegment.number}`,
                    aircraft: firstSegment.aircraft?.code,
                    from: params.origin,
                    to: params.destination,
                    departTime: firstSegment.departure.at,
                    arriveTime: lastSegment.arrival.at,
                    duration: durationMins,
                    stops: segments.length - 1,
                    segments: mappedSegments,
                    layovers,
                    price,
                    currency: offer.price?.currency || 'USD',
                    cabinClass: params.cabin || 'economy',
                    amenities: {
                        hasWifi: false,
                        hasMeal: true,
                        baggage: `${baggageKg}kg`
                    },
                    policies: {
                        baggageKg,
                        cabinBagKg
                    },
                    baggageSummary: {
                        checked: `${baggageKg}kg`,
                        cabin: `${cabinBagKg}kg`,
                        totalWeight: `${baggageKg}kg`
                    }
                } as FlightResult;
            } catch (err: any) {
                console.warn('[Amadeus] Error mapping offer:', err.message);
                return null;
            }
        }).filter((f): f is FlightResult => f !== null);

        return mappedFlights;

    } catch (err: any) {
        console.error('[Amadeus] Search error:', err.message);
        return [];
    }
}

function parseDuration(iso8601Duration: string): number {
    // PT2H30M -> 150 minutes
    const match = iso8601Duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    return hours * 60 + minutes;
}

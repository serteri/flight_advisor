import { FlightResult } from '@/types/hybridFlight';

function parseDuration(isoDuration: string | null): number {
    if (!isoDuration) return 0;
    // PT2H30M -> 150 minutes
    const matches = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (!matches) return 0;

    const hours = parseInt(matches[1] || '0', 10);
    const minutes = parseInt(matches[2] || '0', 10);

    return (hours * 60) + minutes;
}

export function mapDuffelToPremiumAgent(offer: any): FlightResult {
    const slice = offer.slices[0];
    const segment = slice.segments[0];
    const airline = offer.owner.name;
    const carrierCode = offer.owner.iata_code;
    const flightNumber = segment.operating_carrier_flight_number;

    // Calculate total duration across all segments + layovers if needed
    // Duffel aggregation usually gives total duration in slice?
    // Let's assume slice.duration exists as ISO string
    const durationMinutes = parseDuration(slice.duration);

    return {
        id: offer.id,
        source: 'DUFFEL',
        airline: airline,
        flightNumber: `${carrierCode}${flightNumber}`,
        from: slice.origin.iata_code,
        to: slice.destination.iata_code,
        departTime: slice.departure_at, // ISO String
        arriveTime: slice.arrival_at,
        duration: durationMinutes,
        stops: slice.segments.length - 1,
        price: parseFloat(offer.total_amount),
        currency: offer.total_currency,
        cabinClass: segment.passengers[0].cabin_class,

        amenities: {
            hasWifi: false,
            hasPower: false,
            hasMeal: true,
            seatType: "Standard"
        },

        bookingLink: ""
    };
}

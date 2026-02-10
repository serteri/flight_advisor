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

export function mapDuffelToPremiumAgent(offer: any) {
    const firstSlice = offer.slices[0];
    const firstSegment = firstSlice.segments[0];
    const lastSegment = firstSlice.segments[firstSlice.segments.length - 1];

    // 1. UÇUŞ NUMARASI (QRnull hatasını çözer)
    let flightNum = firstSegment.operating_carrier_flight_number || firstSegment.marketing_carrier_flight_number;
    if (!flightNum) flightNum = "N/A";

    const airlineCode = firstSegment.operating_carrier.iata_code || firstSegment.marketing_carrier.iata_code;
    const fullFlightNumber = `${airlineCode}${flightNum}`;

    // 2. SÜRE HESAPLAMA (0s 0dk hatasını çözer)
    let durationText = "";
    let durationMins = 0;
    if (firstSlice.duration) {
        // Duffel formatı (PT14H30M) gelirse parse et
        // Ama biz garanti olsun diye kalkış-varış farkına bakalım
        const dep = new Date(firstSegment.departing_at).getTime();
        const arr = new Date(lastSegment.arriving_at).getTime();
        const diffMins = (arr - dep) / 60000;
        durationMins = Math.floor(diffMins);
        const hours = Math.floor(diffMins / 60);
        const mins = Math.floor(diffMins % 60);
        durationText = `${hours}s ${mins}dk`;
    }

    // 3. AMENITIES
    const amenities = {
        hasWifi: firstSegment.amenities?.some((a: any) => a.type === 'wifi') || false,
        hasMeal: true,
        baggage: offer.passengers?.[0]?.baggages?.length > 0 ? "Dahil" : "Kontrol Et"
    };

    return {
        id: offer.id,
        source: 'DUFFEL',
        airline: firstSegment.operating_carrier.name,
        airlineLogo: firstSegment.operating_carrier.logo_symbol_url,
        flightNumber: fullFlightNumber,
        origin: firstSegment.origin.iata_code,
        destination: lastSegment.destination.iata_code,
        // Tarihleri olduğu gibi string olarak bırak, Frontend Date objesine çevirecek
        departTime: firstSegment.departing_at,
        arriveTime: lastSegment.arriving_at,
        duration: durationMins, // Keeping numerical for scoring default
        durationLabel: durationText, // For UI
        stops: firstSlice.segments.length - 1,
        price: parseFloat(offer.total_amount),
        currency: offer.total_currency,
        amenities: amenities,
        // Skorlama için gerekli ham veriler
        segments: firstSlice.segments,
        bookingLink: "" // Will be generated or null
    };
}

import { FlightResult, FlightSource } from '@/types/hybridFlight';

export function mapDuffelToPremiumAgent(offer: any): FlightResult {
    const firstSlice = offer.slices[0];
    const firstSegment = firstSlice.segments[0];
    const lastSegment = firstSlice.segments[firstSlice.segments.length - 1];

    // 1. IATA KODU ÇIKARTICI (Undefined Hatasını Çözen Kısım)
    // Duffel bazen { iata_code: "BNE" } bazen direkt "BNE" döner.
    const getIata = (location: any) => {
        if (!location) return "XXX";
        return location.iata_code || location;
    };

    const originCode = getIata(firstSegment.origin);
    const destinationCode = getIata(lastSegment.destination);

    // 2. UÇUŞ NO
    let flightNum = firstSegment.operating_carrier_flight_number || firstSegment.marketing_carrier_flight_number;
    if (!flightNum) flightNum = "FLY";
    const airlineCode = firstSegment.operating_carrier?.iata_code || "XX";
    const fullFlightNumber = `${airlineCode}${flightNum}`;

    // 3. TARİH VE SÜRE
    const departureDate = firstSegment.departing_at || new Date().toISOString();
    const arrivalDate = lastSegment.arriving_at || new Date().toISOString();

    let durationMins = 0;
    let durationText = "Bilinmiyor";
    try {
        const dep = new Date(departureDate).getTime();
        const arr = new Date(arrivalDate).getTime();
        const diffMins = (arr - dep) / 60000;
        durationMins = Math.floor(diffMins);
        const h = Math.floor(diffMins / 60);
        const m = Math.round(diffMins % 60);
        durationText = `${h}s ${m}dk`;
    } catch (e) { console.error(e); }

    // 4. AVIASALES LİNK OLUŞTURMA 🔗 (Para Kazandıran Link)
    // Format: https://www.aviasales.com/search/[ORIGIN][DD][MM][DEST]1?marker=701049
    const d = new Date(departureDate);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const shortDate = `${day}${month}`;
    const marker = process.env.TRAVELPAYOUTS_MARKER || '701049';

    const aviasalesLink = `https://www.aviasales.com/search/${originCode}${shortDate}${destinationCode}1?marker=${marker}&currency=AUD`;

    return {
        id: offer.id,
        source: 'DUFFEL' as FlightSource,
        airline: firstSegment.operating_carrier?.name || "Airline",
        airlineLogo: firstSegment.operating_carrier?.logo_symbol_url || "",
        flightNumber: fullFlightNumber,

        // 🔥 Artık "undefined" olamaz:
        from: originCode,
        to: destinationCode,

        departTime: departureDate,
        arriveTime: arrivalDate,
        duration: durationMins,
        durationLabel: durationText,
        stops: firstSlice.segments.length - 1,
        price: parseFloat(offer.total_amount),
        currency: offer.total_currency,
        cabinClass: 'economy',
        amenities: {
            hasWifi: false,
            hasMeal: true,
            baggage: offer.passengers?.[0]?.baggages?.length > 0 ? "Dahil" : "Kontrol Et"
        },
        segments: firstSlice.segments,
        deepLink: aviasalesLink, // 👈 ARTIK Aviasales'e gidecek ve komisyon kazandıracak!
        bookingLink: aviasalesLink // Yedek olarak buraya da koyalım
    };
}

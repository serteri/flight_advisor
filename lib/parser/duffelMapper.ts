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

    // 🚫 AVIASALES LİNK KURULUMU KALDIRILDI
    // Artık Aviasales'e zorlama yönlendirmesi yapılmıyor
    // Kullanıcılar doğrudan booking provider'ları seçebilecek

    // Compute layovers between segments
    const layovers: any[] = [];
    const segs = firstSlice.segments || [];
    for (let i = 0; i < segs.length - 1; i++) {
        const cur = segs[i];
        const next = segs[i + 1];
        try {
            const arrive = new Date(cur.arriving_at).getTime();
            const departNext = new Date(next.departing_at).getTime();
            const diffMins = Math.max(0, Math.floor((departNext - arrive) / 60000));
            layovers.push({ duration: diffMins, city: cur.destination?.city || getIata(cur.destination), airport: getIata(cur.destination) });
        } catch (e) {
            layovers.push({ duration: 0, city: getIata(cur.destination), airport: getIata(cur.destination) });
        }
    }

    // Improve baggage display: try multiple fields and extract actual kg/piece data
    let baggageLabel = 'Kontrol Et';
    let baggageKg: number | undefined;
    let cabinBagKg: number | undefined;
    let checkedBaggage = 'Kontrol Et';
    let cabinBaggage = '1 Parça';
    
    try {
        const pax = offer.passengers?.[0];
        
        // Check for baggage allowances
        if (pax?.baggages && pax.baggages.length > 0) {
            const checkedBag = pax.baggages.find((b: any) => b.type === 'checked');
            const cabinBag = pax.baggages.find((b: any) => b.type === 'carry_on');
            
            if (checkedBag) {
                baggageLabel = 'Dahil';
                // Extract quantity and weight
                const qty = checkedBag.quantity || 1;
                if (checkedBag.weight_value && checkedBag.weight_unit) {
                    baggageKg = checkedBag.weight_value;
                    checkedBaggage = `${qty} x ${checkedBag.weight_value}${checkedBag.weight_unit}`;
                } else {
                    checkedBaggage = `${qty} Parça`;
                }
            }
            
            if (cabinBag) {
                const qty = cabinBag.quantity || 1;
                if (cabinBag.weight_value && cabinBag.weight_unit) {
                    cabinBagKg = cabinBag.weight_value;
                    cabinBaggage = `${qty} x ${cabinBag.weight_value}${cabinBag.weight_unit}`;
                } else {
                    cabinBaggage = `${qty} Parça`;
                }
            }
        } else if (offer.includes && offer.includes.baggage) {
            baggageLabel = 'Dahil';
            baggageKg = 20; // Default assumption
            checkedBaggage = '20kg (Standart)';
        }
    } catch (e) {
        console.warn('Baggage parsing error:', e);
    }

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
        stops: segs.length - 1,
        price: parseFloat(offer.total_amount),
        currency: offer.total_currency,
        cabinClass: 'economy',
        amenities: {
            hasWifi: false,
            hasMeal: true,
            baggage: baggageLabel
        },
        segments: segs,
        layovers,
        deepLink: undefined,
        bookingLink: undefined,
        policies: {
            baggageKg,
            cabinBagKg,
            refundable: false,
            changeAllowed: false
        },
        baggageSummary: {
            checked: checkedBaggage,
            cabin: cabinBaggage,
            totalWeight: baggageKg ? `${baggageKg}kg` : 'Kontrol Et'
        }
    };
}

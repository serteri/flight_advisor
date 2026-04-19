import { FlightResult, FlightSource } from '@/types/hybridFlight';

export function mapDuffelToPremiumAgent(offer: any): FlightResult {
        const parseDurationToMinutes = (value: unknown): number => {
            if (typeof value === 'number' && Number.isFinite(value)) {
                return Math.max(0, value);
            }

            if (typeof value === 'string') {
                const isoMatch = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
                if (isoMatch) {
                    const hours = parseInt(isoMatch[1] || '0', 10);
                    const mins = parseInt(isoMatch[2] || '0', 10);
                    return Math.max(0, hours * 60 + mins);
                }

                const hrMinMatch = value.match(/(\d+)\s*(h|hr|hrs|hour|hours)\s*(\d+)?\s*(m|min|mins|minute|minutes)?/i);
                if (hrMinMatch) {
                    const hours = parseInt(hrMinMatch[1] || '0', 10);
                    const mins = parseInt(hrMinMatch[3] || '0', 10);
                    return Math.max(0, hours * 60 + mins);
                }
            }

            return 0;
        };

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

    const hasExplicitTimezone = (value: string) => /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim());

    let durationMins = parseDurationToMinutes(firstSlice.duration || offer.total_duration || offer.duration);
    let durationText = "Bilinmiyor";
    if (durationMins <= 0) {
        try {
            if (hasExplicitTimezone(departureDate) && hasExplicitTimezone(arrivalDate)) {
                const dep = new Date(departureDate).getTime();
                const arr = new Date(arrivalDate).getTime();
                const diffMins = Math.floor((arr - dep) / 60000);
                durationMins = Math.max(0, diffMins);
            }
        } catch (e) {
            console.error(e);
        }
    }

    if (durationMins > 0) {
        const h = Math.floor(durationMins / 60);
        const m = Math.round(durationMins % 60);
        durationText = `${h}s ${m}dk`;
    }

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

    let baggageKg: number | undefined;
    let cabinBagKg: number | undefined;
    let checkedBaggageLabel: string | undefined;
    let cabinBaggageLabel: string | undefined;
    // null = unknown (Duffel didn't provide data), true = included, false = explicitly not included
    let baggageIncluded: boolean | null = null;

    let refundable = false;
    let changeAllowed = false;
    let changeFee: string | undefined;
    let aircraftType: string | undefined;

    try {
        if (firstSegment.aircraft) {
            aircraftType = firstSegment.aircraft.name || firstSegment.aircraft.iata_code;
        }

        if (offer.conditions) {
            if (offer.conditions.refund_before_departure?.allowed === true) {
                refundable = true;
            }
            if (offer.conditions.change_before_departure) {
                const cc = offer.conditions.change_before_departure;
                changeAllowed = cc.allowed === true;
                if (cc.penalty_amount && cc.penalty_currency) {
                    changeFee = `${cc.penalty_amount} ${cc.penalty_currency}`;
                }
            }
        }

        // Primary source: passengers[0].baggages contains INCLUDED baggage (not purchasable add-ons).
        // available_services are purchasable extras — do NOT use them for included status.
        const pax = offer.passengers?.[0];

        if (pax && Array.isArray(pax.baggages)) {
            // Duffel provided baggage data — trust it completely
            const checkedBag = pax.baggages.find(
                (b: any) => b.type === 'checked' && Number(b.quantity ?? 0) > 0
            );
            const cabinBag = pax.baggages.find(
                (b: any) => b.type === 'carry_on' && Number(b.quantity ?? 0) > 0
            );

            if (checkedBag) {
                baggageIncluded = true;
                const qty = Number(checkedBag.quantity) || 1;
                if (checkedBag.weight_value && checkedBag.weight_unit) {
                    baggageKg = Number(checkedBag.weight_value);
                    checkedBaggageLabel = `${qty} x ${checkedBag.weight_value}${checkedBag.weight_unit}`;
                } else {
                    checkedBaggageLabel = qty > 1 ? `${qty} pieces` : `${qty} piece`;
                }
            } else {
                // baggages array was provided by Duffel but contains no checked bags → explicitly excluded
                baggageIncluded = false;
            }

            if (cabinBag) {
                const qty = Number(cabinBag.quantity) || 1;
                if (cabinBag.weight_value && cabinBag.weight_unit) {
                    cabinBagKg = Number(cabinBag.weight_value);
                    cabinBaggageLabel = `${qty} x ${cabinBag.weight_value}${cabinBag.weight_unit}`;
                } else {
                    cabinBaggageLabel = `${qty} piece(s)`;
                }
            }
        } else {
            // Fall back to segment-level passenger baggages
            const segBaggages = firstSlice.segments?.[0]?.passengers?.[0]?.baggages;
            if (Array.isArray(segBaggages)) {
                const checkedBag = segBaggages.find(
                    (b: any) => b.type === 'checked' && Number(b.quantity ?? 0) > 0
                );
                if (checkedBag) {
                    baggageIncluded = true;
                    const qty = Number(checkedBag.quantity) || 1;
                    checkedBaggageLabel = checkedBag.weight_value
                        ? `${qty} x ${checkedBag.weight_value}${checkedBag.weight_unit || 'kg'}`
                        : `${qty} piece(s)`;
                    if (checkedBag.weight_value) baggageKg = Number(checkedBag.weight_value);
                } else {
                    baggageIncluded = false;
                }
            }
            // If neither source has data: baggageIncluded stays null (truly unknown)
        }
    } catch (e) {
        console.error('[Duffel Mapper] Baggage parsing error:', e);
        // Leave baggageIncluded = null (unknown) on error — do not invent data
    }

    const baggageFieldValue: 'checked' | 'none' | undefined =
        baggageIncluded === true ? 'checked'
        : baggageIncluded === false ? 'none'
        : undefined;

    return {
        id: offer.id,
        source: 'duffel' as FlightSource,
        airline: firstSegment.operating_carrier?.name || "Airline",
        airlineLogo: firstSegment.operating_carrier?.logo_symbol_url || "",
        flightNumber: fullFlightNumber,
        aircraft: aircraftType, // ✅ NOW EXTRACTED FROM DUFFEL

        // 🔥 Artık "undefined" olamaz:
        from: originCode,
        to: destinationCode,

        departTime: departureDate,
        arriveTime: arrivalDate,
        duration: durationMins,
        durationLabel: durationText,
        stops: Math.max(0, segs.length - 1),
        price: Math.max(0, parseFloat(offer.total_amount) || 0),
        currency: offer.total_currency || 'USD',
        cabinClass: 'economy',
        baggage: baggageFieldValue,
        amenities: {
            hasWifi: false,
            hasMeal: true,
        },
        segments: segs.map((seg: any) => {
            const segDep = seg.departing_at || '';
            const segArr = seg.arriving_at || '';
            const segOrigin = getIata(seg.origin);
            const segDest = getIata(seg.destination);
            const segCarrierCode = seg.operating_carrier?.iata_code || seg.marketing_carrier?.iata_code || '';
            const segCarrierName = seg.operating_carrier?.name || seg.marketing_carrier?.name || '';
            const segFlightNo = seg.operating_carrier_flight_number || seg.marketing_carrier_flight_number || '';
            const segAircraft = seg.aircraft?.name || seg.aircraft?.iata_code || '';

            let segDuration = parseDurationToMinutes(seg.duration);
            if (segDuration <= 0 && segDep && segArr) {
                try {
                    const depMs = new Date(segDep).getTime();
                    const arrMs = new Date(segArr).getTime();
                    if (Number.isFinite(depMs) && Number.isFinite(arrMs) && arrMs > depMs) {
                        segDuration = Math.round((arrMs - depMs) / 60000);
                    }
                } catch { /* fallback to 0 */ }
            }

            return {
                from: segOrigin,
                to: segDest,
                departure: segDep,
                arrival: segArr,
                departing_at: segDep,
                arriving_at: segArr,
                duration: segDuration,
                carrier: segCarrierCode,
                airline: segCarrierName,
                flightNumber: `${segCarrierCode}${segFlightNo}`,
                aircraft: segAircraft,
                operating_carrier: seg.operating_carrier || { iata_code: segCarrierCode, name: segCarrierName },
                origin: seg.origin || { iata_code: segOrigin },
                destination: seg.destination || { iata_code: segDest },
            };
        }),
        layovers,
        deepLink: undefined,
        bookingLink: undefined,
        policies: {
            ...(baggageKg ? { baggageKg } : {}),
            ...(cabinBagKg ? { cabinBagKg } : {}),
            refundable,
            changeAllowed,
            ...(changeFee ? { changeFee } : {}),
        },
        ...(baggageIncluded !== null ? {
            baggageSummary: {
                checked: baggageIncluded
                    ? (checkedBaggageLabel || (baggageKg ? `${baggageKg}kg` : 'Included'))
                    : 'Not included',
                cabin: cabinBaggageLabel || (cabinBagKg ? `${cabinBagKg}kg` : ''),
                totalWeight: baggageKg ? `${baggageKg}kg` : '',
            },
        } : {}),
    };
}

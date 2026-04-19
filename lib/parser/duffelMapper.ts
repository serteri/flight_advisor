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

    // Improve baggage display: try multiple fields and extract actual kg/piece data
    let baggageLabel = 'Kontrol Et';
    let baggageKg: number | undefined;
    let cabinBagKg: number | undefined;
    let checkedBaggage = 'Kontrol Et';
    let cabinBaggage = '1 Parça';
    
    // ✅ NEW: Extract refund/change conditions from Duffel's conditions object
    let refundable = false;
    let changeAllowed = false;
    let changeFee: string | undefined;
    
    // ✅ NEW: Extract aircraft type
    let aircraftType: string | undefined;
    
    try {
        // Extract aircraft info from first segment
        if (firstSegment.aircraft) {
            aircraftType = firstSegment.aircraft.name || firstSegment.aircraft.iata_code;
            console.log(`[Duffel Mapper] Aircraft: ${aircraftType}`);
        }
        
        // Extract conditions (refund/change policies)
        if (offer.conditions) {
            console.log(`[Duffel Mapper] Conditions:`, JSON.stringify(offer.conditions, null, 2));
            
            // Check refund conditions
            if (offer.conditions.refund_before_departure) {
                const refundCondition = offer.conditions.refund_before_departure;
                refundable = refundCondition.allowed === true;
                console.log(`[Duffel Mapper] Refundable: ${refundable}`);
            }
            
            // Check change conditions
            if (offer.conditions.change_before_departure) {
                const changeCondition = offer.conditions.change_before_departure;
                changeAllowed = changeCondition.allowed === true;
                
                if (changeCondition.penalty_amount && changeCondition.penalty_currency) {
                    changeFee = `${changeCondition.penalty_amount} ${changeCondition.penalty_currency}`;
                } else if (changeAllowed) {
                    changeFee = 'Ücret Detayları İçin Kontrol Et';
                }
                console.log(`[Duffel Mapper] Change Allowed: ${changeAllowed}, Fee: ${changeFee || 'N/A'}`);
            }
        }
        
        // Debug: Log entire offer structure for baggage
        console.log(`[Duffel Mapper] Offer ID: ${offer.id}`);
        console.log(`[Duffel Mapper] Passengers:`, JSON.stringify(offer.passengers, null, 2));
        console.log(`[Duffel Mapper] Available Services:`, JSON.stringify(offer.available_services?.slice(0, 2), null, 2));
        console.log(`[Duffel Mapper] Conditions:`, JSON.stringify(offer.conditions, null, 2));
        
        // Try available_services first (Duffel v2 API)
        if (offer.available_services && offer.available_services.length > 0) {
            const baggageServices = offer.available_services.filter((s: any) => 
                s.type === 'baggage' || s.metadata?.type === 'baggage'
            );
            console.log(`[Duffel Mapper] Found ${baggageServices.length} baggage services`);
            
            if (baggageServices.length > 0) {
                const checkedService = baggageServices.find((s: any) => 
                    s.metadata?.maximum_weight_kg || s.maximum_weight_kg
                );
                if (checkedService) {
                    baggageKg = checkedService.metadata?.maximum_weight_kg || checkedService.maximum_weight_kg;
                    baggageLabel = 'Dahil';
                    checkedBaggage = `${baggageKg}kg`;
                    console.log(`[Duffel Mapper] Found checked bag from services: ${baggageKg}kg`);
                }
            }
        }
        
        // Try passengers.baggages
        const pax = offer.passengers?.[0];
        if (pax?.baggages && pax.baggages.length > 0) {
            console.log(`[Duffel Mapper] Passenger baggages:`, JSON.stringify(pax.baggages, null, 2));
            
            const checkedBag = pax.baggages.find((b: any) => b.type === 'checked');
            const cabinBag = pax.baggages.find((b: any) => b.type === 'carry_on');
            
            if (checkedBag) {
                baggageLabel = 'Dahil';
                const qty = checkedBag.quantity || 1;
                if (checkedBag.weight_value && checkedBag.weight_unit) {
                    baggageKg = checkedBag.weight_value;
                    checkedBaggage = `${qty} x ${checkedBag.weight_value}${checkedBag.weight_unit}`;
                } else {
                    checkedBaggage = `${qty} Parça`;
                }
                console.log(`[Duffel Mapper] Found checked bag from pax: ${checkedBaggage}`);
            }
            
            if (cabinBag) {
                const qty = cabinBag.quantity || 1;
                if (cabinBag.weight_value && cabinBag.weight_unit) {
                    cabinBagKg = cabinBag.weight_value;
                    cabinBaggage = `${qty} x ${cabinBag.weight_value}${cabinBag.weight_unit}`;
                } else {
                    cabinBaggage = `${qty} Parça`;
                }
                console.log(`[Duffel Mapper] Found cabin bag from pax: ${cabinBaggage}`);
            }
        }
        
        // Try segment-level passengers
        if (!baggageKg && firstSlice.segments && firstSlice.segments[0].passengers) {
            const segPax = firstSlice.segments[0].passengers[0];
            console.log(`[Duffel Mapper] Segment passengers:`, JSON.stringify(segPax, null, 2));
            
            if (segPax?.baggages && segPax.baggages.length > 0) {
                const checkedBag = segPax.baggages.find((b: any) => b.type === 'checked');
                if (checkedBag && checkedBag.quantity > 0) {
                    baggageLabel = 'Dahil';
                    checkedBaggage = `${checkedBag.quantity} Parça`;
                    console.log(`[Duffel Mapper] Found checked bag from segment passengers: ${checkedBaggage}`);
                }
            }
        }
        
        // Fallback to conditions or default
        if (!baggageKg && offer.conditions) {
            console.log(`[Duffel Mapper] Checking conditions for baggage info...`);
            // Some airlines include baggage info in conditions
        }
        
        // Final fallback
        if (baggageLabel === 'Kontrol Et') {
            console.warn(`[Duffel Mapper] No baggage information found for offer ${offer.id}`);
            baggageLabel = 'Dahil';
            baggageKg = 20; // Standard economy assumption
            checkedBaggage = '1 x 20kg (Standart)';
        }
    } catch (e) {
        console.error('[Duffel Mapper] Baggage parsing error:', e);
        baggageLabel = 'Dahil';
        baggageKg = 20;
        checkedBaggage = '1 x 20kg (Standart)';
    }

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
        amenities: {
            hasWifi: false,
            hasMeal: true,
            baggage: baggageLabel
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
            baggageKg,
            cabinBagKg,
            refundable, // ✅ NOW EXTRACTED FROM DUFFEL CONDITIONS
            changeAllowed, // ✅ NOW EXTRACTED FROM DUFFEL CONDITIONS
            changeFee // ✅ NOW EXTRACTED FROM DUFFEL CONDITIONS
        },
        baggageSummary: {
            checked: checkedBaggage,
            cabin: cabinBaggage,
            totalWeight: baggageKg ? `${baggageKg}kg` : 'Kontrol Et'
        }
    };
}

/**
 * Maps a Sabre PricedItinerary to FlightResult.
 * Server-side only — never imported by client bundles.
 */

import type { FlightResult, FlightSource } from '@/types/hybridFlight';

// ── Airline name lookup (extend as needed) ────────────────────────────────────

const AIRLINE_NAMES: Record<string, string> = {
    AA: 'American Airlines', UA: 'United Airlines', DL: 'Delta Air Lines',
    BA: 'British Airways', LH: 'Lufthansa', AF: 'Air France',
    KL: 'KLM', IB: 'Iberia', TK: 'Turkish Airlines', EK: 'Emirates',
    QR: 'Qatar Airways', EY: 'Etihad Airways', SQ: 'Singapore Airlines',
    CX: 'Cathay Pacific', LX: 'Swiss', OS: 'Austrian Airlines',
    AY: 'Finnair', SK: 'SAS', FR: 'Ryanair', U2: 'easyJet',
    W6: 'Wizz Air', VY: 'Vueling', PC: 'Pegasus Airlines',
    XQ: 'SunExpress', TF: 'Braathens Regional',
};

// ── Weight parser: "23K" → 23kg, "50L" → ~22.7kg ─────────────────────────────

function parseWeightMeasure(raw: string | undefined): number {
    if (!raw) return 0;
    const str = String(raw).trim().toUpperCase();
    const num = parseFloat(str);
    if (!Number.isFinite(num) || num <= 0) return 0;

    if (str.endsWith('K') || str.endsWith('KG')) return Math.round(num);
    if (str.endsWith('L') || str.endsWith('LB') || str.endsWith('LBS')) {
        return Math.round(num * 0.453592);
    }
    // No unit — assume kg if plausible (5–50 range), else 0
    return num >= 5 && num <= 50 ? Math.round(num) : 0;
}

// ── Duration parser: "PT2H30M" or minutes integer ────────────────────────────

function parseDuration(value: string | number | undefined): number {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value);
    if (typeof value === 'string') {
        const m = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
        if (m) return (parseInt(m[1] || '0') * 60) + parseInt(m[2] || '0');
        const mins = parseInt(value);
        if (Number.isFinite(mins) && mins > 0) return mins;
    }
    return 0;
}

// ── Baggage extractor ─────────────────────────────────────────────────────────

interface BaggageResult {
    checkedKg: number;
    checkedLabel: string;
    cabinKg: number;
    checkedIncluded: boolean;
    explicitlyExcluded: boolean;
}

function extractBaggage(fareBreakdown: any): BaggageResult {
    const result: BaggageResult = {
        checkedKg: 0,
        checkedLabel: '',
        cabinKg: 0,
        checkedIncluded: false,
        explicitlyExcluded: false,
    };

    if (!fareBreakdown) return result;

    // Path 1: CheckedBaggage[] — most reliable
    const checkedBags: any[] = fareBreakdown.CheckedBaggage ?? [];
    if (Array.isArray(checkedBags) && checkedBags.length > 0) {
        for (const bag of checkedBags) {
            const provType: string = String(bag.ProvisionType || '').toUpperCase();
            // "A" = free allowance, skip "C"/"B" (carry-on types)
            if (provType === 'C' || provType === 'B') continue;

            const qty = parseInt(bag.Quantity ?? bag.Amount ?? '0');
            if (qty > 0) {
                result.checkedIncluded = true;
                const kg = parseWeightMeasure(bag.WeightMeasure);
                if (kg > 0) {
                    result.checkedKg = kg;
                    result.checkedLabel = qty > 1 ? `${qty} x ${kg}kg` : `${kg}kg`;
                } else {
                    result.checkedLabel = qty > 1 ? `${qty} pieces` : `${qty} piece`;
                }
                break;
            }
        }
        // Sabre explicitly returned bag list but no included bags → excluded
        if (!result.checkedIncluded) {
            result.explicitlyExcluded = true;
        }
        return result;
    }

    // Path 2: BaggageInfo string (e.g. "1PC" or "23K")
    const baggageInfo: string = String(fareBreakdown.BaggageInfo || '').trim();
    if (baggageInfo) {
        const pcMatch = baggageInfo.match(/^(\d+)PC$/i);
        if (pcMatch) {
            const qty = parseInt(pcMatch[1]);
            if (qty > 0) {
                result.checkedIncluded = true;
                result.checkedLabel = qty > 1 ? `${qty} pieces` : `${qty} piece`;
                return result;
            } else {
                result.explicitlyExcluded = true;
                return result;
            }
        }
        const kg = parseWeightMeasure(baggageInfo);
        if (kg > 0) {
            result.checkedIncluded = true;
            result.checkedKg = kg;
            result.checkedLabel = `${kg}kg`;
            return result;
        }
        // "0" or "0PC" → explicitly no bags
        if (/^0/.test(baggageInfo)) {
            result.explicitlyExcluded = true;
            return result;
        }
    }

    // Path 3: FareBasisCode.FareBaggageAllowance
    const fba = fareBreakdown.FareBasisCodes?.FareBasisCode?.[0]?.FareBaggageAllowance;
    if (fba) {
        const qty = parseInt(fba.Quantity ?? '0');
        const kg = parseWeightMeasure(fba.WeightMeasure);
        if (qty > 0 || kg > 0) {
            result.checkedIncluded = true;
            if (kg > 0) {
                result.checkedKg = kg;
                result.checkedLabel = `${kg}kg`;
            } else if (qty > 0) {
                result.checkedLabel = qty > 1 ? `${qty} pieces` : `${qty} piece`;
            }
        }
    }

    return result;
}

// ── Main mapper ───────────────────────────────────────────────────────────────

export function mapSabreToFlightResult(itinerary: any): FlightResult | null {
    try {
        const odo = itinerary?.AirItinerary?.OriginDestinationOptions?.OriginDestinationOption;
        if (!Array.isArray(odo) || odo.length === 0) return null;

        const firstODO = odo[0];
        const segments: any[] = firstODO.FlightSegment ?? [];
        if (segments.length === 0) return null;

        const firstSeg = segments[0];
        const lastSeg = segments[segments.length - 1];

        // Origin / Destination
        const from: string = firstSeg.DepartureAirport?.LocationCode ?? '';
        const to: string = lastSeg.ArrivalAirport?.LocationCode ?? '';
        if (!from || !to) return null;

        // Times
        const departTime: string = firstSeg.DepartureDateTime ?? '';
        const arriveTime: string = lastSeg.ArrivalDateTime ?? '';

        // Duration
        const rawDuration = firstODO.ElapsedTime ?? itinerary?.AirItinerary?.DirectionInd;
        let durationMins = parseDuration(rawDuration);
        if (durationMins <= 0 && departTime && arriveTime) {
            try {
                const diff = new Date(arriveTime).getTime() - new Date(departTime).getTime();
                if (diff > 0) durationMins = Math.round(diff / 60000);
            } catch { /* ignore */ }
        }
        const h = Math.floor(durationMins / 60);
        const m = durationMins % 60;
        const durationLabel = durationMins > 0 ? `${h}s ${m}dk` : 'Bilinmiyor';

        // Airline + flight number
        const carrierCode: string = firstSeg.OperatingAirline?.Code || firstSeg.MarketingAirline?.Code || 'XX';
        const flightNo: string = firstSeg.OperatingAirline?.FlightNumber || firstSeg.FlightNumber || '';
        const flightNumber = `${carrierCode}${flightNo}`;
        const airline: string = AIRLINE_NAMES[carrierCode] || carrierCode;

        // Aircraft
        const aircraft: string | undefined = firstSeg.Equipment?.[0]?.AirEquipType || undefined;

        // Price
        const pricing = itinerary?.AirItineraryPricingInfo;
        const totalFare = pricing?.ItinTotalFare;
        const price = parseFloat(totalFare?.TotalFare?.Amount ?? totalFare?.TotalFare?.['@Amount'] ?? '0');
        const currency: string = totalFare?.TotalFare?.CurrencyCode
            ?? totalFare?.TotalFare?.['@CurrencyCode']
            ?? 'USD';

        if (!Number.isFinite(price) || price <= 0) return null;

        // Baggage
        const fareBreakdown = pricing?.PTC_FareBreakdowns?.PTC_FareBreakdown?.[0];
        const bag = extractBaggage(fareBreakdown);

        const baggageFieldValue: 'checked' | 'none' | undefined =
            bag.checkedIncluded ? 'checked'
            : bag.explicitlyExcluded ? 'none'
            : undefined;

        // Layovers
        const layovers: { duration: number; city?: string; airport?: string }[] = [];
        for (let i = 0; i < segments.length - 1; i++) {
            const cur = segments[i];
            const nxt = segments[i + 1];
            try {
                const diff = new Date(nxt.DepartureDateTime).getTime() - new Date(cur.ArrivalDateTime).getTime();
                layovers.push({
                    duration: Math.max(0, Math.round(diff / 60000)),
                    airport: cur.ArrivalAirport?.LocationCode,
                });
            } catch {
                layovers.push({ duration: 0, airport: cur.ArrivalAirport?.LocationCode });
            }
        }

        // Mapped segments
        const mappedSegments = segments.map((seg: any) => {
            const segCarrier = seg.OperatingAirline?.Code || seg.MarketingAirline?.Code || '';
            const segFlightNo = seg.OperatingAirline?.FlightNumber || seg.FlightNumber || '';
            let segDur = parseDuration(seg.ElapsedTime);
            if (segDur <= 0 && seg.DepartureDateTime && seg.ArrivalDateTime) {
                try {
                    const diff = new Date(seg.ArrivalDateTime).getTime() - new Date(seg.DepartureDateTime).getTime();
                    if (diff > 0) segDur = Math.round(diff / 60000);
                } catch { /* ignore */ }
            }
            return {
                from: seg.DepartureAirport?.LocationCode ?? '',
                to: seg.ArrivalAirport?.LocationCode ?? '',
                departure: seg.DepartureDateTime ?? '',
                arrival: seg.ArrivalDateTime ?? '',
                departing_at: seg.DepartureDateTime ?? '',
                arriving_at: seg.ArrivalDateTime ?? '',
                duration: segDur,
                carrier: segCarrier,
                airline: AIRLINE_NAMES[segCarrier] || segCarrier,
                flightNumber: `${segCarrier}${segFlightNo}`,
                aircraft: seg.Equipment?.[0]?.AirEquipType || '',
                operating_carrier: { iata_code: segCarrier, name: AIRLINE_NAMES[segCarrier] || segCarrier },
                origin: { iata_code: seg.DepartureAirport?.LocationCode ?? '' },
                destination: { iata_code: seg.ArrivalAirport?.LocationCode ?? '' },
            };
        });

        // Conditions
        const fareInfo = pricing?.FareInfos?.FareInfo?.[0];
        const refundable = fareInfo?.TPA_Extensions?.ValidatingCarrier?.NewVcIndInd === 'true' ? false : false;

        const id = `sabre-${from}-${to}-${departTime}-${flightNumber}-${price}`.replace(/[^a-z0-9-]/gi, '_');

        return {
            id,
            source: 'sabre' as FlightSource,
            airline,
            flightNumber,
            aircraft,
            from,
            to,
            departTime,
            arriveTime,
            duration: durationMins,
            durationLabel,
            stops: Math.max(0, segments.length - 1),
            price,
            currency,
            cabinClass: 'economy',
            baggage: baggageFieldValue,
            amenities: { hasWifi: false, hasMeal: false },
            segments: mappedSegments,
            layovers,
            policies: {
                ...(bag.checkedKg > 0 ? { baggageKg: bag.checkedKg } : {}),
                refundable,
                changeAllowed: false,
            },
            ...(bag.checkedIncluded || bag.explicitlyExcluded ? {
                baggageSummary: {
                    checked: bag.checkedIncluded
                        ? (bag.checkedLabel || 'Included')
                        : 'Not included',
                    cabin: '',
                    totalWeight: bag.checkedKg > 0 ? `${bag.checkedKg}kg` : '',
                },
            } : {}),
            deepLink: undefined,
            bookingLink: undefined,
        };
    } catch (err) {
        console.error('[Sabre Mapper] Failed to map itinerary:', err);
        return null;
    }
}

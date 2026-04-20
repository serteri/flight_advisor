/**
 * Maps FlightAPI.io response to FlightResult[].
 *
 * FlightAPI response shape:
 *   legs[]      — flight leg details (id, originPlace, destinationPlace, departure, arrival, duration, stopCount, segments[])
 *   quotes[]    — pricing entries referencing leg ids + carrier ids
 *   carriers{}  — carrier lookup keyed by numeric id (name, iataCode, logoUrl)
 *   places{}    — airport lookup keyed by numeric id (iataCode, name)
 */

import type { FlightResult, FlightSource } from '@/types/hybridFlight';

// ── Duration formatter ────────────────────────────────────────────────────────

function durationLabel(mins: number): string {
    if (mins <= 0) return 'Bilinmiyor';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}s ${m}dk`;
}

// ── Baggage extraction ────────────────────────────────────────────────────────
// FlightAPI.io does not include per-fare baggage allowance in the base endpoint.
// Do NOT set baggage to 'none' just because the field is absent —
// absence is unknown, not "excluded".

function extractBaggage(segment: any): { baggage: undefined; baggageKg: number } {
    // If FlightAPI ever adds a baggageAllowance field, parse it here.
    // For now, return undefined (unknown) to avoid false "Not included" labels.
    return { baggage: undefined, baggageKg: 0 };
}

// ── Main mapper ───────────────────────────────────────────────────────────────

export function mapFlightAPIResponse(data: any): FlightResult[] {
    if (!data || typeof data !== 'object') return [];

    // Build lookup maps — keys are numeric IDs stored as strings
    const carriersMap: Record<string, any> = data.carriers ?? {};
    const placesMap: Record<string, any>   = data.places   ?? {};

    // legs indexed by id for quote → leg join
    const legsById: Record<string, any> = {};
    const rawLegs: any[] = Array.isArray(data.legs) ? data.legs : [];
    for (const leg of rawLegs) {
        if (leg?.id) legsById[leg.id] = leg;
    }

    const quotes: any[] = Array.isArray(data.quotes) ? data.quotes : [];
    const results: FlightResult[] = [];

    for (const quote of quotes) {
        try {
            // Resolve price
            const price: number =
                parseFloat(quote?.minPrice?.amount ?? quote?.price?.raw ?? quote?.price?.amount ?? '0');
            const currency: string =
                String(quote?.minPrice?.currency ?? quote?.price?.currency ?? 'USD').toUpperCase();

            if (!Number.isFinite(price) || price <= 0) continue;

            // Resolve leg — quotes reference leg ids in an array
            const legIds: string[] = Array.isArray(quote.legs) ? quote.legs : [];
            const leg = legIds.map(id => legsById[id]).find(Boolean);
            if (!leg) continue;

            // Places
            const originPlace  = placesMap[String(leg.originPlace)]      ?? {};
            const destPlace    = placesMap[String(leg.destinationPlace)]  ?? {};
            const from: string = (originPlace.iataCode || String(leg.originPlace || '')).toUpperCase();
            const to: string   = (destPlace.iataCode   || String(leg.destinationPlace || '')).toUpperCase();
            if (!from || !to) continue;

            // Times
            const departTime: string = leg.departure ?? '';
            const arriveTime: string = leg.arrival   ?? '';

            // Duration
            const durationMins: number = Math.max(0, parseInt(leg.duration ?? '0') || 0);

            // Stops
            const stops: number = Math.max(0, parseInt(leg.stopCount ?? '0') || 0);

            // Carrier from first leg carrier
            const firstCarrierId = String(
                Array.isArray(leg.carriers) ? (leg.carriers[0] ?? '') : (leg.carriers ?? '')
            );
            const carrier = carriersMap[firstCarrierId] ?? {};
            const airlineCode: string = carrier.iataCode ?? firstCarrierId;
            const airlineName: string = carrier.name ?? airlineCode;
            const airlineLogo: string = carrier.logoUrl ?? '';

            // Flight number from first segment
            const segments: any[] = Array.isArray(leg.segments) ? leg.segments : [];
            const firstSeg = segments[0] ?? {};
            const rawFlightNo: string = String(firstSeg.flightNumber ?? '').trim();
            const flightNumber = rawFlightNo
                ? `${airlineCode}${rawFlightNo}`
                : `${airlineCode}${quote.id?.slice(-4) ?? ''}`;

            // Baggage — unknown by default (see extractBaggage comment above)
            const { baggage, baggageKg } = extractBaggage(firstSeg);

            // Layovers between segments
            const layovers: { duration: number; airport?: string }[] = [];
            for (let i = 0; i < segments.length - 1; i++) {
                const cur  = segments[i];
                const next = segments[i + 1];
                try {
                    const diff = new Date(next.departure).getTime() - new Date(cur.arrival).getTime();
                    const destCode = String(
                        (placesMap[String(cur.destinationPlace)]?.iataCode ?? cur.destinationPlace) || ''
                    ).toUpperCase();
                    layovers.push({ duration: Math.max(0, Math.round(diff / 60000)), airport: destCode });
                } catch {
                    layovers.push({ duration: 0 });
                }
            }

            // Map segments into canonical shape
            const mappedSegments = segments.map((seg: any) => {
                const segCarrierId = String(seg.carrier ?? seg.operatingCarrier ?? firstCarrierId);
                const segCarrier   = carriersMap[segCarrierId] ?? {};
                const segCode      = segCarrier.iataCode ?? segCarrierId;
                const segName      = segCarrier.name ?? segCode;
                const segFlightNo  = String(seg.flightNumber ?? '').trim();
                const segOrigin    = (placesMap[String(seg.originPlace)]?.iataCode      ?? String(seg.originPlace      ?? '')).toUpperCase();
                const segDest      = (placesMap[String(seg.destinationPlace)]?.iataCode ?? String(seg.destinationPlace ?? '')).toUpperCase();

                let segDur = Math.max(0, parseInt(seg.duration ?? '0') || 0);
                if (segDur <= 0 && seg.departure && seg.arrival) {
                    try {
                        segDur = Math.max(0, Math.round(
                            (new Date(seg.arrival).getTime() - new Date(seg.departure).getTime()) / 60000
                        ));
                    } catch { /* leave 0 */ }
                }

                return {
                    from: segOrigin,
                    to: segDest,
                    departure: seg.departure ?? '',
                    arrival: seg.arrival ?? '',
                    departing_at: seg.departure ?? '',
                    arriving_at: seg.arrival ?? '',
                    duration: segDur,
                    carrier: segCode,
                    airline: segName,
                    flightNumber: segFlightNo ? `${segCode}${segFlightNo}` : flightNumber,
                    aircraft: '',
                    operating_carrier: { iata_code: segCode, name: segName },
                    origin:      { iata_code: segOrigin },
                    destination: { iata_code: segDest },
                };
            });

            const id = `flightapi-${from}-${to}-${departTime}-${flightNumber}-${price}`
                .replace(/[^a-z0-9-]/gi, '_');

            results.push({
                id,
                source: 'flightapi' as FlightSource,
                airline: airlineName,
                airlineLogo,
                flightNumber,
                from,
                to,
                departTime,
                arriveTime,
                duration: durationMins,
                durationLabel: durationLabel(durationMins),
                stops,
                price,
                currency,
                cabinClass: 'economy',
                baggage,
                amenities: { hasWifi: false, hasMeal: false },
                segments: mappedSegments,
                layovers,
                policies: {
                    ...(baggageKg > 0 ? { baggageKg } : {}),
                },
                deepLink: quote.deepLink ?? undefined,
                bookingLink: undefined,
            });
        } catch (err) {
            console.error('[FlightAPI Mapper] Failed to map quote:', err);
        }
    }

    return results;
}

import { FlightResult, HybridSearchParams } from '@/types/hybridFlight';
import { toMinutes } from '@/lib/search/flightSearchRecordStore';

const RAPID_API_KEY = process.env.RAPID_API_KEY;
const RAPID_API_HOST = process.env.RAPID_API_HOST_PRICELINE || 'priceline-com2.p.rapidapi.com';
const RAPID_API_BASE = `https://${RAPID_API_HOST}`;

const FULL_SERVICE_CARRIERS = [
    'SINGAPORE AIRLINES',
    'QATAR AIRWAYS',
    'EMIRATES',
    'LUFTHANSA',
    'TURKISH AIRLINES',
    'AIR FRANCE',
    'KLM',
    'BRITISH AIRWAYS',
    'ANA',
    'JAPAN AIRLINES',
    'CATHAY PACIFIC',
    'EVA AIR',
    'ETIHAD AIRWAYS',
    'QANTAS',
    'SWISS',
    'AIR CANADA',
];

const normalizeCarrier = (value: unknown): string =>
    String(value || '')
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const isFullServiceCarrier = (airlineName: unknown): boolean => {
    const normalized = normalizeCarrier(airlineName);
    return FULL_SERVICE_CARRIERS.some((name) => normalized.includes(name));
};

const hasExplicitTimezone = (value: string): boolean => /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim());

const parseIsoDateToUtcMs = (value: unknown): number => {
    const text = String(value || '').trim();
    if (!text) return NaN;
    if (!hasExplicitTimezone(text)) return NaN;
    const timestamp = new Date(text).getTime();
    return Number.isFinite(timestamp) ? timestamp : NaN;
};

const parsePositivePrice = (value: unknown): number => {
    const numeric =
        typeof value === 'number'
            ? value
            : typeof value === 'string'
              ? parseFloat(value.replace(/[^0-9.]/g, ''))
              : NaN;
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

const parseDurationMinutes = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.max(0, Math.round(value));
    }

    if (typeof value === 'string') {
        const iso = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
        if (iso) {
            const h = parseInt(iso[1] || '0', 10);
            const m = parseInt(iso[2] || '0', 10);
            return Math.max(0, h * 60 + m);
        }

        const hm = value.match(/(\d+)\s*(h|hr|hrs|hour|hours)\s*(\d+)?\s*(m|min|mins|minute|minutes)?/i);
        if (hm) {
            const h = parseInt(hm[1] || '0', 10);
            const m = parseInt(hm[3] || '0', 10);
            return Math.max(0, h * 60 + m);
        }

        const mins = value.match(/(\d+)\s*(m|min|mins|minute|minutes)/i);
        if (mins) {
            return Math.max(0, parseInt(mins[1], 10));
        }

        const numeric = parseFloat(value.replace(/[^0-9.]/g, ''));
        if (Number.isFinite(numeric)) {
            return Math.max(0, Math.round(numeric));
        }
    }

    return 0;
};

const firstString = (...values: unknown[]): string => {
    for (const value of values) {
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return '';
};

const extractArray = (value: unknown): any[] => (Array.isArray(value) ? value : []);

const unwrapResults = (json: any): any[] => {
    const directCandidates = [
        json?.flights,
        json?.results,
        json?.data,
        json?.itineraries,
        json?.flightOffers,
        json?.tripset,
        json?.body?.flights,
        json?.body?.results,
        json?.body?.data,
    ];

    for (const candidate of directCandidates) {
        if (Array.isArray(candidate) && candidate.length > 0) {
            return candidate;
        }
    }

    return [];
};

const extractSegments = (item: any): any[] => {
    const candidates = [
        item?.segments,
        item?.flights,
        item?.legs,
        item?.slices,
        item?.itinerary?.segments,
        item?.itinerary?.flights,
    ];

    for (const candidate of candidates) {
        if (Array.isArray(candidate) && candidate.length > 0) {
            return candidate;
        }
    }

    if (Array.isArray(item?.itinerary?.legs)) {
        const flattened = item.itinerary.legs.flatMap((leg: any) => extractArray(leg?.segments || leg?.flights));
        if (flattened.length > 0) return flattened;
    }

    return [];
};

const resolveMeal = (item: any, airline: string): 'included' | 'paid' | 'none' => {
    const mealSignals = [
        item?.meal,
        item?.amenities?.meal,
        item?.amenities?.food,
        item?.fare?.meal,
        item?.fare?.mealType,
        item?.cabin?.meal,
    ];

    const text = normalizeCarrier(mealSignals.find((v) => typeof v === 'string'));
    if (text.includes('INCLUDED') || text.includes('FREE')) return 'included';
    if (text.includes('PAID') || text.includes('PURCHASE') || text.includes('BUY')) return 'paid';
    if (text.includes('NONE') || text.includes('NO MEAL')) return 'none';

    const explicitTrue = [
        item?.amenities?.hasMeal,
        item?.amenities?.mealIncluded,
        item?.fare?.mealIncluded,
    ].some((v) => v === true);

    if (explicitTrue) return 'included';

    const explicitFalse = [
        item?.amenities?.hasMeal,
        item?.amenities?.mealIncluded,
        item?.fare?.mealIncluded,
    ].some((v) => v === false);

    if (explicitFalse) return 'none';

    return isFullServiceCarrier(airline) ? 'included' : 'none';
};

const resolveBaggage = (item: any, airline: string): { baggageText: string; checkedKg: number; cabinKg: number } => {
    const baggageRaw =
        item?.baggage ||
        item?.fare?.baggage ||
        item?.fare?.baggageAllowance ||
        item?.allowances?.baggage ||
        item?.amenities?.baggage;

    const baggageText = typeof baggageRaw === 'string' ? baggageRaw : '';
    const parsedKg = parseDurationMinutes(baggageText);

    const checkedKg =
        parseDurationMinutes(item?.policies?.baggageKg) ||
        parseDurationMinutes(item?.fare?.checkedBaggageKg) ||
        parseDurationMinutes(item?.checkedBaggage?.kg) ||
        (parsedKg > 0 ? parsedKg : 0);

    const cabinKg =
        parseDurationMinutes(item?.policies?.cabinBagKg) ||
        parseDurationMinutes(item?.fare?.cabinBaggageKg) ||
        parseDurationMinutes(item?.carryOn?.kg) ||
        7;

    if (checkedKg > 0) {
        return {
            baggageText: `${checkedKg}kg Dahil`,
            checkedKg,
            cabinKg,
        };
    }

    if (isFullServiceCarrier(airline)) {
        return {
            baggageText: '20kg Dahil',
            checkedKg: 20,
            cabinKg,
        };
    }

    return {
        baggageText: baggageText || 'Kontrol Et',
        checkedKg: 0,
        cabinKg,
    };
};

const resolveDuration = (item: any, segments: any[], layovers: any[]) => {
    const providerDuration =
        parseDurationMinutes(item?.durationMinutes) ||
        parseDurationMinutes(item?.duration) ||
        parseDurationMinutes(item?.totalDuration) ||
        parseDurationMinutes(item?.travelTime);

    const firstSegment = segments[0] || {};
    const lastSegment = segments[segments.length - 1] || {};

    const departTime = firstString(
        item?.departTime,
        item?.departureTime,
        item?.departure,
        item?.itinerary?.departure,
        firstSegment?.departTime,
        firstSegment?.departure,
        firstSegment?.departing_at,
        firstSegment?.departure_time,
    );

    const arriveTime = firstString(
        item?.arriveTime,
        item?.arrivalTime,
        item?.arrival,
        item?.itinerary?.arrival,
        lastSegment?.arriveTime,
        lastSegment?.arrival,
        lastSegment?.arriving_at,
        lastSegment?.arrival_time,
    );

    const depMs = parseIsoDateToUtcMs(departTime);
    const arrMs = parseIsoDateToUtcMs(arriveTime);
    const timestampDuration =
        Number.isFinite(depMs) && Number.isFinite(arrMs) && arrMs > depMs
            ? Math.round((arrMs - depMs) / 60000)
            : 0;

    const segmentDuration = segments
        .map((segment) =>
            parseDurationMinutes(segment?.durationMinutes) ||
            parseDurationMinutes(segment?.duration) ||
            parseDurationMinutes(segment?.travelTime)
        )
        .reduce((sum, value) => sum + value, 0);

    const layoverDuration = layovers
        .map((layover: any) => parseDurationMinutes(layover?.duration))
        .reduce((sum: number, value: number) => sum + value, 0);

    const segmentPlusLayovers = segmentDuration + layoverDuration;

    const providerLooksBroken =
        providerDuration > 0 &&
        segmentPlusLayovers > 0 &&
        (providerDuration < Math.round(segmentPlusLayovers * 0.7) ||
            providerDuration > Math.round(segmentPlusLayovers * 1.4));

    const resolved = !providerLooksBroken && providerDuration > 0
        ? providerDuration
        : segmentPlusLayovers > 0
          ? segmentPlusLayovers
          : timestampDuration > 0
            ? timestampDuration
            : 0;

    return {
        resolved,
        departTime,
        arriveTime,
        debug: {
            providerDuration,
            timestampDuration,
            segmentDuration,
            layoverDuration,
            segmentPlusLayovers,
            providerLooksBroken,
            resolvedDuration: resolved,
            provider: 'PRICELINE',
        },
    };
};

export class PricelineRateLimitError extends Error {
    code = 'PRICELINE_RATE_LIMIT';
    status = 429;

    constructor(message = 'Hızlı Arama Limiti Doldu') {
        super(message);
        this.name = 'PricelineRateLimitError';
    }
}

export async function searchPriceline(params: HybridSearchParams): Promise<FlightResult[]> {
    if (!RAPID_API_KEY) {
        console.warn('[PRICELINE] RAPID_API_KEY missing, provider skipped');
        return [];
    }

    const date = params.date.split('T')[0];
    const payload = {
        origin: params.origin,
        destination: params.destination,
        departureDate: date,
        adults: params.adults || 1,
        cabinClass: params.cabin || 'economy',
        currency: params.currency || 'USD',
    };

    const endpoints = [
        {
            method: 'POST',
            path: '/flights/searchFlights',
            body: payload,
        },
        {
            method: 'GET',
            path: `/flights/searchFlights?origin=${encodeURIComponent(params.origin)}&destination=${encodeURIComponent(params.destination)}&departureDate=${encodeURIComponent(date)}&adults=${encodeURIComponent(String(params.adults || 1))}&currency=${encodeURIComponent(params.currency || 'USD')}`,
        },
    ];

    let lastError: any = null;

    for (const endpoint of endpoints) {
        try {
            const response = await fetch(`${RAPID_API_BASE}${endpoint.path}`, {
                method: endpoint.method,
                headers: {
                    'X-RapidAPI-Key': RAPID_API_KEY,
                    'X-RapidAPI-Host': RAPID_API_HOST,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: endpoint.method === 'POST' ? JSON.stringify(endpoint.body) : undefined,
            });

            if (response.status === 429) {
                throw new PricelineRateLimitError();
            }

            if (!response.ok) {
                lastError = new Error(`Priceline request failed (${response.status})`);
                continue;
            }

            const json = await response.json();
            const entries = unwrapResults(json);
            if (entries.length === 0) {
                continue;
            }

            const mappedFlights = entries
                .map((item: any, idx: number): FlightResult | null => {
                    const segments = extractSegments(item);
                    if (segments.length === 0) return null;

                    const airline = firstString(
                        item?.airline,
                        item?.carrier,
                        item?.marketingCarrier,
                        segments[0]?.airline,
                        segments[0]?.carrier,
                        'Unknown Airline'
                    );

                    const layovers = extractArray(item?.layovers).map((layover: any) => ({
                        city: firstString(layover?.city, layover?.name),
                        airport: firstString(layover?.airport, layover?.code, layover?.iata),
                        duration: toMinutes(layover?.duration || layover?.durationMinutes),
                    }));

                    const duration = resolveDuration(item, segments, layovers);
                    const meal = resolveMeal(item, airline);
                    const baggage = resolveBaggage(item, airline);
                    const price =
                        parsePositivePrice(item?.price) ||
                        parsePositivePrice(item?.amount) ||
                        parsePositivePrice(item?.totalPrice) ||
                        parsePositivePrice(item?.fare?.total);

                    if (!price || price <= 0) {
                        return null;
                    }

                    const fromCode = firstString(
                        item?.from,
                        item?.origin,
                        item?.originCode,
                        segments[0]?.from,
                        segments[0]?.origin,
                        segments[0]?.departureAirport,
                        params.origin
                    ).toUpperCase();

                    const toCode = firstString(
                        item?.to,
                        item?.destination,
                        item?.destinationCode,
                        segments[segments.length - 1]?.to,
                        segments[segments.length - 1]?.destination,
                        segments[segments.length - 1]?.arrivalAirport,
                        params.destination
                    ).toUpperCase();

                    const sourceId = firstString(item?.id, item?.offerId, item?.token, `priceline_${idx}`);
                    const flightNumber = firstString(
                        item?.flightNumber,
                        item?.flightNo,
                        segments[0]?.flightNumber,
                        segments[0]?.flight_no,
                        'N/A'
                    );

                    return {
                        id: `PRICELINE_${sourceId}`,
                        source: 'PRICELINE' as any,
                        airline,
                        airlineLogo: firstString(item?.airlineLogo, item?.logo, segments[0]?.airlineLogo) || undefined,
                        flightNumber,
                        from: fromCode || params.origin,
                        to: toCode || params.destination,
                        departTime: duration.departTime || params.date,
                        arriveTime: duration.arriveTime || params.date,
                        duration: duration.resolved,
                        durationLabel: `${Math.floor(duration.resolved / 60)}h ${duration.resolved % 60}m`,
                        stops: Math.max(0, segments.length - 1),
                        price,
                        currency: firstString(item?.currency, item?.priceCurrency, params.currency, 'USD'),
                        cabinClass: (params.cabin || 'economy') as any,
                        layovers,
                        segments: segments.map((segment: any) => ({
                            departure: firstString(segment?.departure, segment?.departTime, segment?.departing_at, segment?.departure_time),
                            arrival: firstString(segment?.arrival, segment?.arriveTime, segment?.arriving_at, segment?.arrival_time),
                            duration: parseDurationMinutes(segment?.duration || segment?.durationMinutes),
                            airline: firstString(segment?.airline, segment?.carrier, airline),
                            flightNumber: firstString(segment?.flightNumber, segment?.flight_no, flightNumber),
                            origin: firstString(segment?.origin, segment?.from, segment?.departureAirport, fromCode),
                            destination: firstString(segment?.destination, segment?.to, segment?.arrivalAirport, toCode),
                            aircraft: firstString(segment?.aircraft, segment?.equipment),
                        })),
                        meal,
                        amenities: {
                            hasMeal: meal === 'included',
                            hasWifi: typeof item?.amenities?.hasWifi === 'boolean' ? item.amenities.hasWifi : undefined,
                            baggage: baggage.baggageText,
                        } as any,
                        policies: {
                            baggageKg: baggage.checkedKg,
                            cabinBagKg: baggage.cabinKg,
                        },
                        durationDebug: duration.debug,
                    } as FlightResult;
                })
                .filter((flight): flight is FlightResult => flight !== null);

            return mappedFlights;
        } catch (error: any) {
            if (error instanceof PricelineRateLimitError) {
                throw error;
            }
            lastError = error;
        }
    }

    if (lastError) {
        console.warn('[PRICELINE] provider failed:', lastError?.message || lastError);
    }

    return [];
}

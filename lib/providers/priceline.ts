import { FlightResult, HybridSearchParams } from '@/types/hybridFlight';
import { toMinutes } from '@/lib/search/flightSearchRecordStore';

const RAPID_API_KEY = process.env.RAPID_API_KEY;
const RAPID_API_HOST = process.env.RAPID_API_HOST_PRICELINE || 'priceline-com2.p.rapidapi.com';
const RAPID_API_BASE = `https://${RAPID_API_HOST}`;
const DEFAULT_TARGET_CURRENCY = 'AUD';
const FALLBACK_USD_TO_AUD_RATE = 1.53;

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

const FULL_SERVICE_CARRIER_CODES = new Set([
    'SQ', 'QR', 'EK', 'LH', 'TK', 'AF', 'KL', 'BA', 'NH', 'JL', 'CX', 'BR', 'EY', 'QF', 'LX', 'AC'
]);

const normalizeCarrier = (value: unknown): string =>
    String(value || '')
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const isFullServiceCarrier = (airlineName: unknown, airlineCode?: unknown): boolean => {
    const normalized = normalizeCarrier(airlineName);
    const normalizedCode = normalizeCarrier(airlineCode);
    return FULL_SERVICE_CARRIERS.some((name) => normalized.includes(name)) || FULL_SERVICE_CARRIER_CODES.has(normalizedCode);
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

const normalizeCurrencyCode = (value: unknown, fallback = 'USD'): string => {
    const code = String(value || '').trim().toUpperCase();
    return /^[A-Z]{3}$/.test(code) ? code : fallback;
};

const getUsdToAudRate = (): number => {
    const envRate = Number.parseFloat(String(process.env.PRICELINE_USD_TO_AUD_RATE || ''));
    if (Number.isFinite(envRate) && envRate > 0) {
        return envRate;
    }
    return FALLBACK_USD_TO_AUD_RATE;
};

const normalizePricelineFare = (
    rawPrice: number,
    rawCurrency: string,
    expectedCurrency: string,
): { price: number; currency: string; converted: boolean; rate?: number } => {
    if (!Number.isFinite(rawPrice) || rawPrice <= 0) {
        return { price: 0, currency: expectedCurrency, converted: false };
    }

    const sourceCurrency = normalizeCurrencyCode(rawCurrency, 'USD');
    const targetCurrency = normalizeCurrencyCode(expectedCurrency, DEFAULT_TARGET_CURRENCY);

    if (sourceCurrency === targetCurrency) {
        return {
            price: parseFloat(rawPrice.toFixed(2)),
            currency: targetCurrency,
            converted: false,
        };
    }

    if (sourceCurrency === 'USD' && targetCurrency === 'AUD') {
        const rate = getUsdToAudRate();
        return {
            price: parseFloat((rawPrice * rate).toFixed(2)),
            currency: 'AUD',
            converted: true,
            rate,
        };
    }

    return {
        price: parseFloat(rawPrice.toFixed(2)),
        currency: sourceCurrency,
        converted: false,
    };
};

const DEFAULT_AIRLINE_LOGO = '/airlines/default.png';

const toAbsoluteUrl = (baseUrl: unknown, imagePath: unknown): string => {
    const rawPath = String(imagePath || '').trim();
    if (!rawPath) return '';
    if (/^https?:\/\//i.test(rawPath)) return rawPath;
    if (rawPath.startsWith('//')) return `https:${rawPath}`;

    const rawBase = String(baseUrl || '').trim();
    if (rawBase) {
        try {
            return new URL(rawPath, rawBase.endsWith('/') ? rawBase : `${rawBase}/`).toString();
        } catch {
        }
    }

    if (rawPath.startsWith('/')) {
        return `${RAPID_API_BASE}${rawPath}`;
    }

    return rawPath;
};

const toGstaticLogo = (airlineCode: unknown): string => {
    const normalizedCode = String(airlineCode || '').trim().toUpperCase();
    return /^[A-Z0-9]{2,3}$/.test(normalizedCode)
        ? `https://www.gstatic.com/flights/airline_logos/70px/${normalizedCode}.png`
        : '';
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
        json?.data?.results,
        json?.data?.flights,
        json?.data?.itineraries,
        json?.data?.listings,
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

    if (json?.data?.listings && typeof json.data.listings === 'object') {
        const objectValues = Object.values(json.data.listings).filter((entry) => !!entry);
        if (objectValues.length > 0) {
            return objectValues as any[];
        }
    }

    return [];
};

const extractListings = (json: any): any[] => {
    const listings = json?.data?.data?.listings ?? json?.data?.listings;
    if (Array.isArray(listings)) {
        return listings;
    }

    if (listings && typeof listings === 'object') {
        return Object.values(listings)
            .flatMap((entry: any) => (Array.isArray(entry) ? entry : [entry]))
            .filter(Boolean);
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

const extractSegmentsFromSlices = (item: any): any[] => {
    const slices = extractArray(item?.slices);
    const flattened = slices.flatMap((slice: any) => extractArray(slice?.segments));
    if (flattened.length > 0) {
        return flattened;
    }

    return extractSegments(item);
};

const resolveMeal = (item: any, airline: string, airlineCode?: string): 'included' | 'paid' | 'none' => {
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

    return isFullServiceCarrier(airline, airlineCode) ? 'included' : 'none';
};

const extractStringsDeep = (value: unknown, depth = 0): string[] => {
    if (depth > 4 || value === null || value === undefined) return [];
    if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
    if (typeof value === 'number' || typeof value === 'boolean') return [String(value)];
    if (Array.isArray(value)) {
        return value.flatMap((entry) => extractStringsDeep(entry, depth + 1));
    }
    if (typeof value === 'object') {
        return Object.values(value as Record<string, unknown>).flatMap((entry) =>
            extractStringsDeep(entry, depth + 1)
        );
    }
    return [];
};

const parseWeightKg = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.max(0, Math.round(value));
    }

    if (typeof value !== 'string') return 0;

    const text = value.trim().toLowerCase();
    if (!text) return 0;

    const kgMatch = text.match(/(\d+(?:\.\d+)?)\s*kg\b/i);
    if (kgMatch) {
        return Math.max(0, Math.round(parseFloat(kgMatch[1])));
    }

    const lbMatch = text.match(/(\d+(?:\.\d+)?)\s*(lb|lbs|pound|pounds)\b/i);
    if (lbMatch) {
        const pounds = parseFloat(lbMatch[1]);
        return Math.max(0, Math.round(pounds * 0.453592));
    }

    if (/^\d+(?:\.\d+)?$/.test(text)) {
        const numeric = parseFloat(text);
        if (Number.isFinite(numeric) && numeric > 0 && numeric <= 70) {
            return Math.round(numeric);
        }
    }

    return 0;
};

const resolveBaggage = (
    item: any,
    airline: string
): { baggageText: string; checkedKg: number; cabinKg: number; checkedIncluded: boolean } => {
    const baggageRaw =
        item?.baggage ||
        item?.fare?.baggage ||
        item?.fare?.baggageAllowance ||
        item?.allowances?.baggage ||
        item?.amenities?.baggage;

    const baggageText = typeof baggageRaw === 'string' ? baggageRaw : '';

    const checkedNarratives = [
        baggageRaw,
        item?.baggageInfo,
        item?.fare?.baggageInfo,
        item?.fareRules,
        item?.fare?.fareRules,
        item?.fareRule,
    ]
        .flatMap((entry) => extractStringsDeep(entry))
        .filter(Boolean);

    const checkedKgFromText = checkedNarratives.reduce((maxKg, text) => {
        const normalized = text.toLowerCase();
        const isCheckedContext =
            normalized.includes('checked') ||
            normalized.includes('check-in') ||
            normalized.includes('hold bag') ||
            normalized.includes('hold baggage') ||
            normalized.includes('bagaj');
        if (!isCheckedContext) return maxKg;
        return Math.max(maxKg, parseWeightKg(text));
    }, 0);

    const cabinKgFromText = checkedNarratives.reduce((maxKg, text) => {
        const normalized = text.toLowerCase();
        const isCabinContext =
            normalized.includes('cabin') ||
            normalized.includes('carry') ||
            normalized.includes('hand bag');
        if (!isCabinContext) return maxKg;
        return Math.max(maxKg, parseWeightKg(text));
    }, 0);

    const explicitNoCheckedFromText = checkedNarratives.some((text) => {
        const normalized = text.toLowerCase();
        return (
            (normalized.includes('checked') || normalized.includes('check-in') || normalized.includes('hold bag')) &&
            (normalized.includes('not included') ||
                normalized.includes('no checked') ||
                normalized.includes('0 piece') ||
                normalized.includes('0pc') ||
                normalized.includes('excluded'))
        );
    });

    const parsedKg = parseWeightKg(baggageText);

    const checkedKg =
        parseWeightKg(item?.policies?.baggageKg) ||
        parseWeightKg(item?.fare?.checkedBaggageKg) ||
        parseWeightKg(item?.checkedBaggage?.kg) ||
        parseWeightKg(item?.baggageInfo?.checkedBaggageKg) ||
        parseWeightKg(item?.baggageInfo?.checked?.kg) ||
        parseWeightKg(item?.fareRules?.checkedBaggageKg) ||
        checkedKgFromText ||
        (parsedKg > 0 ? parsedKg : 0);

    const cabinKg =
        parseWeightKg(item?.policies?.cabinBagKg) ||
        parseWeightKg(item?.fare?.cabinBaggageKg) ||
        parseWeightKg(item?.carryOn?.kg) ||
        parseWeightKg(item?.baggageInfo?.cabinBaggageKg) ||
        cabinKgFromText ||
        7;

    const checkedIncluded = checkedKg > 0 || (!explicitNoCheckedFromText && isFullServiceCarrier(airline));

    if (checkedIncluded && checkedKg > 0) {
        return {
            baggageText: `${checkedKg}kg Dahil`,
            checkedKg,
            cabinKg,
            checkedIncluded: true,
        };
    }

    if (checkedIncluded) {
        const inferredCheckedKg = checkedKg > 0 ? checkedKg : 20;
        return {
            baggageText: `${inferredCheckedKg}kg Dahil`,
            checkedKg: inferredCheckedKg,
            cabinKg,
            checkedIncluded: true,
        };
    }

    return {
        baggageText: baggageText || 'Bagaj dahil değil',
        checkedKg: 0,
        cabinKg,
        checkedIncluded: false,
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

export class PricelineEndpointNotFoundError extends Error {
    code = 'PRICELINE_ENDPOINT_NOT_FOUND';
    status = 404;

    constructor(message = 'Priceline endpoint not found for configured host') {
        super(message);
        this.name = 'PricelineEndpointNotFoundError';
    }
}

export async function searchPriceline(params: HybridSearchParams): Promise<FlightResult[]> {
    if (!RAPID_API_KEY) {
        console.warn('[PRICELINE] RAPID_API_KEY missing, provider skipped');
        return [];
    }

    const date = params.date.split('T')[0];
    const expectedCurrency = normalizeCurrencyCode(params.currency, DEFAULT_TARGET_CURRENCY);

    const departureAirportCode = String(params.origin || '').toUpperCase();
    const arrivalAirportCode = String(params.destination || '').toUpperCase();
    const numberOfAdults = String(params.adults || 1);
    const numberOfChildren = String(Math.max(0, params.children || 0));
    const numberOfInfants = String(Math.max(0, Math.min(params.infants || 0, params.adults || 1)));
    const classType = (() => {
        switch (params.cabin) {
            case 'premium':
                return 'PREMIUM_ECONOMY';
            case 'business':
                return 'BUS';
            case 'first':
                return 'FST';
            default:
                return 'ECO';
        }
    })();

    const query = new URLSearchParams({
        itinerary_type: 'ONE_WAY',
        class_type: classType,
        cabin_class: String(params.cabin || 'economy').toUpperCase(),
        departure_airport_code: departureAirportCode,
        arrival_airport_code: arrivalAirportCode,
        departure_date: date,
        number_of_adults: numberOfAdults,
        number_of_children: numberOfChildren,
        number_of_infants: numberOfInfants,
        children: numberOfChildren,
        infants: numberOfInfants,
        originAirportCode: departureAirportCode,
        destinationAirportCode: arrivalAirportCode,
        departureDate: date,
    });

    const requestUrl = `${RAPID_API_BASE}/flights/search-one-way?${query.toString()}`;
    let lastError: any = null;

    try {
        console.log('[PRICELINE][DIAG] Request URL:', requestUrl);
        console.log('[PRICELINE][DIAG] Request params:', {
            itinerary_type: 'ONE_WAY',
            class_type: classType,
            cabin_class: String(params.cabin || 'economy').toUpperCase(),
            departure_airport_code: departureAirportCode,
            arrival_airport_code: arrivalAirportCode,
            departure_date: date,
            number_of_adults: numberOfAdults,
            number_of_children: numberOfChildren,
            number_of_infants: numberOfInfants,
            originAirportCode: departureAirportCode,
            destinationAirportCode: arrivalAirportCode,
            departureDate: date,
        });

        const response = await fetch(requestUrl, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': RAPID_API_KEY,
                'X-RapidAPI-Host': RAPID_API_HOST,
                Accept: 'application/json',
            },
        });

        const responseText = await response.text();
        console.log('[PRICELINE][DIAG] Raw JSON first500:', responseText.slice(0, 500));

        if (response.status === 401) {
            lastError = new Error(`[PRICELINE] Unauthorized (401): ${responseText.slice(0, 160)}`);
        } else if (response.status === 403) {
            const invalidHost = /invalid\s*host/i.test(responseText);
            console.error('[PRICELINE][DIAG] 403 Forbidden', {
                hostSent: RAPID_API_HOST,
                expectedHost: 'priceline-com2.p.rapidapi.com',
                hostMatchesEnv: RAPID_API_HOST === 'priceline-com2.p.rapidapi.com',
                invalidHost,
                first200: responseText.slice(0, 200),
            });
            lastError = new Error(`[PRICELINE] Forbidden (403): ${responseText.slice(0, 160)}`);
        } else if (response.status === 429) {
            throw new PricelineRateLimitError();
        } else if (response.status === 404) {
            throw new PricelineEndpointNotFoundError(
                `[PRICELINE] ${RAPID_API_HOST}/flights/search-one-way -> 404 (${responseText.slice(0, 120)})`
            );
        } else if (!response.ok) {
            lastError = new Error(`Priceline request failed (${response.status}) - ${responseText.slice(0, 120)}`);
        }

        if (lastError) {
            throw lastError;
        }

        let json: any = null;
        try {
            json = responseText ? JSON.parse(responseText) : null;
        } catch (parseError: any) {
            throw new Error(`[PRICELINE] JSON parse error: ${parseError?.message || parseError}`);
        }

        const providerError = json?.errors || json?.error || json?.data?.error;
        if (providerError) {
            console.warn('[PRICELINE][DIAG] Provider-side error payload:', providerError);
        }

        const entries = extractListings(json);
        const airlineImagePath = firstString(
            json?.data?.airlineImagePath,
            json?.data?.data?.airlineImagePath,
            json?.airlineImagePath
        );
        const airlineCatalog = new Map<string, { name: string; logo: string }>(
            extractArray(json?.data?.airline).map((airline: any) => {
                const code = String(airline?.code || '').toUpperCase();
                const name = String(airline?.name || '').trim();
                const logoPath = firstString(
                    airline?.smallImage,
                    airline?.mediumImage,
                    airline?.largeImage,
                    airline?.logo,
                    airline?.image,
                    airline?.imageUrl
                );
                const logo = toAbsoluteUrl(
                    firstString(airline?.airlineImagePath, airlineImagePath),
                    logoPath
                );
                return [code, { name, logo }];
            })
        );

        console.log('[PRICELINE][DIAG] listings path stats:', {
            data_data_listings: Array.isArray(json?.data?.data?.listings)
                ? json.data.data.listings.length
                : json?.data?.data?.listings && typeof json.data.data.listings === 'object'
                    ? Object.keys(json.data.data.listings).length
                    : 0,
            data_listings: Array.isArray(json?.data?.listings)
                ? json.data.listings.length
                : json?.data?.listings && typeof json.data.listings === 'object'
                    ? Object.keys(json.data.listings).length
                    : 0,
            selected_entries: entries.length,
        });
        if (entries.length === 0) {
            return [];
        }

        let droppedNoSegments = 0;
        let droppedNoPrice = 0;

        const mappedFlights = entries
            .map((item: any, idx: number): FlightResult | null => {
                const segments = extractSegmentsFromSlices(item);
                if (segments.length === 0) {
                    droppedNoSegments += 1;
                    return null;
                }

                const airlineCode = firstString(
                    item?.airlineCode,
                    item?.marketingAirlineCode,
                    segments[0]?.marketingAirline,
                    segments[0]?.airlineCode,
                    segments[0]?.marketingAirlineCode,
                    segments[0]?.carrierCode,
                );

                const airline = firstString(
                    item?.airline,
                    item?.carrier,
                    item?.marketingCarrier,
                    airlineCatalog.get(String(airlineCode || '').toUpperCase())?.name,
                    segments[0]?.airline,
                    segments[0]?.carrier,
                    airlineCode,
                    'Unknown Airline'
                );

                const catalogLogo = airlineCatalog.get(String(airlineCode || '').toUpperCase())?.logo;
                const listingLogo = toAbsoluteUrl(
                    firstString(item?.airlineImagePath, airlineImagePath),
                    firstString(item?.smallImage, item?.logo, item?.airlineLogo)
                );
                const segmentLogo = toAbsoluteUrl(
                    firstString(segments[0]?.airlineImagePath, airlineImagePath),
                    firstString(segments[0]?.smallImage, segments[0]?.logo, segments[0]?.airlineLogo)
                );
                const airlineLogo =
                    firstString(listingLogo, segmentLogo, catalogLogo, toGstaticLogo(airlineCode)) || DEFAULT_AIRLINE_LOGO;

                const layovers = extractArray(item?.layovers).map((layover: any) => ({
                    city: firstString(layover?.city, layover?.name),
                    airport: firstString(layover?.airport, layover?.code, layover?.iata),
                    duration: toMinutes(layover?.duration || layover?.durationMinutes),
                }));

                const duration = resolveDuration(item, segments, layovers);
                const meal = resolveMeal(item, airline, airlineCode);
                const baggage = resolveBaggage(item, airline);

                const firstPrice = Array.isArray(item?.price) ? item.price[0] : null;
                const price =
                    parsePositivePrice(firstPrice?.amount) ||
                    parsePositivePrice(item?.totalPriceWithDecimal?.price) ||
                    parsePositivePrice(item?.totalPrice?.price) ||
                    parsePositivePrice(item?.totalPrice);
                const priceCurrency = firstString(
                    firstPrice?.currencyCode,
                    item?.totalPriceWithDecimal?.currencyCode,
                    item?.totalPrice?.currencyCode,
                    params.currency,
                    'USD'
                );
                const normalizedFare = normalizePricelineFare(price, priceCurrency, expectedCurrency);

                if (!price || price <= 0) {
                    droppedNoPrice += 1;
                    return null;
                }

                const fromCode = firstString(
                    item?.departure_airport_code,
                    item?.from,
                    item?.origin,
                    item?.originCode,
                    segments[0]?.departInfo?.airport?.code,
                    segments[0]?.departure_airport_code,
                    segments[0]?.departureAirportCode,
                    segments[0]?.from,
                    segments[0]?.origin,
                    departureAirportCode
                ).toUpperCase();

                const toCode = firstString(
                    item?.arrival_airport_code,
                    item?.to,
                    item?.destination,
                    item?.destinationCode,
                    segments[segments.length - 1]?.arrivalInfo?.airport?.code,
                    segments[segments.length - 1]?.arrival_airport_code,
                    segments[segments.length - 1]?.arrivalAirportCode,
                    segments[segments.length - 1]?.to,
                    segments[segments.length - 1]?.destination,
                    arrivalAirportCode
                ).toUpperCase();

                const sourceId = firstString(item?.id, item?.listingId, item?.offerId, item?.token, `priceline_${idx}`);
                const flightNumber = firstString(
                    item?.flightNumber,
                    item?.flightNo,
                    segments[0]?.flightNumber,
                    segments[0]?.flight_no,
                    segments[0]?.flightNumberText,
                    'N/A'
                );

                return {
                    id: `PRICELINE_${sourceId}`,
                    source: 'PRICELINE' as any,
                    airline,
                    airlineLogo,
                    flightNumber,
                    from: fromCode || departureAirportCode,
                    to: toCode || arrivalAirportCode,
                    departTime: duration.departTime || params.date,
                    arriveTime: duration.arriveTime || params.date,
                    duration: duration.resolved,
                    durationLabel: `${Math.floor(duration.resolved / 60)}h ${duration.resolved % 60}m`,
                    stops: Math.max(0, segments.length - 1),
                    price: normalizedFare.price,
                    currency: normalizedFare.currency,
                    baggage: baggage.checkedIncluded ? 'checked' : baggage.cabinKg > 0 ? 'cabin' : 'none',
                    cabinClass: (params.cabin || 'economy') as any,
                    layovers,
                    segments: segments.map((segment: any) => ({
                        marketingAirlineCode: firstString(
                            segment?.marketingAirlineCode,
                            segment?.marketingAirline,
                            segment?.carrierCode,
                            airlineCode
                        ).toUpperCase(),
                        operatingAirlineCode: firstString(
                            segment?.operatingAirlineCode,
                            segment?.operatingAirline,
                            segment?.operatingCarrierCode,
                            segment?.carrierCode,
                            segment?.marketingAirlineCode,
                            segment?.marketingAirline,
                            airlineCode
                        ).toUpperCase(),
                        marketingCarrier: firstString(
                            segment?.marketingAirlineName,
                            segment?.marketingAirline,
                            segment?.carrier,
                            segment?.airline
                        ),
                        operatingCarrier: firstString(
                            segment?.operatingAirlineName,
                            segment?.operatingAirline,
                            segment?.carrier,
                            segment?.airline
                        ),
                        departure: firstString(
                            segment?.departure,
                            segment?.departTime,
                            segment?.departing_at,
                            segment?.departure_time,
                            segment?.departureDateTime,
                            segment?.departInfo?.time?.dateTime
                        ),
                        arrival: firstString(
                            segment?.arrival,
                            segment?.arriveTime,
                            segment?.arriving_at,
                            segment?.arrival_time,
                            segment?.arrivalDateTime,
                            segment?.arrivalInfo?.time?.dateTime
                        ),
                        duration: parseDurationMinutes(segment?.duration || segment?.durationMinutes),
                        marketingAirlineName: firstString(
                            segment?.marketingAirlineName,
                            airlineCatalog.get(
                                firstString(
                                    segment?.marketingAirlineCode,
                                    segment?.marketingAirline,
                                    segment?.carrierCode,
                                    airlineCode
                                ).toUpperCase()
                            )?.name,
                            segment?.airline,
                            airline
                        ),
                        operatingAirlineName: firstString(
                            segment?.operatingAirlineName,
                            airlineCatalog.get(
                                firstString(
                                    segment?.operatingAirlineCode,
                                    segment?.operatingAirline,
                                    segment?.operatingCarrierCode,
                                    segment?.carrierCode,
                                    segment?.marketingAirlineCode,
                                    segment?.marketingAirline,
                                    airlineCode
                                ).toUpperCase()
                            )?.name,
                            segment?.airline,
                            airline
                        ),
                        airline: firstString(
                            segment?.airline,
                            segment?.carrier,
                            airlineCatalog.get(String(segment?.marketingAirline || '').toUpperCase())?.name,
                            airline
                        ),
                        airlineLogo: firstString(
                            toAbsoluteUrl(
                                firstString(segment?.airlineImagePath, airlineImagePath),
                                firstString(segment?.smallImage, segment?.logo, segment?.airlineLogo)
                            ),
                            airlineCatalog.get(
                                firstString(
                                    segment?.operatingAirlineCode,
                                    segment?.operatingAirline,
                                    segment?.operatingCarrierCode,
                                    segment?.carrierCode,
                                    segment?.marketingAirlineCode,
                                    segment?.marketingAirline,
                                    airlineCode
                                ).toUpperCase()
                            )?.logo,
                            airlineCatalog.get(
                                firstString(
                                    segment?.marketingAirlineCode,
                                    segment?.marketingAirline,
                                    segment?.carrierCode,
                                    airlineCode
                                ).toUpperCase()
                            )?.logo,
                            toGstaticLogo(
                                firstString(
                                    segment?.operatingAirlineCode,
                                    segment?.operatingAirline,
                                    segment?.marketingAirlineCode,
                                    segment?.marketingAirline,
                                    segment?.carrierCode,
                                    airlineCode
                                ).toUpperCase()
                            )
                        ),
                        flightNumber: firstString(segment?.flightNumber, segment?.flight_no, flightNumber),
                        origin: firstString(
                            segment?.origin,
                            segment?.from,
                            segment?.departureAirport,
                            segment?.departure_airport_code,
                            segment?.departureAirportCode,
                            segment?.departInfo?.airport?.code,
                            fromCode
                        ),
                        destination: firstString(
                            segment?.destination,
                            segment?.to,
                            segment?.arrivalAirport,
                            segment?.arrival_airport_code,
                            segment?.arrivalAirportCode,
                            segment?.arrivalInfo?.airport?.code,
                            toCode
                        ),
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
                    baggageSummary: {
                        checked: baggage.checkedIncluded
                            ? `${baggage.checkedKg || 20}kg Dahil`
                            : 'Dahil Değil',
                        cabin: `${baggage.cabinKg || 7}kg Kabin`,
                        totalWeight: baggage.checkedIncluded
                            ? `${(baggage.checkedKg || 20) + (baggage.cabinKg || 7)}kg`
                            : `${baggage.cabinKg || 7}kg`,
                    },
                    durationDebug: {
                        ...duration.debug,
                        priceNormalization: {
                            originalPrice: parseFloat(price.toFixed(2)),
                            originalCurrency: normalizeCurrencyCode(priceCurrency, 'USD'),
                            expectedCurrency,
                            converted: normalizedFare.converted,
                            conversionRate: normalizedFare.rate,
                            normalizedPrice: normalizedFare.price,
                            normalizedCurrency: normalizedFare.currency,
                        },
                    },
                } as FlightResult;
            })
            .filter((flight): flight is FlightResult => flight !== null);

        console.log('[PRICELINE][DIAG] Mapping stats:', {
            rawEntries: entries.length,
            mappedFlights: mappedFlights.length,
            droppedNoSegments,
            droppedNoPrice,
        });

        if (mappedFlights.length === 0 && entries.length > 0) {
            console.warn('[PRICELINE][DIAG] data.listings exists but all rows dropped during mapping');
        }

        return mappedFlights;
    } catch (error: any) {
        if (error instanceof PricelineRateLimitError) {
            throw error;
        }
        console.error('[PRICELINE][DIAG] Request failed:', error?.message || error);
        lastError = error;
    }

    if (lastError) {
        console.warn('[PRICELINE] provider failed:', lastError?.message || lastError);
    }

    return [];
}

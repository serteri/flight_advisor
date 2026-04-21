type ParsedSegment = {
    from: string;
    to: string;
    departureDateTime?: string;
    arrivalDateTime?: string;
    airline?: string;
    flightNumber?: string;
    aircraft?: string;
    marketedAirline?: string;
    bookingClass?: string;
};

export type ParsedItinerary = {
    segments: ParsedSegment[];
    warnings: string[];
    confidence: number;
    inferred: {
        price?: number;
        currency?: string;
        cabin?: 'economy' | 'premium' | 'business' | 'first';
        refundable?: boolean;
    };
};

const AIRPORT_PAIR_REGEXES = [
    /\b([A-Z]{3})\b\s*(?:->|→|-|to)\s*\b([A-Z]{3})\b/i,
    /from\s+\b([A-Z]{3})\b.*to\s+\b([A-Z]{3})\b/i,
];

const FLIGHT_NUMBER_REGEX = /\b([A-Z0-9]{2,3})\s?(\d{1,4})\b/;
const AIRCRAFT_REGEX = /\b(A3\d{2}|A2\d{2}|A1\d{2}|B7\d{2}|B73\d|B74\d|B75\d|B76\d|B77\d|B78\d|B79\d|E\d{3}|CRJ\d{3})\b/i;
const BOOKING_CLASS_REGEX = /\bclass\s*[:\-]?\s*([A-Z])\b/i;

const DATETIME_REGEXES = [
    /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+\-]\d{2}:?\d{2})\b/gi,
    /\b\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{4}\s\d{1,2}:\d{2}\s?(?:AM|PM)?\b/gi,
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}\s\d{1,2}:\d{2}\s?(?:AM|PM)?\b/gi,
];

const CURRENCY_SYMBOL_MAP: Record<string, string> = {
    '$': 'USD',
    '€': 'EUR',
    '£': 'GBP',
};

const parseDateValue = (value: string): string | undefined => {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return undefined;
    return new Date(parsed).toISOString();
};

const extractDateTokens = (line: string): string[] => {
    const tokens: string[] = [];
    for (const regex of DATETIME_REGEXES) {
        const matches = line.match(regex) || [];
        for (const match of matches) {
            const iso = parseDateValue(match);
            if (iso) tokens.push(iso);
        }
    }
    return tokens;
};

const normalizeCabin = (text: string): ParsedItinerary['inferred']['cabin'] | undefined => {
    const value = text.toLowerCase();
    if (value.includes('premium economy')) return 'premium';
    if (value.includes('business')) return 'business';
    if (value.includes('first')) return 'first';
    if (value.includes('economy')) return 'economy';
    return undefined;
};

const parsePrice = (text: string): { amount?: number; currency?: string } => {
    const currencyCodeMatch = text.match(/\b(USD|EUR|GBP|TRY|AUD|CAD|JPY)\b/i);
    const symbolMatch = text.match(/([\$€£])\s?(\d{2,6}(?:[.,]\d{1,2})?)/);
    const numericMatch = text.match(/\b(\d{2,6}(?:[.,]\d{1,2})?)\b/);

    if (symbolMatch) {
        return {
            amount: Number(symbolMatch[2].replace(',', '.')),
            currency: CURRENCY_SYMBOL_MAP[symbolMatch[1]] || currencyCodeMatch?.[1]?.toUpperCase(),
        };
    }

    if (currencyCodeMatch && numericMatch) {
        return {
            amount: Number(numericMatch[1].replace(',', '.')),
            currency: currencyCodeMatch[1].toUpperCase(),
        };
    }

    return {};
};

export function parseItineraryText(rawText: string): ParsedItinerary {
    const text = rawText.replace(/\u2013|\u2014/g, '-').replace(/\u2192/g, '->');
    const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    const segments: ParsedSegment[] = [];
    const warnings: string[] = [];

    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];

        let routeMatch: RegExpMatchArray | null = null;
        for (const regex of AIRPORT_PAIR_REGEXES) {
            routeMatch = line.match(regex);
            if (routeMatch) break;
        }
        if (!routeMatch) continue;

        const from = routeMatch[1].toUpperCase();
        const to = routeMatch[2].toUpperCase();

        const flightMatch = line.match(FLIGHT_NUMBER_REGEX) || lines[i + 1]?.match(FLIGHT_NUMBER_REGEX) || null;
        const airlineGuess = line
            .replace(routeMatch[0], '')
            .replace(FLIGHT_NUMBER_REGEX, '')
            .trim();
        const dateCandidates = [
            ...extractDateTokens(line),
            ...extractDateTokens(lines[i + 1] || ''),
            ...extractDateTokens(lines[i + 2] || ''),
        ];

        const aircraftMatch = line.match(AIRCRAFT_REGEX) || lines[i + 1]?.match(AIRCRAFT_REGEX) || null;
        const bookingClassMatch = line.match(BOOKING_CLASS_REGEX) || lines[i + 1]?.match(BOOKING_CLASS_REGEX) || null;

        segments.push({
            from,
            to,
            departureDateTime: dateCandidates[0],
            arrivalDateTime: dateCandidates[1],
            airline: airlineGuess || undefined,
            flightNumber: flightMatch ? `${flightMatch[1].toUpperCase()}${flightMatch[2]}` : undefined,
            aircraft: aircraftMatch?.[1]?.toUpperCase(),
            bookingClass: bookingClassMatch?.[1]?.toUpperCase(),
        });
    }

    if (!segments.length) {
        const allAirports = (text.match(/\b[A-Z]{3}\b/g) || []).map((value) => value.toUpperCase());
        if (allAirports.length >= 2) {
            for (let i = 0; i < allAirports.length - 1; i += 1) {
                segments.push({ from: allAirports[i], to: allAirports[i + 1] });
            }
            warnings.push('Route inferred from airport codes; review segment details.');
        }
    }

    let incompleteCount = 0;
    segments.forEach((segment, index) => {
        if (!segment.departureDateTime || !segment.arrivalDateTime) {
            incompleteCount += 1;
            warnings.push(`Segment ${index + 1} missing departure/arrival datetime.`);
        }
        if (!segment.flightNumber) {
            warnings.push(`Segment ${index + 1} missing flight number.`);
        }
    });

    const inferredCabin = normalizeCabin(text);
    const inferredPrice = parsePrice(text);
    const refundable = /\brefundable\b/i.test(text)
        ? true
        : /\bnon[-\s]?refundable\b/i.test(text)
            ? false
            : undefined;

    const confidenceBase = segments.length ? 0.55 : 0.25;
    const completenessPenalty = segments.length ? (incompleteCount / segments.length) * 0.35 : 0.3;
    const confidence = Math.max(0.2, Math.min(0.92, confidenceBase - completenessPenalty));

    if (!segments.length) {
        warnings.push('Could not reliably parse itinerary segments from text.');
    }

    return {
        segments,
        warnings,
        confidence,
        inferred: {
            price: inferredPrice.amount,
            currency: inferredPrice.currency,
            cabin: inferredCabin,
            refundable,
        },
    };
}

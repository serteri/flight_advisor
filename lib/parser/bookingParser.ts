export type ParsedBookingFields = {
    passengerName?: string;
    pnr?: string;
    airline?: string;
    flightNumber?: string;
    departureAirport?: string;
    arrivalAirport?: string;
    departureDateTime?: string;
    arrivalDateTime?: string;
};

export type MinimumTrackableField =
    | 'flightNumber'
    | 'departureAirport'
    | 'arrivalAirport'
    | 'departureDateTime';

export interface BookingParseResult {
    success: boolean;
    extracted: ParsedBookingFields;
    missingRequiredFields: MinimumTrackableField[];
    isTrackable: boolean;
}

export type BookingLikeInput =
    | string
    | {
        rawText?: string;
        subject?: string;
        body?: string;
        structured?: Record<string, unknown>;
    };

const REQUIRED_FIELDS: MinimumTrackableField[] = [
    'flightNumber',
    'departureAirport',
    'arrivalAirport',
    'departureDateTime',
];

const normalizeSpace = (value: string): string => value.replace(/\s+/g, ' ').trim();

const pickStructured = (structured?: Record<string, unknown>, keys?: string[]): string | undefined => {
    if (!structured || !keys) return undefined;

    for (const key of keys) {
        const value = structured[key];
        if (typeof value === 'string' && value.trim()) {
            return normalizeSpace(value);
        }
    }

    return undefined;
};

const toIsoOrNull = (value?: string): string | undefined => {
    if (!value) return undefined;

    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) return undefined;

    return parsed.toISOString();
};

const extractPnr = (text: string, structured?: Record<string, unknown>): string | undefined => {
    const structuredPnr = pickStructured(structured, ['pnr', 'bookingReference', 'reservationCode', 'recordLocator']);
    if (structuredPnr) return structuredPnr.toUpperCase();

    const labeled = text.match(
        /(?:\bPNR\b|BOOKING\s+REFERENCE|BOOKING\s+REF|RESERVATION\s+CODE|RECORD\s+LOCATOR|CONFIRMATION\s+CODE)\s*[:#-]?\s*([A-Z0-9]{6})\b/i,
    );
    if (labeled?.[1]) return labeled[1].toUpperCase();

    const generic = text.match(/\b([A-Z0-9]{6})\b/);
    if (generic?.[1]) return generic[1].toUpperCase();

    return undefined;
};

const extractFlightNumber = (text: string, structured?: Record<string, unknown>): string | undefined => {
    const structuredFlight = pickStructured(structured, ['flightNumber', 'flightNo', 'flight']);
    if (structuredFlight) return structuredFlight.toUpperCase().replace(/\s+/g, '');

    const labeled = text.match(/(?:\bFLIGHT\b(?:\s*NO\.?|\s*NUMBER)?)\s*[:#-]?\s*([A-Z]{2}\s?\d{1,4}[A-Z]?)\b/i);
    if (labeled?.[1]) return labeled[1].toUpperCase().replace(/\s+/g, '');

    const generic = text.match(/\b([A-Z]{2}\s?\d{1,4}[A-Z]?)\b/);
    if (generic?.[1]) return generic[1].toUpperCase().replace(/\s+/g, '');

    return undefined;
};

const extractAirline = (text: string, structured?: Record<string, unknown>): string | undefined => {
    const structuredAirline = pickStructured(structured, ['airline', 'carrier', 'airlineName']);
    if (structuredAirline) return structuredAirline;

    const labeled = text.match(/(?:\bAIRLINE\b|\bCARRIER\b)\s*[:#-]?\s*([A-Za-z0-9 .'-]{2,40})/i);
    return labeled?.[1] ? normalizeSpace(labeled[1]) : undefined;
};

const extractAirports = (text: string, structured?: Record<string, unknown>): { from?: string; to?: string } => {
    const structuredFrom = pickStructured(structured, ['departureAirport', 'origin', 'from']);
    const structuredTo = pickStructured(structured, ['arrivalAirport', 'destination', 'to']);
    if (structuredFrom || structuredTo) {
        return {
            from: structuredFrom?.toUpperCase(),
            to: structuredTo?.toUpperCase(),
        };
    }

    const labeledFrom = text.match(/(?:\bFROM\b|\bORIGIN\b|\bDEPART(?:URE)?\s*AIRPORT\b)\s*[:#-]?\s*([A-Z]{3})\b/i)?.[1];
    const labeledTo = text.match(/(?:\bTO\b|\bDESTINATION\b|\bARRIV(?:AL|E)\s*AIRPORT\b)\s*[:#-]?\s*([A-Z]{3})\b/i)?.[1];
    if (labeledFrom && labeledTo) {
        return { from: labeledFrom.toUpperCase(), to: labeledTo.toUpperCase() };
    }

    const route = text.match(/\b([A-Z]{3})\b\s*(?:→|->|TO|-)\s*\b([A-Z]{3})\b/i);
    if (route?.[1] && route?.[2]) {
        return {
            from: route[1].toUpperCase(),
            to: route[2].toUpperCase(),
        };
    }

    const bracketed = text.match(/\(([A-Z]{3})\)\s*(?:→|->|TO|-)\s*\(([A-Z]{3})\)/i);
    if (bracketed?.[1] && bracketed?.[2]) {
        return {
            from: bracketed[1].toUpperCase(),
            to: bracketed[2].toUpperCase(),
        };
    }

    return {
        from: labeledFrom?.toUpperCase(),
        to: labeledTo?.toUpperCase(),
    };
};

const parseDateCandidates = (text: string): string[] => {
    const candidates: string[] = [];

    const labelCandidates = [
        text.match(/(?:DEPART(?:URE|ING)?(?:\s*(?:DATE|TIME))?)\s*[:#-]?\s*([^\n\r]{6,48})/i)?.[1],
        text.match(/(?:ARRIV(?:AL|E)?(?:\s*(?:DATE|TIME))?)\s*[:#-]?\s*([^\n\r]{6,48})/i)?.[1],
    ].filter(Boolean) as string[];

    candidates.push(...labelCandidates.map((value) => normalizeSpace(value)));

    const isoMatches = text.match(/\b\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})?)?\b/g) || [];
    candidates.push(...isoMatches);

    const wordDateMatches = text.match(/\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}(?:\s+\d{1,2}:\d{2}(?:\s?(?:AM|PM))?)?\b/gi) || [];
    candidates.push(...wordDateMatches);

    return candidates;
};

const extractDateTimes = (text: string, structured?: Record<string, unknown>): { departureDateTime?: string; arrivalDateTime?: string } => {
    const structuredDeparture = toIsoOrNull(pickStructured(structured, ['departureDateTime', 'departureAt', 'departureTime', 'departureDate']));
    const structuredArrival = toIsoOrNull(pickStructured(structured, ['arrivalDateTime', 'arrivalAt', 'arrivalTime', 'arrivalDate']));
    if (structuredDeparture || structuredArrival) {
        return {
            departureDateTime: structuredDeparture,
            arrivalDateTime: structuredArrival,
        };
    }

    const parsed = parseDateCandidates(text)
        .map((value) => toIsoOrNull(value))
        .filter(Boolean) as string[];

    return {
        departureDateTime: parsed[0],
        arrivalDateTime: parsed[1],
    };
};

const extractPassengerName = (text: string, structured?: Record<string, unknown>): string | undefined => {
    const structuredName = pickStructured(structured, ['passengerName', 'name', 'travelerName']);
    if (structuredName) return structuredName;

    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (const line of lines) {
        const lineMatch = line.match(/(?:PASSENGER|TRAVELER|NAME)\s*[:#-]?\s*([A-Za-z][A-Za-z\s'\-]{1,60})$/i);
        if (lineMatch?.[1]) return normalizeSpace(lineMatch[1]);
    }

    const fallback = text.match(/(?:PASSENGER|TRAVELER|NAME)\s*[:#-]?\s*([A-Za-z][A-Za-z\s'\-]{2,80}?)(?:\s(?:PNR|FLIGHT|ROUTE|FROM|TO|DEPARTURE|ARRIVAL)\b|$)/i);
    return fallback?.[1] ? normalizeSpace(fallback[1]) : undefined;
};

export function parseBookingLikeInput(input: BookingLikeInput): BookingParseResult {
    const payload = typeof input === 'string' ? { rawText: input } : input;

    const mergedText = [
        payload.subject || '',
        payload.body || '',
        payload.rawText || '',
    ]
        .filter(Boolean)
        .join('\n');

    const normalizedText = normalizeSpace(mergedText);
    const structured = payload.structured;

    const airports = extractAirports(normalizedText, structured);
    const dateTimes = extractDateTimes(mergedText, structured);

    const extracted: ParsedBookingFields = {
        passengerName: extractPassengerName(mergedText, structured),
        pnr: extractPnr(normalizedText, structured),
        airline: extractAirline(normalizedText, structured),
        flightNumber: extractFlightNumber(normalizedText, structured),
        departureAirport: airports.from,
        arrivalAirport: airports.to,
        departureDateTime: dateTimes.departureDateTime,
        arrivalDateTime: dateTimes.arrivalDateTime,
    };

    const missingRequiredFields = REQUIRED_FIELDS.filter((field) => !extracted[field]);
    const isTrackable = missingRequiredFields.length === 0;
    const hasAnyExtraction = Object.values(extracted).some(Boolean);

    return {
        success: hasAnyExtraction,
        extracted,
        missingRequiredFields,
        isTrackable,
    };
}
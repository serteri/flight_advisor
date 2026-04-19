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

const toIsoOrNull = (value?: string): string | undefined => {
    if (!value) return undefined;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return parsed.toISOString();
};

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

const extractPnr = (text: string, structured?: Record<string, unknown>): string | undefined => {
    const structuredPnr = pickStructured(structured, ['pnr', 'bookingReference', 'reservationCode', 'recordLocator']);
    if (structuredPnr) return structuredPnr.toUpperCase();

    const labeled = text.match(/(?:\bPNR\b|BOOKING\s+REFERENCE|RESERVATION\s+CODE|RECORD\s+LOCATOR|CONFIRMATION\s+CODE)\s*[:#-]?\s*([A-Z0-9]{5,8})/i);
    if (labeled?.[1]) return labeled[1].toUpperCase();

    return undefined;
};

const extractAirline = (text: string, structured?: Record<string, unknown>): string | undefined => {
    const structuredAirline = pickStructured(structured, ['airline', 'carrier', 'airlineName']);
    if (structuredAirline) return structuredAirline;

    const match = text.match(/(?:\bAIRLINE\b|\bCARRIER\b)\s*[:\-]\s*([A-Za-z0-9 .'-]{2,40})/i);
    return match?.[1] ? normalizeSpace(match[1]) : undefined;
};

const extractFlightNumber = (text: string, structured?: Record<string, unknown>): string | undefined => {
    const structuredFlight = pickStructured(structured, ['flightNumber', 'flightNo', 'flight']);
    if (structuredFlight) return structuredFlight.toUpperCase().replace(/\s+/g, '');

    const labeled = text.match(/(?:\bFLIGHT\b(?:\s*NO\.?|\s*NUMBER)?)\s*[:#-]?\s*([A-Z0-9]{2,3}\s?\d{1,4})/i);
    if (labeled?.[1]) return labeled[1].toUpperCase().replace(/\s+/g, '');

    const generic = text.match(/\b([A-Z0-9]{2,3}\s?\d{1,4})\b/);
    if (generic?.[1]) return generic[1].toUpperCase().replace(/\s+/g, '');

    return undefined;
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

    const labeledFrom = text.match(/(?:\bFROM\b|\bORIGIN\b|\bDEPART(?:URE)?\b\s*(?:AIRPORT)?)\s*[:\-]\s*([A-Z]{3})\b/i)?.[1];
    const labeledTo = text.match(/(?:\bTO\b|\bDESTINATION\b|\bARRIV(?:AL|E)\b\s*(?:AIRPORT)?)\s*[:\-]\s*([A-Z]{3})\b/i)?.[1];

    if (labeledFrom && labeledTo) {
        return { from: labeledFrom.toUpperCase(), to: labeledTo.toUpperCase() };
    }

    const route = text.match(/\b([A-Z]{3})\b\s*(?:→|->|TO|-)\s*\b([A-Z]{3})\b/i);
    if (route?.[1] && route?.[2]) {
        return { from: route[1].toUpperCase(), to: route[2].toUpperCase() };
    }

    return { from: labeledFrom?.toUpperCase(), to: labeledTo?.toUpperCase() };
};

const extractDateTimes = (text: string, structured?: Record<string, unknown>): { departureDateTime?: string; arrivalDateTime?: string } => {
    const structuredDeparture = toIsoOrNull(pickStructured(structured, ['departureDateTime', 'departureAt', 'departureTime']));
    const structuredArrival = toIsoOrNull(pickStructured(structured, ['arrivalDateTime', 'arrivalAt', 'arrivalTime']));

    if (structuredDeparture || structuredArrival) {
        return {
            departureDateTime: structuredDeparture,
            arrivalDateTime: structuredArrival,
        };
    }

    const depLabelMatch = text.match(/(?:DEPART(?:URE|ING)?(?:\s*(?:TIME|DATE))?)\s*[:\-]\s*([^\n\r]{6,40})/i)?.[1];
    const arrLabelMatch = text.match(/(?:ARRIV(?:AL|E)?(?:\s*(?:TIME|DATE))?)\s*[:\-]\s*([^\n\r]{6,40})/i)?.[1];

    const departureDateTime = toIsoOrNull(depLabelMatch?.trim());
    const arrivalDateTime = toIsoOrNull(arrLabelMatch?.trim());

    if (departureDateTime || arrivalDateTime) {
        return { departureDateTime, arrivalDateTime };
    }

    const isoMatches = text.match(/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})?\b/g) || [];
    const parsed = isoMatches.map((value) => toIsoOrNull(value)).filter(Boolean) as string[];

    return {
        departureDateTime: parsed[0],
        arrivalDateTime: parsed[1],
    };
};

const extractPassengerName = (text: string, structured?: Record<string, unknown>): string | undefined => {
    const structuredName = pickStructured(structured, ['passengerName', 'name', 'travelerName']);
    if (structuredName) return structuredName;

    const match = text.match(/(?:PASSENGER|TRAVELER|NAME)\s*[:\-]\s*([A-Za-z][A-Za-z\s'\-]{2,80})/i);
    return match?.[1] ? normalizeSpace(match[1]) : undefined;
};

export function parseBookingLikeInput(input: BookingLikeInput): BookingParseResult {
    const payload = typeof input === 'string'
        ? { rawText: input }
        : input;

    const structured = payload.structured;
    const normalizedText = normalizeSpace([
        payload.subject || '',
        payload.body || '',
        payload.rawText || '',
    ].filter(Boolean).join('\n'));

    const airports = extractAirports(normalizedText, structured);
    const dateTimes = extractDateTimes(normalizedText, structured);

    const extracted: ParsedBookingFields = {
        passengerName: extractPassengerName(normalizedText, structured),
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

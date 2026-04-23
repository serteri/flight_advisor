type ParsedSegment = {
    from: string;
    to: string;
    departure?: string;
    arrival?: string;
    airline?: string;
    flightNumber?: string;
    aircraft?: string;
    tripDirection?: 'OUTBOUND' | 'INBOUND';
};

type ParsedTrip = {
    price?: number;
    currency?: string;
    cabin?: 'economy' | 'premium' | 'business' | 'first';
    checkedBaggageKg: number | null;
    cabinBaggageKg: number | null;
    adults: number;
    children: number;
    infants: number;
};

type ParsedMeta = {
    refundable?: boolean;
    checkedBaggageIncluded?: boolean;
    cabinBaggageIncluded?: boolean;
    layoversMinutes: number[];
};

export type ParsedItinerary = {
    segments: ParsedSegment[];
    trip: ParsedTrip;
    meta: ParsedMeta;
    warnings: string[];
    confidence: number;
};

const AIRLINE_NAME_TO_CODE: Record<string, string> = {
    'SINGAPORE AIRLINES': 'SQ',
    'TURKISH AIRLINES': 'TK',
    'QATAR AIRWAYS': 'QR',
    'BRITISH AIRWAYS': 'BA',
    LUFTHANSA: 'LH',
    EMIRATES: 'EK',
    'UNITED AIRLINES': 'UA',
    DELTA: 'DL',
    'AMERICAN AIRLINES': 'AA',
    'AIR FRANCE': 'AF',
    KLM: 'KL',
};

const WEEKDAY_TOKENS = new Set(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);

const ROUTE_REGEX = /\b([A-Z]{3})\b\s*(?:->|→|to|\|)\s*\b([A-Z]{3})\b/gi;
const ALT_ROUTE_REGEX = /from\s+([A-Z]{3})\s+to\s+([A-Z]{3})/gi;
const FLIGHT_NUMBER_REGEX = /\b([A-Z]{2,3})\s?-?(\d{1,4})(?!:)\b/g;
const FLIGHT_LINE_REGEX = /^\s*\|\s*([A-Z]{2,3})\s?-?(\d{1,4})\b/i;
const AIRPORT_WITH_IATA_REGEX = /([A-Za-z][A-Za-z0-9'.,\-\/\s]*?)\(([A-Z]{3})\)/;
const AIRPORT_NAME_TO_IATA: Record<string, string> = {
    'BRISBANE ARPT': 'BNE',
    'BRISBANE AIRPORT': 'BNE',
    'CHANGI INTL ARPT': 'SIN',
    'CHANGI INTL AIRPORT': 'SIN',
    'ISTANBUL AIRPORT': 'IST',
};

const ISO_DATE_TIME_REGEX = /\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?(?:Z|[+\-]\d{2}:?\d{2})?\b/gi;
const DATE_WITH_MONTH_REGEX = /\b(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+)?\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{4}\b/gi;
const DATE_SLASH_REGEX = /\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/g;
const TIME_REGEX = /\b(?:[01]?\d|2[0-3]):[0-5]\d(?:\s?(?:am|pm))?\b/gi;
const TEXTUAL_DATETIME_REGEX = /\b(?:(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+)?(\d{1,2})\s(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s(\d{4})\s(\d{1,2}):(\d{2})(?:\s?(am|pm))\b/gi;

const MONTH_INDEX: Record<string, number> = {
    JAN: 0,
    FEB: 1,
    MAR: 2,
    APR: 3,
    MAY: 4,
    JUN: 5,
    JUL: 6,
    AUG: 7,
    SEP: 8,
    OCT: 9,
    NOV: 10,
    DEC: 11,
};

const CURRENCY_SYMBOL_MAP: Record<string, string> = {
    '$': 'USD',
    '€': 'EUR',
    '£': 'GBP',
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const dedupeWarnings = (warnings: string[]): string[] => {
    return warnings.filter((warning, index) => warnings.indexOf(warning) === index);
};

const toIso = (date: Date): string => new Date(date.getTime()).toISOString();

const isWeekdayToken = (value?: string): boolean => WEEKDAY_TOKENS.has((value || '').trim().toUpperCase());

const parseNumber = (raw: string): number | undefined => {
    const cleaned = raw.replace(/\s/g, '');
    const hasDot = cleaned.includes('.');
    const hasComma = cleaned.includes(',');

    let normalized = cleaned;
    if (hasDot && hasComma) {
        if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
            normalized = cleaned.replace(/\./g, '').replace(',', '.');
        } else {
            normalized = cleaned.replace(/,/g, '');
        }
    } else if (hasComma) {
        const decimalLike = /,\d{1,2}$/.test(cleaned);
        normalized = decimalLike ? cleaned.replace(',', '.') : cleaned.replace(/,/g, '');
    }

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
    return parsed;
};

const normalizeCabin = (text: string): ParsedTrip['cabin'] | undefined => {
    const value = text.toLowerCase();
    if (value.includes('premium economy')) return 'premium';
    if (value.includes('business')) return 'business';
    if (value.includes('first')) return 'first';
    if (value.includes('economy')) return 'economy';
    return undefined;
};

const parseDateOnly = (token: string): Date | undefined => {
    const sanitizedToken = token.replace(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+/i, '').trim();

    const textualMatch = sanitizedToken.match(/^(\d{1,2})\s(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s(\d{4})$/i);
    if (textualMatch) {
        const day = Number(textualMatch[1]);
        const month = MONTH_INDEX[textualMatch[2].toUpperCase()];
        const year = Number(textualMatch[3]);
        if (month !== undefined && day >= 1 && day <= 31) {
            return new Date(Date.UTC(year, month, day));
        }
    }

    const fromMonth = Date.parse(sanitizedToken);
    if (Number.isFinite(fromMonth)) {
        const d = new Date(fromMonth);
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    }

    const slash = sanitizedToken.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
    if (!slash) return undefined;
    const first = Number(slash[1]);
    const second = Number(slash[2]);
    const yearToken = Number(slash[3]);
    const year = yearToken < 100 ? 2000 + yearToken : yearToken;
    const day = first > 12 ? first : second;
    const month = first > 12 ? second : first;

    if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
    return new Date(Date.UTC(year, month - 1, day));
};

const extractFirstDateContext = (text: string): Date | undefined => {
    const monthDate = text.match(DATE_WITH_MONTH_REGEX);
    if (monthDate && monthDate[0]) {
        const parsed = parseDateOnly(monthDate[0]);
        if (parsed) return parsed;
    }

    const slashDate = text.match(DATE_SLASH_REGEX);
    if (slashDate && slashDate[0]) {
        return parseDateOnly(slashDate[0]);
    }

    const isoDate = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (isoDate && isoDate[1]) {
        const parsed = parseDateOnly(isoDate[1]);
        if (parsed) return parsed;
    }

    return undefined;
};

const parseTimeToIso = (date: Date, hhmm: string): string | undefined => {
    const match = hhmm.trim().match(/^(\d{1,2}):(\d{2})(?:\s?(am|pm))?$/i);
    if (!match) return undefined;
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const meridiem = match[3]?.toLowerCase();
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
    if (hour > 23 || minute > 59) return undefined;
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, minute, 0)).toISOString();
};

const parseTextualDateTime = (value: string): string | undefined => {
    const match = value.trim().match(/^(?:(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+)?(\d{1,2})\s(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s(\d{4})\s(\d{1,2}):(\d{2})(?:\s?(am|pm))$/i);
    if (!match) return undefined;

    const day = Number(match[2]);
    const month = MONTH_INDEX[match[3].toUpperCase()];
    const year = Number(match[4]);
    let hour = Number(match[5]);
    const minute = Number(match[6]);
    const meridiem = match[7]?.toLowerCase();

    if (!Number.isFinite(day) || month === undefined || !Number.isFinite(year) || !Number.isFinite(hour) || !Number.isFinite(minute)) {
        return undefined;
    }

    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;

    return new Date(Date.UTC(year, month, day, hour, minute, 0)).toISOString();
};

const parseDateTimesFromContext = (context: string, fallbackDate?: Date): { departure?: string; arrival?: string } => {
    const explicitDateTimes: string[] = [];
    const seen = new Set<string>();
    const dtMatches = context.match(ISO_DATE_TIME_REGEX) || [];
    for (const value of dtMatches) {
        const parsed = Date.parse(value.replace(' ', 'T'));
        if (Number.isFinite(parsed)) {
            const iso = new Date(parsed).toISOString();
            if (!seen.has(iso)) {
                explicitDateTimes.push(iso);
                seen.add(iso);
            }
        }
    }
    if (explicitDateTimes.length >= 2) {
        return { departure: explicitDateTimes[0], arrival: explicitDateTimes[1] };
    }

    const textualMatches = Array.from(context.matchAll(TEXTUAL_DATETIME_REGEX));
    for (const match of textualMatches) {
        const token = match[0];
        const iso = parseTextualDateTime(token);
        if (iso && !seen.has(iso)) {
            explicitDateTimes.push(iso);
            seen.add(iso);
        }
    }
    if (explicitDateTimes.length >= 2) {
        return { departure: explicitDateTimes[0], arrival: explicitDateTimes[1] };
    }
    if (explicitDateTimes.length === 1) {
        return { departure: explicitDateTimes[0] };
    }

    const localDate = extractFirstDateContext(context) || fallbackDate;
    const timeMatches = context.match(TIME_REGEX) || [];
    if (!localDate || timeMatches.length === 0) {
        return { departure: explicitDateTimes[0] };
    }

    const firstTime = timeMatches[0];
    if (!firstTime) {
        return { departure: explicitDateTimes[0] };
    }

    const departure = parseTimeToIso(localDate, firstTime);
    let arrival = timeMatches[1] ? parseTimeToIso(localDate, timeMatches[1]) : undefined;

    if (departure && arrival && Date.parse(arrival) <= Date.parse(departure)) {
        const nextDay = new Date(Date.parse(arrival) + 24 * 60 * 60 * 1000);
        arrival = toIso(nextDay);
    }

    return { departure, arrival };
};

const extractPrice = (text: string): { price?: number; currency?: string } => {
    const upper = text.toUpperCase();

    const codeAmountPatterns = [
        /\b(USD|EUR|GBP|TRY|AUD|CAD|JPY)\s*([0-9][0-9.,]{1,12})\b/i,
        /\bTOTAL\s*[:\-]?\s*(USD|EUR|GBP|TRY|AUD|CAD|JPY)?\s*([0-9][0-9.,]{1,12})\b/i,
    ];
    for (const pattern of codeAmountPatterns) {
        const match = upper.match(pattern);
        if (match) {
            const amountToken = match[2];
            const amount = parseNumber(amountToken);
            if (amount) {
                return {
                    price: amount,
                    currency: (match[1] || 'USD').toUpperCase(),
                };
            }
        }
    }

    const symbolMatch = text.match(/([\$€£])\s*([0-9][0-9.,]{1,12})/);
    if (symbolMatch) {
        const amount = parseNumber(symbolMatch[2]);
        if (amount) {
            return {
                price: amount,
                currency: CURRENCY_SYMBOL_MAP[symbolMatch[1]],
            };
        }
    }

    return {};
};

const extractBaggage = (text: string): {
    checkedBaggageKg: number | null;
    cabinBaggageKg: number | null;
    checkedBaggageIncluded?: boolean;
    cabinBaggageIncluded?: boolean;
} => {
    const checkedMatch = text.match(/(?:checked|check-in)\s*(?:baggage|bag|allowance)?[^\n\r]{0,30}?(\d{1,2})\s?kg/i)
        || text.match(/(\d{1,2})\s?kg[^\n\r]{0,20}?(?:checked|check-in)/i);
    const cabinMatch = text.match(/(?:cabin|carry[-\s]?on|hand\s*baggage)[^\n\r]{0,30}?(\d{1,2})\s?kg/i)
        || text.match(/(\d{1,2})\s?kg[^\n\r]{0,25}?(?:cabin|carry[-\s]?on|hand\s*baggage)/i);
    const repeatedBaggageMatches = Array.from(text.matchAll(/Baggage:\s*(\d{1,2})\s*K\b/gi))
        .map((match) => Number(match[1]))
        .filter((value) => Number.isFinite(value) && value > 0);

    const checkedBaggageKg = checkedMatch
        ? Number(checkedMatch[1])
        : (repeatedBaggageMatches.length ? Math.max(...repeatedBaggageMatches) : null);
    const cabinBaggageKg = cabinMatch ? Number(cabinMatch[1]) : null;

    const checkedIncluded = /(?:checked|check-in)[^\n\r]{0,20}included|included[^\n\r]{0,20}(?:checked|check-in)/i.test(text)
        || /\b\d+\s*(?:pc|piece|pieces)\b/i.test(text);
    const cabinIncluded = /(?:cabin|carry[-\s]?on|hand\s*baggage)[^\n\r]{0,20}included|included[^\n\r]{0,20}(?:cabin|carry[-\s]?on|hand\s*baggage)/i.test(text);

    return {
        checkedBaggageKg,
        cabinBaggageKg,
        checkedBaggageIncluded: checkedBaggageKg !== null ? true : checkedIncluded || undefined,
        cabinBaggageIncluded: cabinBaggageKg !== null ? true : cabinIncluded || undefined,
    };
};

const extractPassengerCounts = (text: string): { adults: number; children: number; infants: number } => {
    const countFrom = (pattern: RegExp): number => {
        const match = text.match(pattern);
        return match ? Number(match[1]) : 0;
    };

    const adults = countFrom(/\b(\d+)\s*(?:adult|adults|adt)\b/i) || 1;
    const children = countFrom(/\b(\d+)\s*(?:child|children|chd)\b/i);
    const infants = countFrom(/\b(\d+)\s*(?:infant|infants|inf)\b/i);

    return { adults, children, infants };
};

const normalizeAirline = (context: string, flightCode?: string): string | undefined => {
    const normalized = context.toUpperCase();
    for (const [name, code] of Object.entries(AIRLINE_NAME_TO_CODE)) {
        if (normalized.includes(name)) return code;
    }
    if (flightCode && /^[A-Z]{2,3}$/.test(flightCode) && !isWeekdayToken(flightCode)) return flightCode;
    return undefined;
};

const normalizeDirection = (line: string): 'OUTBOUND' | 'INBOUND' | undefined => {
    const normalized = line.trim().toUpperCase();
    if (normalized.includes('OUTBOUND FLIGHT')) return 'OUTBOUND';
    if (normalized.includes('INBOUND FLIGHT')) return 'INBOUND';
    return undefined;
};

const extractLabeledText = (lines: string[], start: number, end: number, label: string): string | undefined => {
    const normalizedLabel = label.toUpperCase();

    for (let i = start; i <= end; i += 1) {
        const line = lines[i];
        const upper = line.toUpperCase();
        if (!upper.startsWith(normalizedLabel)) continue;

        const inline = line.slice(label.length).trim();
        if (inline) {
            return inline.replace(/^[:\-]\s*/, '').trim();
        }

        for (let j = i + 1; j <= Math.min(end, i + 2); j += 1) {
            const candidate = lines[j]?.trim();
            if (!candidate) continue;
            if (/^[A-Za-z ]+:$/.test(candidate)) break;
            return candidate;
        }
    }

    return undefined;
};

const extractLabeledDateTime = (lines: string[], start: number, end: number, label: string, fallbackDate?: Date): string | undefined => {
    const normalizedLabel = label.toUpperCase();

    for (let i = start; i <= end; i += 1) {
        const upper = lines[i].toUpperCase();
        if (!upper.startsWith(normalizedLabel)) continue;

        const raw = extractLabeledText(lines, i, Math.min(end, i + 2), label);
        const contextLines: string[] = [];
        for (let j = i + 1; j <= Math.min(end, i + 6); j += 1) {
            const candidate = lines[j]?.trim();
            if (!candidate) continue;
            contextLines.push(candidate);
        }

        const richContext = [raw || '', ...contextLines].join(' ').trim();
        if (!richContext) return undefined;

        const parsedExplicit = parseDateTimesFromContext(richContext);
        if (parsedExplicit.departure) {
            return parsedExplicit.departure;
        }

        const nearestDate = findNearestExplicitDate(lines, i, fallbackDate);
        const parsed = parseDateTimesFromContext(richContext, nearestDate || fallbackDate);
        return parsed.departure;
    }

    return undefined;
};

const extractRouteCodesFromLine = (line: string): { from: string; to: string } | undefined => {
    const routeCodes = Array.from(line.matchAll(/\(([A-Z]{3})\)/g)).map((match) => match[1].toUpperCase());
    if (routeCodes.length >= 2) {
        return {
            from: routeCodes[0],
            to: routeCodes[1],
        };
    }

    const directRoute = line.match(/\b([A-Z]{3})\b\s*(?:->|→|to|\|)\s*\b([A-Z]{3})\b/i);
    if (directRoute) {
        return {
            from: directRoute[1].toUpperCase(),
            to: directRoute[2].toUpperCase(),
        };
    }

    return undefined;
};

const findRouteNearFlightLine = (lines: string[], flightLineIndex: number): { from: string; to: string; index: number } | undefined => {
    for (let distance = 1; distance <= 3; distance += 1) {
        const candidateIndex = flightLineIndex - distance;
        if (candidateIndex < 0) break;
        const route = extractRouteCodesFromLine(lines[candidateIndex]);
        if (route) {
            return {
                ...route,
                index: candidateIndex,
            };
        }
    }

    return undefined;
};

const findNearestExplicitDate = (lines: string[], centerIndex: number, fallbackDate?: Date): Date | undefined => {
    for (let distance = 0; distance <= 6; distance += 1) {
        const beforeIndex = centerIndex - distance;
        if (beforeIndex >= 0) {
            const parsedBefore = extractFirstDateContext(lines[beforeIndex]);
            if (parsedBefore) return parsedBefore;
        }
    }

    if (fallbackDate) {
        return fallbackDate;
    }

    for (let distance = 1; distance <= 6; distance += 1) {
        const afterIndex = centerIndex + distance;
        if (afterIndex < lines.length) {
            const parsedAfter = extractFirstDateContext(lines[afterIndex]);
            if (parsedAfter) return parsedAfter;
        }
    }

    return fallbackDate;
};

const findNearestAirportBefore = (lines: string[], fromIndex: number) => {
    for (let i = fromIndex; i >= 0; i -= 1) {
        const match = lines[i].match(AIRPORT_WITH_IATA_REGEX);
        if (match) {
            return { index: i, code: match[2].toUpperCase(), name: match[1].trim() };
        }
    }
    return null;
};

const findNearestAirportAfter = (lines: string[], fromIndex: number) => {
    for (let i = fromIndex; i < lines.length; i += 1) {
        const match = lines[i].match(AIRPORT_WITH_IATA_REGEX);
        if (match) {
            return { index: i, code: match[2].toUpperCase(), name: match[1].trim() };
        }
    }
    return null;
};

const inferAirportCodeFromText = (value?: string): string | undefined => {
    if (!value) return undefined;
    const iataMatch = value.match(/\(([A-Z]{3})\)/);
    if (iataMatch?.[1]) return iataMatch[1].toUpperCase();

    const normalized = value.toUpperCase();
    for (const [name, code] of Object.entries(AIRPORT_NAME_TO_IATA)) {
        if (normalized.includes(name)) return code;
    }
    return undefined;
};

const extractLeadingConfirmationSegment = (lines: string[], firstFlightIndex: number, fallbackDate?: Date): ParsedSegment | undefined => {
    if (firstFlightIndex <= 0) return undefined;
    const prefaceLines = lines.slice(0, firstFlightIndex);
    const prefaceText = prefaceLines.join(' ');
    if (!/Depart:/i.test(prefaceText) || !/Arrive:/i.test(prefaceText)) {
        return undefined;
    }

    const sectionDate = extractFirstDateContext(prefaceText) || fallbackDate;
    const departure = extractLabeledDateTime(prefaceLines, 0, prefaceLines.length - 1, 'Depart:', sectionDate);
    let arrival = extractLabeledDateTime(prefaceLines, 0, prefaceLines.length - 1, 'Arrive:', sectionDate);
    const departureAirportText = extractLabeledText(prefaceLines, 0, prefaceLines.length - 1, 'Depart:');
    const arrivalAirportText = extractLabeledText(prefaceLines, 0, prefaceLines.length - 1, 'Arrive:');
    const from = inferAirportCodeFromText(departureAirportText);
    const to = inferAirportCodeFromText(arrivalAirportText);
    const aircraft = extractLabeledText(prefaceLines, 0, prefaceLines.length - 1, 'Aircraft:');
    const airline = normalizeAirline(prefaceText);

    if (!from || !to) return undefined;

    if (departure && arrival && Date.parse(arrival) <= Date.parse(departure)) {
        arrival = new Date(Date.parse(arrival) + 24 * 60 * 60 * 1000).toISOString();
    }

    return {
        from,
        to,
        departure,
        arrival,
        airline,
        flightNumber: undefined,
        aircraft: aircraft || undefined,
        tripDirection: 'OUTBOUND',
    };
};

const extractConfirmationSegments = (lines: string[], fallbackDate?: Date): ParsedSegment[] => {
    const segments: ParsedSegment[] = [];
    const seen = new Set<string>();
    let currentDirection: 'OUTBOUND' | 'INBOUND' | undefined;
    let currentSectionDate: Date | undefined = fallbackDate;
    let firstFlightLineIndex = -1;

    for (let cursor = 0; cursor < lines.length; cursor += 1) {
        if (FLIGHT_LINE_REGEX.test(lines[cursor])) {
            firstFlightLineIndex = cursor;
            break;
        }
    }

    const leadingSegment = extractLeadingConfirmationSegment(lines, firstFlightLineIndex, fallbackDate);
    if (leadingSegment) {
        const leadingKey = [
            leadingSegment.from,
            leadingSegment.to,
            leadingSegment.departure || '',
            leadingSegment.arrival || '',
            leadingSegment.flightNumber || '',
            leadingSegment.tripDirection || '',
        ].join('|');
        seen.add(leadingKey);
        segments.push(leadingSegment);
    }

    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        const explicitLineDate = extractFirstDateContext(line);
        if (explicitLineDate) {
            currentSectionDate = explicitLineDate;
        }

        const detectedDirection = normalizeDirection(line);
        if (detectedDirection) {
            currentDirection = detectedDirection;
            currentSectionDate = extractFirstDateContext(line) || currentSectionDate;
            continue;
        }

        const flightMatch = line.match(FLIGHT_LINE_REGEX);
        if (!flightMatch) continue;

        let nextFlightIndex = -1;
        for (let cursor = i + 1; cursor < lines.length; cursor += 1) {
            if (FLIGHT_LINE_REGEX.test(lines[cursor])) {
                nextFlightIndex = cursor;
                break;
            }
        }

        const routeNearFlight = findRouteNearFlightLine(lines, i);
        const blockEnd = nextFlightIndex >= 0 ? nextFlightIndex - 1 : lines.length - 1;

        let fromCode: string | undefined;
        let toCode: string | undefined;
        let blockStart = routeNearFlight?.index ?? i;

        const previousAirport = findNearestAirportBefore(lines, i - 1);
        const nextAirport = findNearestAirportAfter(lines, i + 1);
        if (routeNearFlight) {
            fromCode = routeNearFlight.from;
            toCode = routeNearFlight.to;
        } else if (previousAirport && nextAirport) {
            fromCode = previousAirport.code;
            toCode = nextAirport.code;
            blockStart = previousAirport.index;
        } else {
            continue;
        }

        const direction = currentDirection;

        const blockLines = lines.slice(blockStart, blockEnd + 1);
        const blockText = blockLines.join(' ');
        const blockDate = findNearestExplicitDate(lines, i, extractFirstDateContext(blockText) || currentSectionDate || fallbackDate);
        const departure = extractLabeledDateTime(blockLines, 0, blockLines.length - 1, 'Depart:', blockDate);
        let arrival = extractLabeledDateTime(blockLines, 0, blockLines.length - 1, 'Arrive:', blockDate);
        const aircraft = extractLabeledText(blockLines, 0, blockLines.length - 1, 'Aircraft:');

        if (departure && arrival && Date.parse(arrival) <= Date.parse(departure)) {
            arrival = new Date(Date.parse(arrival) + 24 * 60 * 60 * 1000).toISOString();
        }
        const flightCode = flightMatch[1].toUpperCase();
        const flightNumber = `${flightCode}${flightMatch[2]}`;
        const airline = normalizeAirline(blockText, flightCode) || flightCode;

        const dedupeKey = [
            fromCode,
            toCode,
            departure || '',
            arrival || '',
            flightNumber,
            direction || '',
        ].join('|');

        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        segments.push({
            from: fromCode,
            to: toCode,
            departure,
            arrival,
            airline,
            flightNumber,
            aircraft: aircraft || undefined,
            tripDirection: direction,
        });
    }

    return segments;
};

const extractSegments = (text: string, fallbackDate?: Date): ParsedSegment[] => {
    const segments: ParsedSegment[] = [];
    const seenKeys = new Set<string>();
    const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    const parseLine = (line: string, lineIndex: number, regex: RegExp) => {
        regex.lastIndex = 0;
        let match = regex.exec(line);
        while (match) {
            const from = match[1].toUpperCase();
            const to = match[2].toUpperCase();
            const matchStart = typeof match.index === 'number' ? match.index : 0;
            const key = `${lineIndex}|${matchStart}|${from}|${to}`;
            if (seenKeys.has(key)) {
                match = regex.exec(line);
                continue;
            }
            seenKeys.add(key);

            const context = [lines[lineIndex - 1] || '', line, lines[lineIndex + 1] || '', lines[lineIndex + 2] || ''].join(' ').trim();
            const flightFromLine = FLIGHT_NUMBER_REGEX.exec(line);
            FLIGHT_NUMBER_REGEX.lastIndex = 0;
            const flightFromContext = flightFromLine ? null : FLIGHT_NUMBER_REGEX.exec(context);
            FLIGHT_NUMBER_REGEX.lastIndex = 0;
            const flight = flightFromLine || flightFromContext;

            const flightCode = flight?.[1]?.toUpperCase();
            const validFlightCode = flightCode && !isWeekdayToken(flightCode) ? flightCode : undefined;
            const flightNumber = flight && validFlightCode ? `${validFlightCode}${flight[2]}` : undefined;
            const airline = normalizeAirline(context, validFlightCode);
            const lineDate = extractFirstDateContext(line) || fallbackDate;
            const dateTimesFromLine = parseDateTimesFromContext(line, lineDate);
            const dateTimesFromContext = (!dateTimesFromLine.departure || !dateTimesFromLine.arrival)
                ? parseDateTimesFromContext(context, fallbackDate)
                : undefined;
            const departure = dateTimesFromLine.departure || dateTimesFromContext?.departure;
            const arrival = dateTimesFromLine.arrival || dateTimesFromContext?.arrival;

            segments.push({
                from,
                to,
                departure,
                arrival,
                airline,
                flightNumber,
            });

            match = regex.exec(line);
        }
    };

    for (let i = 0; i < lines.length; i += 1) {
        parseLine(lines[i], i, ROUTE_REGEX);
        parseLine(lines[i], i, ALT_ROUTE_REGEX);
    }

    for (const segment of extractConfirmationSegments(lines, fallbackDate)) {
        segments.push(segment);
    }

    const deduped: ParsedSegment[] = [];
    const dedupeSet = new Set<string>();
    for (const segment of segments) {
        const dedupeKey = [
            segment.from,
            segment.to,
            segment.departure || '',
            segment.arrival || '',
            segment.flightNumber || '',
            segment.tripDirection || '',
        ].join('|');
        if (!dedupeSet.has(dedupeKey)) {
            dedupeSet.add(dedupeKey);
            deduped.push(segment);
        }
    }

    return deduped;
};

const normalizeFlattenedConfirmationText = (text: string): string => {
    return text
        .replace(/\s+(Outbound Flight:|Inbound Flight:|Depart:|Arrive:|Status:|Cabin Class:|Aircraft:|Baggage:|Stopover of|Terminal:)/gi, '\n$1')
        .replace(/\s+\|\s*([A-Z]{2,3})\s?-?(\d{1,4})\b/gi, '\n| $1$2')
        .replace(/\|\s*([A-Z]{2,3}\d{1,4})\s+(Depart:|Arrive:|Status:|Cabin Class:|Aircraft:|Baggage:|Inbound Flight:|Outbound Flight:)/gi, '| $1\n$2')
        .replace(/\s{2,}/g, ' ')
        .trim();
};

const computeLayovers = (segments: ParsedSegment[], warnings: string[]): number[] => {
    const layovers: number[] = [];
    for (let i = 0; i < segments.length - 1; i += 1) {
        const current = segments[i];
        const next = segments[i + 1];
        if (current.tripDirection && next.tripDirection && current.tripDirection !== next.tripDirection) {
            continue;
        }
        if (!current.arrival || !next.departure) continue;
        const diff = Math.round((Date.parse(next.departure) - Date.parse(current.arrival)) / 60_000);
        layovers.push(diff);
        if (diff < 0) {
            warnings.push(`Segment ${i + 1}-${i + 2} has negative layover; check chronology.`);
        } else if (diff > 24 * 60) {
            warnings.push(`Segment ${i + 1}-${i + 2} has unrealistic layover (${diff} min).`);
        }
    }
    return layovers;
};

const validateSegments = (segments: ParsedSegment[], warnings: string[]): { incompleteCount: number } => {
    let incompleteCount = 0;

    for (let i = 0; i < segments.length; i += 1) {
        const segment = segments[i];
        if (!segment.departure || !segment.arrival) {
            incompleteCount += 1;
            warnings.push(`Segment ${i + 1} missing segment times.`);
        }
        if (!segment.flightNumber) {
            warnings.push(`Segment ${i + 1} missing flight number.`);
        }

        if (segment.departure && segment.arrival) {
            const duration = Math.round((Date.parse(segment.arrival) - Date.parse(segment.departure)) / 60_000);
            if (duration < 25 || duration > 24 * 60) {
                warnings.push(`Segment ${i + 1} has unrealistic duration (${duration} min).`);
            }
        }

        if (i < segments.length - 1) {
            const next = segments[i + 1];
            if (segment.tripDirection && next.tripDirection && segment.tripDirection !== next.tripDirection) {
                continue;
            }
            if (segment.to !== next.from) {
                warnings.push(`Route mismatch between segment ${i + 1} and ${i + 2}: ${segment.to} != ${next.from}.`);
            }
        }
    }

    return { incompleteCount };
};

export function parseItineraryText(rawText: string): ParsedItinerary {
    const text = rawText
        .replace(/\u2013|\u2014/g, '-')
        .replace(/\u2192/g, '->')
        .replace(/\t/g, ' ')
        .trim();

    const normalizedForSegmentation = normalizeFlattenedConfirmationText(text);

    const warnings: string[] = [];
    const baseDate = extractFirstDateContext(text);
    const segments = extractSegments(normalizedForSegmentation, baseDate);

    if (!segments.length) {
        warnings.push('Could not parse any route segment. Paste text with explicit route (e.g., SYD -> SIN).');
    }

    const { incompleteCount } = validateSegments(segments, warnings);
    const layoversMinutes = computeLayovers(segments, warnings);

    const priceData = extractPrice(text);
    const baggage = extractBaggage(text);
    const passengers = extractPassengerCounts(text);
    const cabin = normalizeCabin(text);
    const refundable = /\bnon[-\s]?refundable\b/i.test(text)
        ? false
        : /\brefundable\b/i.test(text)
            ? true
            : undefined;

    if (baggage.checkedBaggageKg === null && baggage.cabinBaggageKg === null
        && !baggage.checkedBaggageIncluded && !baggage.cabinBaggageIncluded) {
        warnings.push('Missing baggage info.');
    }

    if (!priceData.price) {
        warnings.push('Price not detected from pasted text.');
    }

    const warningCount = dedupeWarnings(warnings).length;
    const confidence = clamp(
        0.35 + Math.min(segments.length, 4) * 0.12 - (segments.length ? (incompleteCount / segments.length) * 0.22 : 0.3) - warningCount * 0.03,
        0.2,
        0.95,
    );

    return {
        segments,
        trip: {
            price: priceData.price,
            currency: priceData.currency,
            cabin,
            checkedBaggageKg: baggage.checkedBaggageKg,
            cabinBaggageKg: baggage.cabinBaggageKg,
            adults: passengers.adults,
            children: passengers.children,
            infants: passengers.infants,
        },
        meta: {
            refundable,
            checkedBaggageIncluded: baggage.checkedBaggageIncluded,
            cabinBaggageIncluded: baggage.cabinBaggageIncluded,
            layoversMinutes,
        },
        warnings: dedupeWarnings(warnings),
        confidence,
    };
}

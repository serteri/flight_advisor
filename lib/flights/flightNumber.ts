// lib/flights/flightNumber.ts
//
// Single flight-number rule shared by the homepage form, the track API and
// the flight-data service.
//
// Format: 2-character IATA airline designator + 1–4 digits + optional
// operational suffix letter, e.g. "TK1999", "U21234", "W61", "3K521", "BA2490A".
// IATA designators may mix letters and digits (U2, W6, 3K, 9W) but a
// designator made only of digits ("12") is not a valid airline code.

export const FLIGHT_NUMBER_REGEX = /^[A-Z0-9]{2}\d{1,4}[A-Z]?$/;

export interface ParsedFlightNumber {
    airlineCode: string; // "U2"
    number: string;      // "1234" or "2490A"
    full: string;        // "U21234"
}

// Uppercases and removes all whitespace ("u2 1234" -> "U21234").
export function normalizeFlightNumber(input: string): string {
    return String(input ?? '').replace(/\s+/g, '').toUpperCase();
}

export function parseFlightNumber(input: string): ParsedFlightNumber | null {
    const full = normalizeFlightNumber(input);
    if (!FLIGHT_NUMBER_REGEX.test(full)) {
        return null;
    }

    const airlineCode = full.slice(0, 2);
    if (!/[A-Z]/.test(airlineCode)) {
        return null;
    }

    return { airlineCode, number: full.slice(2), full };
}

export function isValidFlightNumber(input: string): boolean {
    return parseFlightNumber(input) !== null;
}

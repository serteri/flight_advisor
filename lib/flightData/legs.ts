// lib/flightData/legs.ts
//
// Flight "legs" for the form's "find my flight" step. One flight number on one
// day can be several segments (IST→FRA, FRA→JFK under the same number), and
// AeroDataBox also repeats a leg once per codeshare. This turns the raw
// payload into one option per physical leg, with airport-LOCAL wall-clock times
// for display and UTC instants for storage.

import type { AdbAirport, AdbFlight, AdbTime } from '@/lib/flightData/aerodatabox';

export interface LegAirport {
    iata: string | null;
    name: string | null;
    city: string | null;
    timeZone: string | null;
}

export interface FlightLegOption {
    key: string;                      // stable id: ORIGIN-DEST-departureUtc
    origin: LegAirport;
    destination: LegAirport;
    departureLocal: string | null;    // 'YYYY-MM-DDTHH:mm', wall clock at the departure airport
    arrivalLocal: string | null;      // wall clock at the arrival airport
    departureUtc: string | null;      // ISO
    arrivalUtc: string | null;
    airlineCode: string | null;       // provider's IATA airline code
    airlineName: string | null;       // provider's name (display falls back to the local list first)
}

const LOCAL_RE = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/;

const utcIso = (time?: AdbTime): string | null => {
    const raw = time?.utc || time?.local;
    if (!raw) return null;
    const ms = Date.parse(raw.trim().replace(' ', 'T'));
    return Number.isNaN(ms) ? null : new Date(ms).toISOString();
};

/**
 * Airport-local wall clock ('YYYY-MM-DDTHH:mm'). AeroDataBox's `local` string is
 * already local to the airport — its digits are used as they are. Without it, the
 * UTC instant is converted with the airport's IANA time zone.
 */
export function localWallClock(time: AdbTime | undefined, timeZone?: string | null): string | null {
    const m = time?.local?.match(LOCAL_RE);
    if (m) return `${m[1]}T${m[2]}:${m[3]}`;

    const utc = utcIso(time);
    if (!utc || !timeZone) return null;
    try {
        const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
        }).formatToParts(new Date(utc));
        const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
        return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
    } catch {
        return null; // unknown time zone name
    }
}

const airportOf = (a?: AdbAirport): LegAirport => ({
    iata: a?.iata ? a.iata.toUpperCase() : null,
    name: a?.shortName?.trim() || a?.name?.trim() || null,
    city: a?.municipalityName?.trim() || null,
    timeZone: a?.timeZone ?? null,
});

const isLeg = (value: unknown): value is AdbFlight =>
    Boolean(value && typeof value === 'object' && ((value as AdbFlight).departure || (value as AdbFlight).arrival));

export function legKey(origin: string | null, destination: string | null, departureUtc: string | null): string {
    return `${origin ?? '???'}-${destination ?? '???'}-${departureUtc ?? 'na'}`;
}

/** One option per physical leg, ordered by departure time. Never throws. */
export function parseLegs(payload: unknown): FlightLegOption[] {
    const raw = (Array.isArray(payload) ? payload : [payload]).filter(isLeg);
    const byKey = new Map<string, { option: FlightLegOption; operator: boolean }>();

    for (const flight of raw) {
        const dep = flight.departure;
        const arr = flight.arrival;
        const origin = airportOf(dep?.airport);
        const destination = airportOf(arr?.airport);
        const departureUtc = utcIso(dep?.scheduledTime);
        const option: FlightLegOption = {
            key: legKey(origin.iata, destination.iata, departureUtc),
            origin,
            destination,
            departureLocal: localWallClock(dep?.scheduledTime, origin.timeZone),
            arrivalLocal: localWallClock(arr?.scheduledTime, destination.timeZone),
            departureUtc,
            arrivalUtc: utcIso(arr?.scheduledTime),
            airlineCode: flight.airline?.iata ? flight.airline.iata.toUpperCase() : null,
            airlineName: flight.airline?.name?.trim() || null,
        };
        const operator = flight.codeshareStatus === 'IsOperator';
        const existing = byKey.get(option.key);
        // A codeshare repeats the same physical leg; keep the operating carrier's row.
        if (!existing || (operator && !existing.operator)) byKey.set(option.key, { option, operator });
    }

    return [...byKey.values()]
        .map((v) => v.option)
        .sort((a, b) => (a.departureUtc ?? '').localeCompare(b.departureUtc ?? ''));
}

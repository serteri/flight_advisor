// lib/flightData/aerodatabox.ts
//
// AeroDataBox (RapidAPI) response types and a pure parser that turns the raw
// `/flights/number/{number}/{date}` payload into a provider-independent
// NormalizedFlight. The network client lives in ./client.ts; scenario mocks in
// ./mock.ts. Keeping parsing pure lets the fixtures drive unit tests.

// ── Raw AeroDataBox schema (subset we rely on) ──────────────────────────────

export interface AdbTime {
    utc?: string;   // "2026-01-15 08:00Z"
    local?: string; // "2026-01-15 09:00+01:00"
}

export interface AdbAirport {
    icao?: string;
    iata?: string;
    name?: string;
    countryCode?: string;
    timeZone?: string;
    location?: { lat: number; lon: number };
}

export interface AdbMovement {
    airport?: AdbAirport;
    scheduledTime?: AdbTime;
    revisedTime?: AdbTime;
    predictedTime?: AdbTime;
    runwayTime?: AdbTime;
    terminal?: string;
    gate?: string;
    quality?: string[];
}

export interface AdbFlight {
    greatCircleDistance?: { km?: number };
    departure?: AdbMovement;
    arrival?: AdbMovement;
    number?: string;
    status?: string;
    codeshareStatus?: string;
    aircraft?: { reg?: string; model?: string };
    airline?: { name?: string; iata?: string; icao?: string };
    lastUpdatedUtc?: string;
}

// ── Normalized shape used by the app ────────────────────────────────────────

export type NormalizedFlightStatus = 'scheduled' | 'active' | 'landed' | 'cancelled' | 'diverted' | 'unknown';

export interface NormalizedAirport {
    iata: string | null;
    countryCode: string | null;
    lat: number | null;
    lon: number | null;
}

export interface NormalizedFlight {
    flightNumber: string;
    date: string; // requested local flight date (YYYY-MM-DD)
    status: NormalizedFlightStatus;
    rawStatus: string;
    airlineIata: string | null;
    origin: NormalizedAirport;
    destination: NormalizedAirport;
    routeKnown: boolean;
    scheduledDepartureUtc: string | null;
    revisedDepartureUtc: string | null;
    runwayDepartureUtc: string | null;
    scheduledArrivalUtc: string | null;
    // AeroDataBox exposes no explicit gate-in (on-block) time. For arrived
    // flights `revisedTime` is the reported actual arrival; runwayTime is touchdown.
    revisedArrivalUtc: string | null;
    predictedArrivalUtc: string | null;
    runwayArrivalUtc: string | null;
    departureGate: string | null;
    arrivalGate: string | null;
    departureTerminal: string | null;
    arrivalTerminal: string | null;
    aircraftModel: string | null;
    greatCircleDistanceKm: number | null;
    source: 'LIVE' | 'MOCK';
}

// "2026-01-15 08:00Z" / "2026-01-15 09:00+01:00" -> ISO string (UTC), or null.
export function parseAdbTime(time?: AdbTime): string | null {
    const raw = time?.utc || time?.local;
    if (!raw) return null;
    const isoLike = raw.trim().replace(' ', 'T');
    const ms = Date.parse(isoLike);
    return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

export function mapAdbStatus(rawStatus?: string): NormalizedFlightStatus {
    const s = String(rawStatus || '').toLowerCase().trim();
    if (!s) return 'unknown';
    // "Canceled", "CanceledUncertain", "Cancelled"
    if (s.includes('cancel')) return 'cancelled';
    if (s.includes('divert')) return 'diverted';
    if (s.includes('arrived') || s.includes('landed')) return 'landed';
    if (s.includes('departed') || s.includes('enroute') || s.includes('en-route') || s.includes('approaching')) return 'active';
    if (
        s.includes('expected') || s.includes('scheduled') || s.includes('delayed') ||
        s.includes('checkin') || s.includes('boarding') || s.includes('gateclosed')
    ) return 'scheduled';
    return 'unknown';
}

const normalizeAirport = (airport?: AdbAirport): NormalizedAirport => ({
    iata: airport?.iata ? airport.iata.toUpperCase() : null,
    countryCode: airport?.countryCode ? airport.countryCode.toUpperCase() : null,
    lat: typeof airport?.location?.lat === 'number' ? airport.location.lat : null,
    lon: typeof airport?.location?.lon === 'number' ? airport.location.lon : null,
});

// Picks the operating flight when AeroDataBox returns several legs/codeshares.
function pickFlight(flights: AdbFlight[]): AdbFlight | null {
    if (flights.length === 0) return null;
    return flights.find((f) => f.codeshareStatus === 'IsOperator') ?? flights[0];
}

// A real leg always carries departure and/or arrival. Error bodies such as
// {"message":"..."}, {} or null (200/204 with odd payloads) are not flights.
function isFlightLike(value: unknown): value is AdbFlight {
    if (!value || typeof value !== 'object') return false;
    const f = value as AdbFlight;
    return Boolean(f.departure || f.arrival);
}

export function parseAeroDataBoxResponse(
    payload: unknown,
    flightNumber: string,
    date: string,
    source: 'LIVE' | 'MOCK',
): NormalizedFlight | null {
    const list = (Array.isArray(payload) ? payload : [payload]).filter(isFlightLike);
    const flight = pickFlight(list);
    if (!flight) return null;

    const origin = normalizeAirport(flight.departure?.airport);
    const destination = normalizeAirport(flight.arrival?.airport);

    return {
        flightNumber,
        date,
        status: mapAdbStatus(flight.status),
        rawStatus: flight.status || 'Unknown',
        airlineIata: flight.airline?.iata?.toUpperCase() || null,
        origin,
        destination,
        routeKnown: Boolean(origin.iata && destination.iata),
        scheduledDepartureUtc: parseAdbTime(flight.departure?.scheduledTime),
        revisedDepartureUtc: parseAdbTime(flight.departure?.revisedTime),
        runwayDepartureUtc: parseAdbTime(flight.departure?.runwayTime),
        scheduledArrivalUtc: parseAdbTime(flight.arrival?.scheduledTime),
        revisedArrivalUtc: parseAdbTime(flight.arrival?.revisedTime),
        predictedArrivalUtc: parseAdbTime(flight.arrival?.predictedTime),
        runwayArrivalUtc: parseAdbTime(flight.arrival?.runwayTime),
        departureGate: flight.departure?.gate || null,
        arrivalGate: flight.arrival?.gate || null,
        departureTerminal: flight.departure?.terminal || null,
        arrivalTerminal: flight.arrival?.terminal || null,
        aircraftModel: flight.aircraft?.model?.trim() || null,
        greatCircleDistanceKm: typeof flight.greatCircleDistance?.km === 'number' ? flight.greatCircleDistance.km : null,
        source,
    };
}

// Best current estimate of the arrival instant (actual > predicted > scheduled).
export function bestArrivalEstimateUtc(flight: NormalizedFlight): string | null {
    return flight.revisedArrivalUtc || flight.predictedArrivalUtc || flight.runwayArrivalUtc || flight.scheduledArrivalUtc;
}

// Arrival delay in whole minutes against the scheduled arrival, or null when
// either side is unknown. Never mixes departure and arrival timestamps.
export function arrivalDelayMinutes(flight: NormalizedFlight): number | null {
    const scheduled = flight.scheduledArrivalUtc ? Date.parse(flight.scheduledArrivalUtc) : NaN;
    const estimateIso = bestArrivalEstimateUtc(flight);
    const estimate = estimateIso ? Date.parse(estimateIso) : NaN;
    if (Number.isNaN(scheduled) || Number.isNaN(estimate)) return null;
    return Math.max(0, Math.round((estimate - scheduled) / 60000));
}

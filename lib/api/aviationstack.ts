// lib/api/aviationstack.ts
//
// Aviationstack is rate-limited to 100 requests/month on our plan, so the
// dev/test path must never touch the real API. Only production (or the
// explicit AVIATIONSTACK_FORCE_LIVE override, for manual real-API testing
// in a non-prod environment) makes a live request.

export interface AircraftInfo {
    aircraftType: string | null;
    registration: string | null;
}

export interface AviationstackError {
    error: true;
    message: string;
    code?: string;
}

export interface FlightRoute {
    originIata: string;
    destinationIata: string;
}

const usesLiveApi = (): boolean => {
    return process.env.NODE_ENV === 'production' || process.env.AVIATIONSTACK_FORCE_LIVE === 'true';
};

// Static mock data so dev/test work entirely offline. Keyed by flight
// number so different fixtures can simulate an equipment change by editing
// this map (or by mocking the module in tests).
const MOCK_AIRCRAFT_BY_FLIGHT: Record<string, AircraftInfo> = {
    DEFAULT: { aircraftType: 'B787', registration: 'TC-MOCK' },
};

function getMockAircraftInfo(flightNumber: string): AircraftInfo {
    const key = flightNumber.toUpperCase();
    console.log(`[Aviationstack] DEV MODE — returning mock aircraft data for ${key}`);
    return MOCK_AIRCRAFT_BY_FLIGHT[key] ?? MOCK_AIRCRAFT_BY_FLIGHT.DEFAULT;
}

async function getLiveAircraftInfo(flightNumber: string, date: string): Promise<AircraftInfo | AviationstackError> {
    const apiKey = process.env.AVIATIONSTACK_API_KEY;
    if (!apiKey) {
        console.error('[Aviationstack] Missing AVIATIONSTACK_API_KEY in .env');
        return {
            error: true,
            message: 'Aviationstack API key not configured',
            code: 'MISSING_CREDENTIALS',
        };
    }

    try {
        const url = `https://api.aviationstack.com/v1/flights?access_key=${apiKey}&flight_iata=${flightNumber}&flight_date=${date}`;

        console.log(`[Aviationstack] LIVE request for ${flightNumber} on ${date} (quota-limited — use sparingly)`);

        const response = await fetch(url, { method: 'GET' });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Aviationstack] API error (${response.status}):`, errorText);
            return {
                error: true,
                message: `Aviationstack API returned ${response.status}: ${errorText}`,
                code: `HTTP_${response.status}`,
            };
        }

        const data = await response.json();
        const flight = Array.isArray(data?.data) ? data.data[0] : null;

        if (!flight) {
            return {
                error: true,
                message: `No flight found for ${flightNumber} on ${date}`,
                code: 'NOT_FOUND',
            };
        }

        return {
            aircraftType: flight.aircraft?.iata ?? null,
            registration: flight.aircraft?.registration ?? null,
        };
    } catch (err: any) {
        console.error('[Aviationstack] Exception during fetch:', err.message);
        return {
            error: true,
            message: err.message || 'Unknown Aviationstack fetch error',
            code: 'FETCH_EXCEPTION',
        };
    }
}

/**
 * Resolves the current aircraft type/equipment for a flight number+date.
 * In any non-production environment (without the live override flag) this
 * returns static mock data and never calls the real Aviationstack API.
 */
export async function getAircraftEquipment(
    flightNumber: string,
    date: string,
): Promise<AircraftInfo | AviationstackError> {
    if (!usesLiveApi()) {
        return getMockAircraftInfo(flightNumber);
    }

    return getLiveAircraftInfo(flightNumber, date);
}

// Static mock routes so dev/test never spend the real Aviationstack quota.
// Keyed by flight number, with a generic fallback for unknown numbers.
const MOCK_ROUTES_BY_FLIGHT: Record<string, FlightRoute> = {
    DEFAULT: { originIata: 'JFK', destinationIata: 'LHR' },
};

function getMockFlightRoute(flightNumber: string): FlightRoute {
    const key = flightNumber.toUpperCase();
    console.log(`[Aviationstack] DEV MODE — returning mock route data for ${key}`);
    return MOCK_ROUTES_BY_FLIGHT[key] ?? MOCK_ROUTES_BY_FLIGHT.DEFAULT;
}

async function getLiveFlightRoute(flightNumber: string): Promise<FlightRoute | AviationstackError> {
    const apiKey = process.env.AVIATIONSTACK_API_KEY;
    if (!apiKey) {
        console.error('[Aviationstack] Missing AVIATIONSTACK_API_KEY in .env');
        return {
            error: true,
            message: 'Aviationstack API key not configured',
            code: 'MISSING_CREDENTIALS',
        };
    }

    try {
        const url = `https://api.aviationstack.com/v1/flights?access_key=${apiKey}&flight_iata=${flightNumber}`;

        console.log(`[Aviationstack] LIVE route request for ${flightNumber} (quota-limited — use sparingly)`);

        const response = await fetch(url, { method: 'GET' });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Aviationstack] API error (${response.status}):`, errorText);
            return {
                error: true,
                message: `Aviationstack API returned ${response.status}: ${errorText}`,
                code: `HTTP_${response.status}`,
            };
        }

        const data = await response.json();
        const flight = Array.isArray(data?.data) ? data.data[0] : null;

        const originIata = flight?.departure?.iata ?? null;
        const destinationIata = flight?.arrival?.iata ?? null;

        if (!originIata || !destinationIata) {
            return {
                error: true,
                message: `No route found for ${flightNumber}`,
                code: 'NOT_FOUND',
            };
        }

        return { originIata, destinationIata };
    } catch (err: any) {
        console.error('[Aviationstack] Exception during fetch:', err.message);
        return {
            error: true,
            message: err.message || 'Unknown Aviationstack fetch error',
            code: 'FETCH_EXCEPTION',
        };
    }
}

/**
 * Resolves the origin/destination IATA codes for a flight number. In any
 * non-production environment (without the live override flag) this returns
 * static mock route data and never calls the real Aviationstack API.
 */
export async function getFlightRoute(flightNumber: string): Promise<FlightRoute | AviationstackError> {
    if (!usesLiveApi()) {
        return getMockFlightRoute(flightNumber);
    }

    return getLiveFlightRoute(flightNumber);
}

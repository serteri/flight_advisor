import { prisma } from '@/lib/prisma';
import { FlightResult } from '@/types/hybridFlight';

const DAY_MS = 24 * 60 * 60 * 1000;

const AIRPORT_UTC_OFFSET_MINUTES: Record<string, number> = {
    BNE: 600,
    SYD: 600,
    MEL: 600,
    PER: 480,
    ADL: 570,
    AKL: 780,
    CHC: 780,
    SIN: 480,
    DOH: 180,
    DXB: 240,
    AUH: 240,
    IST: 180,
    SAW: 180,
    LHR: 0,
    LGW: 0,
    FRA: 60,
    MUC: 60,
    AMS: 60,
    CDG: 60,
    JFK: -300,
    EWR: -300,
    LAX: -480,
    SFO: -480,
    HND: 540,
    NRT: 540,
    ICN: 540,
    PVG: 480,
    PEK: 480,
    CAN: 480,
    PKX: 480,
};

const hasExplicitTimezone = (value: string): boolean =>
    /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim());

const toIataCode = (value: any): string => {
    if (!value) return '';
    if (typeof value === 'string') return value.toUpperCase();
    if (typeof value === 'object') {
        const code = value.iata || value.iata_code || value.iataCode || value.code || value.id;
        if (code) return String(code).toUpperCase();
    }
    return '';
};

const parseNaiveDateToUtcMs = (value: string, airportCode: string): number => {
    const text = value.trim();
    if (!text) return NaN;

    if (hasExplicitTimezone(text)) {
        return new Date(text).getTime();
    }

    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!match) {
        return new Date(text).getTime();
    }

    const offsetMinutes = AIRPORT_UTC_OFFSET_MINUTES[airportCode];
    if (typeof offsetMinutes !== 'number') {
        return new Date(text).getTime();
    }

    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    const hour = parseInt(match[4], 10);
    const minute = parseInt(match[5], 10);
    const second = parseInt(match[6] || '0', 10);

    return Date.UTC(year, month, day, hour, minute, second) - offsetMinutes * 60 * 1000;
};

export const toMinutes = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.max(0, value);
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();

        const isoMatch = trimmed.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
        if (isoMatch) {
            const hours = parseInt(isoMatch[1] || '0', 10);
            const mins = parseInt(isoMatch[2] || '0', 10);
            return Math.max(0, hours * 60 + mins);
        }

        const hrMinMatch = trimmed.match(/(\d+)\s*(h|hr|hrs|hour|hours)\s*(\d+)?\s*(m|min|mins|minute|minutes)?/i);
        if (hrMinMatch) {
            const hours = parseInt(hrMinMatch[1] || '0', 10);
            const mins = parseInt(hrMinMatch[3] || '0', 10);
            return Math.max(0, hours * 60 + mins);
        }

        const minMatch = trimmed.match(/(\d+)\s*(m|min|mins|minute|minutes)/i);
        if (minMatch) {
            return Math.max(0, parseInt(minMatch[1], 10));
        }

        const numeric = parseFloat(trimmed.replace(/[^0-9.]/g, ''));
        if (Number.isFinite(numeric)) {
            return Math.max(0, numeric);
        }
    }

    return 0;
};

export const normalizeUtcDate = (dateInput: string): Date => {
    const datePart = dateInput.includes('T') ? dateInput.slice(0, 10) : dateInput;
    return new Date(`${datePart}T00:00:00.000Z`);
};

export const resolveFlightDurationMinutes = (flight: FlightResult): number => {
    const declaredDuration = toMinutes(flight.duration);

    const routeFrom = toIataCode(flight.from);
    const routeTo = toIataCode(flight.to);
    const depMs = flight.departTime ? parseNaiveDateToUtcMs(String(flight.departTime), routeFrom) : NaN;
    const arrMs = flight.arriveTime ? parseNaiveDateToUtcMs(String(flight.arriveTime), routeTo) : NaN;
    const timestampDuration =
        Number.isFinite(depMs) && Number.isFinite(arrMs) && arrMs > depMs
            ? Math.round((arrMs - depMs) / 60000)
            : 0;

    const segmentDuration = Array.isArray(flight.segments)
        ? flight.segments
              .map((segment: any) => {
                  const segFrom = toIataCode(segment?.origin || segment?.from || segment?.departure_airport || segment?.departureAirport || segment?.origin_airport);
                  const segTo = toIataCode(segment?.destination || segment?.to || segment?.arrival_airport || segment?.arrivalAirport || segment?.destination_airport);
                  const segDep = segment?.departing_at || segment?.departure || segment?.departure_time;
                  const segArr = segment?.arriving_at || segment?.arrival || segment?.arrival_time;
                  const segDepMs = segDep ? parseNaiveDateToUtcMs(String(segDep), segFrom) : NaN;
                  const segArrMs = segArr ? parseNaiveDateToUtcMs(String(segArr), segTo) : NaN;

                  if (Number.isFinite(segDepMs) && Number.isFinite(segArrMs) && segArrMs > segDepMs) {
                      return Math.round((segArrMs - segDepMs) / 60000);
                  }

                  const direct = toMinutes(segment?.duration);
                  if (direct > 0) return direct;

                  return 0;
              })
              .reduce((sum, value) => sum + value, 0)
        : 0;

    const layoverDuration = Array.isArray(flight.layovers)
        ? flight.layovers
              .map((layover) => toMinutes(layover?.duration))
              .reduce((sum, value) => sum + value, 0)
        : 0;

    const segmentPlusLayovers = segmentDuration + layoverDuration;

    if (timestampDuration > 0 && segmentPlusLayovers > 0) {
        const mismatch = Math.abs(timestampDuration - segmentPlusLayovers);
        if (mismatch > 90) {
            return segmentPlusLayovers;
        }
        return timestampDuration;
    }

    if (timestampDuration > 0) {
        return timestampDuration;
    }

    if (segmentPlusLayovers > 0) {
        return segmentPlusLayovers;
    }

    return Math.max(0, declaredDuration);
};

export const isInvalidBneIstDuration = (flight: FlightResult): boolean => {
    const from = (flight.from || '').toString().toUpperCase();
    const to = (flight.to || '').toString().toUpperCase();
    const routeMatch = from === 'BNE' && to === 'IST';
    if (!routeMatch) return false;

    const durationMins = resolveFlightDurationMinutes(flight);
    return durationMins > 0 && durationMins < 14 * 60;
};

export async function persistFlightSearchRecords(
    flights: FlightResult[],
    options: { origin: string; destination: string; departureDate: string }
) {
    const departureDate = normalizeUtcDate(options.departureDate);

    const rows = flights
        .filter((flight) => Number.isFinite(Number(flight.price)) && Number(flight.price) > 0)
        .filter((flight) => !isInvalidBneIstDuration(flight))
        .map((flight) => ({
            flightNumber: (flight.flightNumber || 'UNKNOWN').toString(),
            origin: options.origin,
            destination: options.destination,
            departureDate,
            price: Number(flight.price),
            provider: (flight.source || 'UNKNOWN').toString(),
        }));

    const invalidRows = rows.filter((row) =>
        !row.flightNumber || !row.origin || !row.destination || !Number.isFinite(row.price) || row.price <= 0 || !row.departureDate
    );

    if (invalidRows.length > 0) {
        console.error('[FLIGHT_SEARCH_RECORD] invalid rows filtered:', invalidRows.slice(0, 3));
    }

    const validRows = rows.filter((row) =>
        !!row.flightNumber &&
        !!row.origin &&
        !!row.destination &&
        Number.isFinite(row.price) &&
        row.price > 0 &&
        !!row.departureDate
    );

    if (validRows.length === 0) {
        console.error('[FLIGHT_SEARCH_RECORD] no valid rows to persist', {
            flightsReceived: flights.length,
            origin: options.origin,
            destination: options.destination,
            departureDate: options.departureDate,
        });
        return;
    }

    const flightSearchRecordModel = (prisma as any)?.flightSearchRecord;
    if (!flightSearchRecordModel) {
        console.error('[FLIGHT_SEARCH_RECORD] prisma model flightSearchRecord is unavailable (client/schema mismatch?)');
        return;
    }

    try {
        await flightSearchRecordModel.createMany({
            data: validRows,
        });
    } catch (error: any) {
        console.error('[FLIGHT_SEARCH_RECORD] persist failed:', {
            message: error?.message || String(error),
            rows: validRows.length,
            sample: validRows.slice(0, 2),
        });
    }
}

export async function getMedianPriceForRouteDate(
    origin: string,
    destination: string,
    departureDate: string
): Promise<number | null> {
    const start = normalizeUtcDate(departureDate);
    const end = new Date(start.getTime() + DAY_MS);

    const flightSearchRecordModel = (prisma as any)?.flightSearchRecord;
    if (!flightSearchRecordModel) {
        return null;
    }

    let prices: Array<{ price: number }> = [];
    try {
        prices = await flightSearchRecordModel.findMany({
            where: {
                origin,
                destination,
                departureDate: {
                    gte: start,
                    lt: end,
                },
                price: {
                    gt: 0,
                },
            },
            select: { price: true },
        });
    } catch (error: any) {
        console.warn('[FLIGHT_SEARCH_RECORD] median lookup skipped:', error?.message || error);
        return null;
    }

    if (prices.length === 0) {
        return null;
    }

    const values = prices
        .map((row) => Number(row.price))
        .filter((value) => Number.isFinite(value) && value > 0)
        .sort((a, b) => a - b);

    if (values.length === 0) {
        return null;
    }

    const mid = Math.floor(values.length / 2);
    if (values.length % 2 === 0) {
        return (values[mid - 1] + values[mid]) / 2;
    }
    return values[mid];
}
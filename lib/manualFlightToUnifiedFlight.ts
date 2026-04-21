import { createHash } from 'node:crypto';

import { z } from 'zod';

import type {
    BaggageAllowance,
    CabinClass,
    FlightLayover,
    FlightPolicies,
    FlightSegment,
    UnifiedFlight,
} from '@/types/unifiedFlight';

const ISO_DATETIME_ERROR = 'Must be a valid ISO 8601 datetime';
const IATA_ERROR = 'Must be a 3-letter IATA airport code';
const DEFAULT_DURATION_MINUTES = 120;
const DEFAULT_LAYOVER_DURATION_MINUTES = 90;
const LONG_HAUL_DURATION_MINUTES: Record<string, number> = {
    'BNE-IST': 1020,
    'SYD-LHR': 1180,
    'MEL-CDG': 1160,
};

const isoDateTimeSchema = z.string().datetime({ offset: true, message: ISO_DATETIME_ERROR });
const iataSchema = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, IATA_ERROR);

export const manualFlightInputSchema = z.object({
    origin: iataSchema,
    destination: iataSchema,
    departureDateTime: isoDateTimeSchema,
    price: z.coerce.number().positive('Price must be greater than 0'),
    airline: z.string().trim().min(1).optional(),
    flightNumber: z.string().trim().min(1).optional(),
    arrivalDateTime: isoDateTimeSchema.optional(),
    totalDurationMinutes: z.coerce.number().int().min(30).max(4320).optional(),
    stops: z.coerce.number().int().min(0).max(4).optional(),
    layoverDurationMinutes: z.coerce.number().int().min(15).max(720).optional(),
    layoverAirport: iataSchema.optional(),
    layoverAirports: z.array(iataSchema).max(4).optional(),
    cabinClass: z.enum(['economy', 'premium', 'business', 'first']).optional(),
    baggageIncluded: z.boolean().optional(),
    checkedBaggageKg: z.coerce.number().min(0).max(64).optional(),
    cabinBaggageKg: z.coerce.number().min(0).max(20).optional(),
    baggageKg: z.coerce.number().min(0).max(64).optional(),
    aircraftType: z.string().trim().min(1).optional(),
    fareFlexibility: z.string().trim().min(1).max(80).optional(),
    aircraft: z.string().trim().min(1).optional(),
    bookingUrl: z.string().trim().url().optional(),
    currency: z.string().trim().toUpperCase().length(3).optional(),
});

export type ManualFlightInput = z.infer<typeof manualFlightInputSchema>;

const normalizeCabinClass = (value?: string): CabinClass => {
    switch ((value || '').toLowerCase()) {
        case 'premium':
            return 'premium';
        case 'business':
            return 'business';
        case 'first':
            return 'first';
        default:
            return 'economy';
    }
};

const inferArrivalDateTime = (
    departureDateTime: string,
    arrivalDateTime?: string,
    totalDurationMinutes?: number,
    stops = 0,
    layoverDurationMinutes = DEFAULT_LAYOVER_DURATION_MINUTES,
): string => {
    if (arrivalDateTime) return arrivalDateTime;

    const departureMs = new Date(departureDateTime).getTime();
    const fallbackDurationMinutes = totalDurationMinutes
        || (DEFAULT_DURATION_MINUTES + Math.max(0, stops) * layoverDurationMinutes);
    return new Date(departureMs + fallbackDurationMinutes * 60_000).toISOString();
};

const calculateDurationMinutes = (
    departureDateTime: string,
    arrivalDateTime: string,
    totalDurationMinutes?: number,
): number => {
    if (typeof totalDurationMinutes === 'number' && Number.isFinite(totalDurationMinutes)) {
        return Math.max(1, Math.round(totalDurationMinutes));
    }

    const departureMs = new Date(departureDateTime).getTime();
    const arrivalMs = new Date(arrivalDateTime).getTime();

    if (!Number.isFinite(departureMs) || !Number.isFinite(arrivalMs) || arrivalMs <= departureMs) {
        return DEFAULT_DURATION_MINUTES;
    }

    return Math.max(1, Math.round((arrivalMs - departureMs) / 60_000));
};

const buildLayovers = (
    stops: number,
    layoverDurationMinutes: number,
    layoverAirport?: string,
    layoverAirports?: string[],
): FlightLayover[] | undefined => {
    if (stops <= 0) return undefined;

    const airports = [layoverAirport, ...(layoverAirports || [])]
        .filter((airport): airport is string => Boolean(airport))
        .slice(0, stops);
    const fallbackAirports = Array.from({ length: stops }, (_, index) => airports[index] || 'TBD');

    return fallbackAirports.map((airport) => ({
        airport,
        duration: layoverDurationMinutes,
    }));
};

const isLongHaulRoute = (origin: string, destination: string): boolean => {
    return Boolean(LONG_HAUL_DURATION_MINUTES[`${origin}-${destination}`]);
};

const buildBaggage = (input: ManualFlightInput): BaggageAllowance | undefined => {
    const included = Boolean(input.baggageIncluded);
    const checkedKgRaw = Number.isFinite(input.checkedBaggageKg)
        ? Number(input.checkedBaggageKg)
        : (Number.isFinite(input.baggageKg) ? Number(input.baggageKg) : undefined);
    const cabinKg = Number.isFinite(input.cabinBaggageKg) ? Number(input.cabinBaggageKg) : undefined;
    const inferredCheckedKg = included && !checkedKgRaw
        ? (isLongHaulRoute(input.origin, input.destination) ? 23 : 20)
        : undefined;
    const checkedKg = checkedKgRaw || inferredCheckedKg;

    if (!included && !checkedKg && !cabinKg) {
        return undefined;
    }

    if (included) {
        return {
            included: true,
            checked: checkedKg
                ? {
                      kg: checkedKg,
                      label: checkedKgRaw
                          ? `Checked baggage included (${checkedKg} kg)`
                          : `Checked baggage estimated (${checkedKg} kg baseline)`,
                  }
                : {
                      label: 'Checked baggage included',
                  },
            cabin: cabinKg
                ? {
                      kg: cabinKg,
                      label: `Cabin baggage (${cabinKg} kg)`,
                  }
                : undefined,
        };
    }

    return {
        included: false,
        checked: checkedKg
            ? {
                  kg: checkedKg,
                  label: `Baggage allowance stated (${checkedKg} kg)`,
              }
            : {
                  label: 'No checked baggage included',
              },
        cabin: cabinKg
            ? {
                  kg: cabinKg,
                  label: `Cabin baggage (${cabinKg} kg)`,
              }
            : undefined,
    };
};

const buildSyntheticSegment = (input: ManualFlightInput, arrivalDateTime: string, duration: number): FlightSegment => ({
    from: input.origin,
    to: input.destination,
    departureTime: input.departureDateTime,
    arrivalTime: arrivalDateTime,
    duration,
    carrier: (input.airline || 'MANUAL').slice(0, 3).toUpperCase(),
    marketingCarrier: (input.airline || 'MANUAL').slice(0, 3).toUpperCase(),
    flightNumber: input.flightNumber || `${(input.airline || 'MANUAL').slice(0, 2).toUpperCase()}000`,
    aircraft: input.aircraftType || input.aircraft,
});

const buildPolicies = (fareFlexibility?: string): FlightPolicies | undefined => {
    if (!fareFlexibility) return undefined;

    const normalized = fareFlexibility.toLowerCase();
    const refundable = /(refund|flex|full)/.test(normalized);
    const changeAllowed = refundable || /(change|modify)/.test(normalized);

    return {
        refundable,
        changeAllowed,
        changeFee: fareFlexibility,
    };
};

export const isUnrealisticLongHaulDuration = (
    origin: string,
    destination: string,
    totalDurationMinutes?: number,
): boolean => {
    if (typeof totalDurationMinutes !== 'number') return false;
    const minimum = LONG_HAUL_DURATION_MINUTES[`${origin}-${destination}`];
    if (!minimum) return false;
    return totalDurationMinutes < minimum;
};

const buildManualFlightId = (input: ManualFlightInput): string => {
    const seed = [
        input.origin,
        input.destination,
        input.departureDateTime,
        input.price,
        input.flightNumber || 'manual',
    ].join('|');

    return `manual_${createHash('sha1').update(seed).digest('hex').slice(0, 12)}`;
};

export function manualFlightToUnifiedFlight(input: ManualFlightInput): UnifiedFlight {
    const normalizedInput = manualFlightInputSchema.parse({
        ...input,
        origin: input.origin,
        destination: input.destination,
        layoverAirport: input.layoverAirport?.toUpperCase(),
        layoverAirports: input.layoverAirports?.map((airport) => airport.toUpperCase()),
        currency: input.currency || 'USD',
    });

    const derivedStops = typeof normalizedInput.stops === 'number'
        ? normalizedInput.stops
        : Math.max(0, (normalizedInput.layoverAirports || []).length);
    const arrivalDateTime = inferArrivalDateTime(
        normalizedInput.departureDateTime,
        normalizedInput.arrivalDateTime,
        normalizedInput.totalDurationMinutes,
        derivedStops,
        normalizedInput.layoverDurationMinutes || DEFAULT_LAYOVER_DURATION_MINUTES,
    );
    const duration = calculateDurationMinutes(
        normalizedInput.departureDateTime,
        arrivalDateTime,
        normalizedInput.totalDurationMinutes,
    );
    const segment = buildSyntheticSegment(normalizedInput, arrivalDateTime, duration);

    return {
        id: buildManualFlightId(normalizedInput),
        source: 'manual',
        from: normalizedInput.origin,
        to: normalizedInput.destination,
        departureTime: normalizedInput.departureDateTime,
        arrivalTime: arrivalDateTime,
        duration,
        airline: normalizedInput.airline || 'Manual Entry',
        operatingAirline: normalizedInput.airline,
        flightNumber: normalizedInput.flightNumber || segment.flightNumber,
        stops: derivedStops,
        cabinClass: normalizeCabinClass(normalizedInput.cabinClass),
        segments: [segment],
        layovers: buildLayovers(
            derivedStops,
            normalizedInput.layoverDurationMinutes || DEFAULT_LAYOVER_DURATION_MINUTES,
            normalizedInput.layoverAirport,
            normalizedInput.layoverAirports,
        ),
        price: normalizedInput.price,
        currency: normalizedInput.currency || 'USD',
        baggage: buildBaggage(normalizedInput),
        policies: buildPolicies(normalizedInput.fareFlexibility),
        deepLink: normalizedInput.bookingUrl || null,
        bookingLink: normalizedInput.bookingUrl || null,
    };
}
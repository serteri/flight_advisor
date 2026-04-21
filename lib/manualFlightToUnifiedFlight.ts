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
const DEFAULT_QUICK_DEPARTURE_TIME = '10:00:00.000Z';
const DEFAULT_QUICK_DURATION_MINUTES = 180;
const DEFAULT_LAYOVER_DURATION_MINUTES = 90;

const isoDateTimeSchema = z.string().datetime({ offset: true, message: ISO_DATETIME_ERROR });
const iataSchema = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, IATA_ERROR);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a valid YYYY-MM-DD date');

const LONG_HAUL_DURATION_MINUTES: Record<string, number> = {
    'BNE-IST': 1020,
    'SYD-LHR': 1180,
    'MEL-CDG': 1160,
};

const quickScoreInputSchema = z.object({
    mode: z.literal('quick'),
    origin: iataSchema,
    destination: iataSchema,
    departureDate: dateSchema,
    price: z.coerce.number().positive('Price must be greater than 0'),
    stops: z.coerce.number().int().min(0).max(4),
    airline: z.string().trim().min(1).optional(),
});

const itinerarySegmentSchema = z.object({
    from: iataSchema,
    to: iataSchema,
    departureDateTime: isoDateTimeSchema,
    arrivalDateTime: isoDateTimeSchema,
    airline: z.string().trim().min(1),
    flightNumber: z.string().trim().min(1),
});

const detailedScoreInputSchema = z.object({
    mode: z.literal('detailed'),
    totalPrice: z.coerce.number().positive('Total price must be greater than 0'),
    currency: z.string().trim().toUpperCase().length(3).default('USD'),
    cabin: z.enum(['economy', 'premium', 'business', 'first']).default('economy'),
    checkedBaggageIncluded: z.boolean().default(false),
    checkedBaggageKg: z.coerce.number().min(0).max(64).optional(),
    refundable: z.boolean().optional(),
    segments: z.array(itinerarySegmentSchema).min(1).max(8),
});

export const itineraryScoreInputSchema = z.discriminatedUnion('mode', [
    quickScoreInputSchema,
    detailedScoreInputSchema,
]);

export type ItineraryScoreInput = z.infer<typeof itineraryScoreInputSchema>;
export type QuickScoreInput = z.infer<typeof quickScoreInputSchema>;
export type DetailedScoreInput = z.infer<typeof detailedScoreInputSchema>;

export type InputAssessment = {
    mode: 'quick' | 'detailed';
    completenessScore: number;
    realismScore: number;
    priceContextAvailable: boolean;
    riskFlags: string[];
    comfortNotes: string[];
    promptForDetails: boolean;
    selfTransferRisk: 'LOW' | 'MEDIUM' | 'HIGH';
};

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

const parseDateMs = (value: string): number => new Date(value).getTime();

const isUnrealisticLongHaulDuration = (origin: string, destination: string, durationMinutes: number): boolean => {
    const min = LONG_HAUL_DURATION_MINUTES[`${origin}-${destination}`];
    if (!min) return false;
    return durationMinutes < min;
};

const buildBaggageForDetailed = (input: DetailedScoreInput): BaggageAllowance | undefined => {
    if (!input.checkedBaggageIncluded && typeof input.checkedBaggageKg !== 'number') {
        return undefined;
    }

    return {
        included: input.checkedBaggageIncluded,
        checked: input.checkedBaggageIncluded
            ? {
                kg: input.checkedBaggageKg,
                label: typeof input.checkedBaggageKg === 'number'
                    ? `Checked baggage included (${input.checkedBaggageKg} kg)`
                    : 'Checked baggage included',
            }
            : {
                label: typeof input.checkedBaggageKg === 'number'
                    ? `Checked baggage stated (${input.checkedBaggageKg} kg)`
                    : 'No checked baggage included',
            },
    };
};

const buildPoliciesForDetailed = (input: DetailedScoreInput): FlightPolicies | undefined => {
    if (typeof input.refundable !== 'boolean') return undefined;

    return {
        refundable: input.refundable,
        changeAllowed: input.refundable,
        changeFee: input.refundable ? 'Flexible fare' : 'Not refundable',
    };
};

const durationBetween = (startIso: string, endIso: string): number => {
    const start = parseDateMs(startIso);
    const end = parseDateMs(endIso);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
    return Math.round((end - start) / 60_000);
};

const buildQuickUnifiedFlight = (input: QuickScoreInput): { unifiedFlight: UnifiedFlight; assessment: InputAssessment } => {
    const departureTime = new Date(`${input.departureDate}T${DEFAULT_QUICK_DEPARTURE_TIME}`).toISOString();
    const duration = DEFAULT_QUICK_DURATION_MINUTES + (input.stops * DEFAULT_LAYOVER_DURATION_MINUTES);
    const arrivalTime = new Date(parseDateMs(departureTime) + duration * 60_000).toISOString();

    const carrierCode = (input.airline || 'MANUAL').slice(0, 3).toUpperCase();
    const segment: FlightSegment = {
        from: input.origin,
        to: input.destination,
        departureTime,
        arrivalTime,
        duration,
        carrier: carrierCode,
        marketingCarrier: carrierCode,
        flightNumber: `${carrierCode.slice(0, 2)}000`,
    };

    const riskFlags = [
        'Quick mode provides a rough estimate only.',
        'Detailed itinerary segments are required for realistic connection and transfer analysis.',
    ];

    if (!input.airline) {
        riskFlags.push('Airline missing in quick mode input.');
    }

    const assessment: InputAssessment = {
        mode: 'quick',
        completenessScore: input.airline ? 0.55 : 0.45,
        realismScore: 0.45,
        priceContextAvailable: false,
        riskFlags,
        comfortNotes: [],
        promptForDetails: true,
        selfTransferRisk: 'MEDIUM',
    };

    return {
        unifiedFlight: {
            id: `manual_${createHash('sha1').update(`quick|${input.origin}|${input.destination}|${input.departureDate}|${input.price}|${input.stops}`).digest('hex').slice(0, 12)}`,
            source: 'manual',
            from: input.origin,
            to: input.destination,
            departureTime,
            arrivalTime,
            duration,
            airline: input.airline || 'Manual Entry',
            operatingAirline: input.airline,
            flightNumber: segment.flightNumber,
            stops: input.stops,
            cabinClass: 'economy',
            segments: [segment],
            layovers: input.stops > 0
                ? Array.from({ length: input.stops }, () => ({
                    airport: 'TBD',
                    duration: DEFAULT_LAYOVER_DURATION_MINUTES,
                }))
                : undefined,
            price: input.price,
            currency: 'USD',
            deepLink: null,
            bookingLink: null,
        },
        assessment,
    };
};

const buildDetailedUnifiedFlight = (input: DetailedScoreInput): { unifiedFlight: UnifiedFlight; assessment: InputAssessment } => {
    const sortedSegments = [...input.segments].sort(
        (a, b) => parseDateMs(a.departureDateTime) - parseDateMs(b.departureDateTime),
    );

    const segmentDurations = sortedSegments.map((segment) =>
        durationBetween(segment.departureDateTime, segment.arrivalDateTime),
    );

    const firstSegment = sortedSegments[0];
    const lastSegment = sortedSegments[sortedSegments.length - 1];

    const totalDuration = durationBetween(firstSegment.departureDateTime, lastSegment.arrivalDateTime);
    const stops = Math.max(0, sortedSegments.length - 1);

    const layovers: FlightLayover[] = [];
    let connectionPenalty = 0;
    let selfTransferRiskScore = 0;
    const riskFlags: string[] = [];
    const comfortNotes: string[] = [];

    for (let i = 0; i < sortedSegments.length - 1; i += 1) {
        const current = sortedSegments[i];
        const next = sortedSegments[i + 1];

        const layoverDuration = durationBetween(current.arrivalDateTime, next.departureDateTime);
        layovers.push({ airport: current.to, duration: layoverDuration });

        if (current.to !== next.from) {
            connectionPenalty += 0.2;
            riskFlags.push(`Segment mismatch: ${current.to} to ${next.from}. Potential airport change risk.`);
        }

        if (layoverDuration < 40) {
            connectionPenalty += 0.2;
            riskFlags.push(`Very short connection (${layoverDuration} min) may be unrealistic.`);
        } else if (layoverDuration > 360) {
            connectionPenalty += 0.1;
            riskFlags.push(`Long connection (${layoverDuration} min) increases disruption exposure.`);
        } else {
            comfortNotes.push(`Connection at ${current.to} appears realistic (${layoverDuration} min).`);
        }

        if (current.airline.trim().toUpperCase() !== next.airline.trim().toUpperCase()) {
            selfTransferRiskScore += 1;
            riskFlags.push(`Airline change ${current.airline} -> ${next.airline} may imply self-transfer risk.`);
        }
    }

    if (isUnrealisticLongHaulDuration(firstSegment.from, lastSegment.to, totalDuration)) {
        riskFlags.push('Total itinerary duration appears unrealistically short for this long-haul route.');
        connectionPenalty += 0.2;
    }

    const missingBaggageKgPenalty = input.checkedBaggageIncluded && typeof input.checkedBaggageKg !== 'number' ? 0.08 : 0;
    if (missingBaggageKgPenalty > 0) {
        riskFlags.push('Checked baggage is included but exact kg is missing.');
    }

    const completenessScore = Math.max(
        0.55,
        1
            - (typeof input.checkedBaggageKg === 'number' || !input.checkedBaggageIncluded ? 0 : 0.1)
            - (typeof input.refundable === 'boolean' ? 0 : 0.06),
    );

    const realismScore = Math.max(0.45, 1 - connectionPenalty - missingBaggageKgPenalty);

    const selfTransferRisk: InputAssessment['selfTransferRisk'] = selfTransferRiskScore >= 2
        ? 'HIGH'
        : selfTransferRiskScore === 1
            ? 'MEDIUM'
            : 'LOW';

    if (selfTransferRisk === 'LOW') {
        comfortNotes.push('No airline-switch self-transfer pattern detected.');
    }

    const unifiedSegments = sortedSegments.map((segment, index): FlightSegment => ({
        from: segment.from,
        to: segment.to,
        departureTime: segment.departureDateTime,
        arrivalTime: segment.arrivalDateTime,
        duration: segmentDurations[index] || 0,
        carrier: segment.airline.slice(0, 3).toUpperCase(),
        marketingCarrier: segment.airline.slice(0, 3).toUpperCase(),
        flightNumber: segment.flightNumber,
    }));

    const assessment: InputAssessment = {
        mode: 'detailed',
        completenessScore,
        realismScore,
        priceContextAvailable: false,
        riskFlags,
        comfortNotes,
        promptForDetails: false,
        selfTransferRisk,
    };

    return {
        unifiedFlight: {
            id: `manual_${createHash('sha1').update(`detailed|${firstSegment.from}|${lastSegment.to}|${firstSegment.departureDateTime}|${input.totalPrice}|${sortedSegments.length}`).digest('hex').slice(0, 12)}`,
            source: 'manual',
            from: firstSegment.from,
            to: lastSegment.to,
            departureTime: firstSegment.departureDateTime,
            arrivalTime: lastSegment.arrivalDateTime,
            duration: totalDuration,
            airline: firstSegment.airline,
            operatingAirline: firstSegment.airline,
            flightNumber: firstSegment.flightNumber,
            stops,
            cabinClass: normalizeCabinClass(input.cabin),
            segments: unifiedSegments as [FlightSegment, ...FlightSegment[]],
            layovers: layovers.length ? layovers : undefined,
            price: input.totalPrice,
            currency: input.currency,
            baggage: buildBaggageForDetailed(input),
            policies: buildPoliciesForDetailed(input),
            deepLink: null,
            bookingLink: null,
        },
        assessment,
    };
};

export function itineraryInputToUnifiedFlight(input: ItineraryScoreInput): { unifiedFlight: UnifiedFlight; assessment: InputAssessment } {
    const normalized = itineraryScoreInputSchema.parse(input);

    if (normalized.mode === 'quick') {
        return buildQuickUnifiedFlight(normalized);
    }

    return buildDetailedUnifiedFlight(normalized);
}

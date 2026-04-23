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
import { parseItineraryText } from '@/lib/itineraryTextParser';

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
    currency: z.string().trim().toUpperCase().length(3).default('USD'),
    stops: z.coerce.number().int().min(0).max(4),
    airline: z.string().trim().min(1).optional(),
    cabin: z.enum(['economy', 'premium', 'business', 'first']).optional(),
});

const itinerarySegmentSchema = z.object({
    from: iataSchema,
    to: iataSchema,
    departureDateTime: isoDateTimeSchema,
    arrivalDateTime: isoDateTimeSchema,
    airline: z.string().trim().min(1),
    flightNumber: z.string().trim().min(1),
    aircraft: z.string().trim().min(1).optional(),
    marketedAirline: z.string().trim().min(1).optional(),
    bookingClass: z.string().trim().min(1).max(4).optional(),
    tripDirection: z.enum(['OUTBOUND', 'INBOUND']).optional(),
});

const detailedScoreInputSchema = z.object({
    mode: z.literal('detailed'),
    totalPrice: z.coerce.number().positive('Total price must be greater than 0'),
    currency: z.string().trim().toUpperCase().length(3).default('USD'),
    cabin: z.enum(['economy', 'premium', 'business', 'first']).default('economy'),
    checkedBaggageKg: z.coerce.number().min(0).max(64).optional(),
    cabinBaggageKg: z.coerce.number().min(0).max(20).optional(),
    refundable: z.boolean().optional(),
    segments: z.array(itinerarySegmentSchema).min(1).max(8),
});

const pasteScoreInputSchema = z.object({
    mode: z.literal('paste'),
    itineraryText: z.string().trim().min(20, 'Paste a longer itinerary text'),
    price: z.coerce.number().positive().optional(),
    currency: z.string().trim().toUpperCase().length(3).optional(),
    cabin: z.enum(['economy', 'premium', 'business', 'first']).optional(),
    checkedBaggageKg: z.coerce.number().min(0).max(64).optional(),
    cabinBaggageKg: z.coerce.number().min(0).max(20).optional(),
    refundable: z.boolean().optional(),
    segments: z.array(itinerarySegmentSchema).min(1).max(8).optional(),
});

export const itineraryScoreInputSchema = z.discriminatedUnion('mode', [
    quickScoreInputSchema,
    detailedScoreInputSchema,
    pasteScoreInputSchema,
]);

export type ItineraryScoreInput = z.infer<typeof itineraryScoreInputSchema>;
export type QuickScoreInput = z.infer<typeof quickScoreInputSchema>;
export type DetailedScoreInput = z.infer<typeof detailedScoreInputSchema>;
export type PasteScoreInput = z.infer<typeof pasteScoreInputSchema>;

export type DerivedStructureMetrics = {
    totalDurationMinutes: number;
    totalLayoverMinutes: number;
    connectionCount: number;
    connectionFeasibility: 'GOOD' | 'TIGHT' | 'RISKY';
    routeRealism: 'REALISTIC' | 'QUESTIONABLE';
    airlineReliabilityMix: 'SINGLE_CARRIER' | 'MIXED' | 'HIGHLY_FRAGMENTED';
    baggageConfidenceScore: number;
};

export type InputAssessment = {
    mode: 'quick' | 'detailed';
    completenessScore: number;
    realismScore: number;
    priceContextAvailable: boolean;
    riskFlags: string[];
    comfortNotes: string[];
    promptForDetails: boolean;
    selfTransferRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    baggageConfidenceScore: number;
    airlineReliabilityMix: DerivedStructureMetrics['airlineReliabilityMix'];
    parseWarnings?: string[];
    parseConfidence?: number;
};

export type ParsedSegmentPreview = {
    from: string;
    to: string;
    departureDateTime: string;
    arrivalDateTime: string;
    airline: string;
    flightNumber: string;
    aircraft?: string;
    marketedAirline?: string;
    bookingClass?: string;
};

export type ItineraryConversionResult = {
    unifiedFlight: UnifiedFlight;
    assessment: InputAssessment;
    derived: DerivedStructureMetrics;
    extractedSegments: ParsedSegmentPreview[];
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
    if (typeof input.checkedBaggageKg !== 'number' && typeof input.cabinBaggageKg !== 'number') {
        return undefined;
    }

    return {
        included: typeof input.checkedBaggageKg === 'number',
        checked: typeof input.checkedBaggageKg === 'number'
            ? {
                kg: input.checkedBaggageKg,
                label: `Checked baggage (${input.checkedBaggageKg} kg)`,
            }
            : {
                label: 'Checked baggage not specified',
            },
        cabin: typeof input.cabinBaggageKg === 'number'
            ? {
                kg: input.cabinBaggageKg,
                label: `Cabin baggage (${input.cabinBaggageKg} kg)`,
            }
            : undefined,
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

const assessAirlineMix = (airlines: string[]): DerivedStructureMetrics['airlineReliabilityMix'] => {
    const uniqueCount = new Set(airlines.map((a) => a.trim().toUpperCase())).size;
    if (uniqueCount <= 1) return 'SINGLE_CARRIER';
    if (uniqueCount === 2) return 'MIXED';
    return 'HIGHLY_FRAGMENTED';
};

const buildQuickUnifiedFlight = (
    input: QuickScoreInput,
): ItineraryConversionResult => {
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

    const airlineMix = input.airline ? 'SINGLE_CARRIER' : 'MIXED';

    const riskFlags = [
        'Quick mode provides a rough estimate only.',
        'Detailed itinerary segments are required for realistic connection and transfer analysis.',
    ];

    if (!input.airline) {
        riskFlags.push('Airline missing in quick mode input.');
    }

    const baggageConfidenceScore = 0.45;

    const assessment: InputAssessment = {
        mode: 'quick',
        completenessScore: input.airline ? 0.58 : 0.5,
        realismScore: 0.45,
        priceContextAvailable: false,
        riskFlags,
        comfortNotes: [],
        promptForDetails: true,
        selfTransferRisk: 'MEDIUM',
        baggageConfidenceScore,
        airlineReliabilityMix: airlineMix,
    };

    const derived: DerivedStructureMetrics = {
        totalDurationMinutes: duration,
        totalLayoverMinutes: input.stops * DEFAULT_LAYOVER_DURATION_MINUTES,
        connectionCount: input.stops,
        connectionFeasibility: input.stops <= 1 ? 'TIGHT' : 'RISKY',
        routeRealism: 'QUESTIONABLE',
        airlineReliabilityMix: airlineMix,
        baggageConfidenceScore,
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
            cabinClass: normalizeCabinClass(input.cabin),
            segments: [segment],
            layovers: input.stops > 0
                ? Array.from({ length: input.stops }, () => ({
                    airport: 'TBD',
                    duration: DEFAULT_LAYOVER_DURATION_MINUTES,
                }))
                : undefined,
            price: input.price,
            currency: input.currency,
            deepLink: null,
            bookingLink: null,
        },
        assessment,
        derived,
        extractedSegments: [
            {
                from: segment.from,
                to: segment.to,
                departureDateTime: segment.departureTime,
                arrivalDateTime: segment.arrivalTime,
                airline: input.airline || 'Manual Entry',
                flightNumber: segment.flightNumber,
            },
        ],
    };
};

const buildDetailedUnifiedFlight = (
    input: DetailedScoreInput,
): ItineraryConversionResult => {
    const sortedSegments = [...input.segments].sort(
        (a, b) => parseDateMs(a.departureDateTime) - parseDateMs(b.departureDateTime),
    );

    const segmentDurations = sortedSegments.map((segment) =>
        durationBetween(segment.departureDateTime, segment.arrivalDateTime),
    );

    const firstSegment = sortedSegments[0];
    const lastSegment = sortedSegments[sortedSegments.length - 1];

    const stops = Math.max(0, sortedSegments.length - 1);

    const layovers: FlightLayover[] = [];
    let connectionPenalty = 0;
    let selfTransferRiskScore = 0;
    const riskFlags: string[] = [];
    const comfortNotes: string[] = [];
    let totalLayoverMinutes = 0;
    let tightConnectionCount = 0;

    for (let i = 0; i < sortedSegments.length - 1; i += 1) {
        const current = sortedSegments[i];
        const next = sortedSegments[i + 1];
        const isDirectionBoundary = current.tripDirection && next.tripDirection && current.tripDirection !== next.tripDirection;

        if (isDirectionBoundary) {
            comfortNotes.push(`Detected ${next.tripDirection?.toLowerCase()} leg boundary; skipping connection-risk checks across trip directions.`);
            continue;
        }

        const layoverDuration = durationBetween(current.arrivalDateTime, next.departureDateTime);
        totalLayoverMinutes += layoverDuration;
        layovers.push({ airport: current.to, duration: layoverDuration });

        if (current.to !== next.from) {
            connectionPenalty += 0.22;
            riskFlags.push(`Segment mismatch: ${current.to} to ${next.from}. Potential airport change risk.`);
        }

        if (layoverDuration < 45) {
            tightConnectionCount += 1;
            connectionPenalty += 0.2;
            riskFlags.push(`Very short connection (${layoverDuration} min) may be unrealistic.`);
        } else if (layoverDuration > 360) {
            connectionPenalty += 0.1;
            riskFlags.push(`Long connection (${layoverDuration} min) increases disruption exposure.`);
        } else {
            comfortNotes.push(`Connection at ${current.to} appears feasible (${layoverDuration} min).`);
        }

        if (current.airline.trim().toUpperCase() !== next.airline.trim().toUpperCase()) {
            selfTransferRiskScore += 1;
            riskFlags.push(`Airline change ${current.airline} -> ${next.airline} may imply self-transfer risk.`);
        }
    }

    const totalDuration = totalLayoverMinutes + segmentDurations.reduce((sum, value) => sum + value, 0);

    if (isUnrealisticLongHaulDuration(firstSegment.from, lastSegment.to, totalDuration)) {
        riskFlags.push('Total itinerary duration appears unrealistically short for this long-haul route.');
        connectionPenalty += 0.25;
    }

    const baggageConfidenceScore = typeof input.checkedBaggageKg === 'number'
        ? (typeof input.cabinBaggageKg === 'number' ? 0.95 : 0.8)
        : (typeof input.cabinBaggageKg === 'number' ? 0.6 : 0.45);

    if (typeof input.checkedBaggageKg !== 'number') {
        riskFlags.push('Checked baggage kg missing; baggage confidence reduced.');
    }

    const completenessScore = Math.max(
        0.55,
        1
            - (typeof input.checkedBaggageKg === 'number' ? 0 : 0.1)
            - (typeof input.cabinBaggageKg === 'number' ? 0 : 0.06)
            - (typeof input.refundable === 'boolean' ? 0 : 0.05),
    );

    const realismScore = Math.max(0.42, 1 - connectionPenalty);

    const selfTransferRisk: InputAssessment['selfTransferRisk'] = selfTransferRiskScore >= 2
        ? 'HIGH'
        : selfTransferRiskScore === 1
            ? 'MEDIUM'
            : 'LOW';

    const airlineMix = assessAirlineMix(sortedSegments.map((s) => s.airline));
    if (airlineMix === 'SINGLE_CARRIER') {
        comfortNotes.push('Single-carrier itinerary improves operational consistency.');
    }
    if (airlineMix === 'HIGHLY_FRAGMENTED') {
        riskFlags.push('Multiple carrier mix may reduce reliability consistency across segments.');
    }

    const connectionFeasibility: DerivedStructureMetrics['connectionFeasibility'] = tightConnectionCount === 0
        ? 'GOOD'
        : tightConnectionCount === 1
            ? 'TIGHT'
            : 'RISKY';

    const routeRealism: DerivedStructureMetrics['routeRealism'] = realismScore >= 0.65 ? 'REALISTIC' : 'QUESTIONABLE';

    const unifiedSegments = sortedSegments.map((segment, index): FlightSegment => ({
        from: segment.from,
        to: segment.to,
        departureTime: segment.departureDateTime,
        arrivalTime: segment.arrivalDateTime,
        duration: segmentDurations[index] || 0,
        carrier: segment.airline.slice(0, 3).toUpperCase(),
        marketingCarrier: (segment.marketedAirline || segment.airline).slice(0, 3).toUpperCase(),
        flightNumber: segment.flightNumber,
        aircraft: segment.aircraft,
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
        baggageConfidenceScore,
        airlineReliabilityMix: airlineMix,
    };

    const derived: DerivedStructureMetrics = {
        totalDurationMinutes: totalDuration,
        totalLayoverMinutes,
        connectionCount: stops,
        connectionFeasibility,
        routeRealism,
        airlineReliabilityMix: airlineMix,
        baggageConfidenceScore,
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
        derived,
        extractedSegments: sortedSegments.map((segment) => ({
            from: segment.from,
            to: segment.to,
            departureDateTime: segment.departureDateTime,
            arrivalDateTime: segment.arrivalDateTime,
            airline: segment.airline,
            flightNumber: segment.flightNumber,
            aircraft: segment.aircraft,
            marketedAirline: segment.marketedAirline,
            bookingClass: segment.bookingClass,
        })),
    };
};

const toIsoOrFallback = (value: string | undefined, fallbackMs: number): string => {
    if (value) {
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed)) {
            return new Date(parsed).toISOString();
        }
    }
    return new Date(fallbackMs).toISOString();
};

const buildPasteUnifiedFlight = (input: PasteScoreInput): ItineraryConversionResult => {
    const parsed = parseItineraryText(input.itineraryText);
    const sourceSegments = input.segments && input.segments.length > 0
        ? input.segments
        : parsed.segments.map((segment) => ({
            from: segment.from,
            to: segment.to,
            departureDateTime: segment.departure,
            arrivalDateTime: segment.arrival,
            airline: segment.airline,
            flightNumber: segment.flightNumber,
            aircraft: segment.aircraft,
            tripDirection: segment.tripDirection,
        }));

    const baseMs = Date.now() + 24 * 60 * 60 * 1000;
    const normalizationWarnings: string[] = [];
    const normalizedSegments = sourceSegments.map((segment, index) => {
        const fallbackDeparture = baseMs + index * 4 * 60 * 60 * 1000;
        const departureDateTime = toIsoOrFallback(segment.departureDateTime, fallbackDeparture);
        const arrivalDateTime = toIsoOrFallback(segment.arrivalDateTime, fallbackDeparture + 2 * 60 * 60 * 1000);
        const airline = segment.airline || 'UNKN';
        const flightNumber = segment.flightNumber || `UNKNOWN${index + 1}`;

        if (!segment.departureDateTime || !segment.arrivalDateTime) {
            normalizationWarnings.push(`Segment ${index + 1} had missing times; deterministic fallback times applied for scoring.`);
        }
        if (!segment.flightNumber) {
            normalizationWarnings.push(`Segment ${index + 1} missing flight number; placeholder assigned.`);
        }
        if (!segment.airline) {
            normalizationWarnings.push(`Segment ${index + 1} missing airline; placeholder assigned.`);
        }

        return {
            from: segment.from,
            to: segment.to,
            departureDateTime,
            arrivalDateTime,
            airline,
            flightNumber,
            aircraft: segment.aircraft,
            tripDirection: segment.tripDirection,
        };
    });

    if (!normalizedSegments.length) {
        throw new Error('Unable to parse itinerary segments from pasted text.');
    }

    const inferredTotalPrice = input.price
        ?? parsed.trip.price
        ?? 999;
    const inferredCurrency = input.currency
        ?? parsed.trip.currency
        ?? 'USD';
    const inferredCabin = input.cabin
        ?? parsed.trip.cabin
        ?? 'economy';
    const inferredRefundable = typeof input.refundable === 'boolean'
        ? input.refundable
        : parsed.meta.refundable;

    const detailedInput: DetailedScoreInput = {
        mode: 'detailed',
        totalPrice: inferredTotalPrice,
        currency: inferredCurrency,
        cabin: inferredCabin,
        checkedBaggageKg: typeof input.checkedBaggageKg === 'number'
            ? input.checkedBaggageKg
            : parsed.trip.checkedBaggageKg ?? undefined,
        cabinBaggageKg: typeof input.cabinBaggageKg === 'number'
            ? input.cabinBaggageKg
            : parsed.trip.cabinBaggageKg ?? undefined,
        refundable: inferredRefundable,
        segments: normalizedSegments,
    };

    const base = buildDetailedUnifiedFlight(detailedInput);
    const parseWarnings = [...parsed.warnings, ...normalizationWarnings];
    if (!input.price && !parsed.trip.price) {
        parseWarnings.push('Price missing in text; fallback price baseline applied.');
    }

    const parseConfidence = parsed.confidence;
    const downgradedMode = parseConfidence < 0.6 ? 'quick' : 'detailed';

    return {
        ...base,
        assessment: {
            ...base.assessment,
            mode: downgradedMode,
            promptForDetails: parseWarnings.length > 0 || parseConfidence < 0.7,
            parseWarnings,
            parseConfidence,
            completenessScore: Math.max(0.45, Math.min(base.assessment.completenessScore, parseConfidence + 0.2)),
        },
    };
};

export function itineraryInputToUnifiedFlight(
    input: ItineraryScoreInput,
): ItineraryConversionResult {
    const normalized = itineraryScoreInputSchema.parse(input);

    if (normalized.mode === 'quick') {
        return buildQuickUnifiedFlight(normalized);
    }

    if (normalized.mode === 'paste') {
        return buildPasteUnifiedFlight(normalized);
    }

    return buildDetailedUnifiedFlight(normalized);
}
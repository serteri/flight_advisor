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

const AIRLINE_CODE_TO_NAME: Record<string, string> = {
    SQ: 'SINGAPORE AIRLINES',
    TK: 'TURKISH AIRLINES',
    QR: 'QATAR AIRWAYS',
    BA: 'BRITISH AIRWAYS',
    LH: 'LUFTHANSA',
    EK: 'EMIRATES',
    UA: 'UNITED AIRLINES',
    DL: 'DELTA AIR LINES',
    AA: 'AMERICAN AIRLINES',
    AF: 'AIR FRANCE',
    KL: 'KLM',
};

const AIRLINE_NAME_TO_CODE: Record<string, string> = Object.entries(AIRLINE_CODE_TO_NAME).reduce((acc, [code, name]) => {
    acc[name] = code;
    return acc;
}, {} as Record<string, string>);

const quickScoreInputSchema = z.object({
    mode: z.literal('quick'),
    origin: iataSchema,
    destination: iataSchema,
    departureDate: dateSchema,
    price: z.coerce.number().positive('Price must be greater than 0'),
    currency: z.string().trim().toUpperCase().length(3).default('USD'),
    stops: z.coerce.number().int().min(0).max(4),
    adults: z.coerce.number().int().min(1).max(9).default(1),
    children: z.coerce.number().int().min(0).max(8).default(0),
    infants: z.coerce.number().int().min(0).max(8).default(0),
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
    adults: z.coerce.number().int().min(1).max(9).default(1),
    children: z.coerce.number().int().min(0).max(8).default(0),
    infants: z.coerce.number().int().min(0).max(8).default(0),
    checkedBaggageKg: z.coerce.number().min(0).max(64).optional(),
    cabinBaggageKg: z.coerce.number().min(0).max(20).optional(),
    refundable: z.boolean().optional(),
    segments: z.array(itinerarySegmentSchema).min(1).max(8),
});

const pasteScoreInputSchema = z.object({
    mode: z.literal('paste'),
    itineraryText: z.string().trim().min(20, 'Paste a longer itinerary text'),
    source: z.enum(['parsed_text', 'manual_override']).optional(),
    price: z.coerce.number().positive().optional(),
    currency: z.string().trim().toUpperCase().length(3).optional(),
    cabin: z.enum(['economy', 'premium', 'business', 'first']).optional(),
    adults: z.coerce.number().int().min(1).max(9).default(1),
    children: z.coerce.number().int().min(0).max(8).default(0),
    infants: z.coerce.number().int().min(0).max(8).default(0),
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

export type ItineraryScoreInput = z.input<typeof itineraryScoreInputSchema>;
export type QuickScoreInput = z.infer<typeof quickScoreInputSchema>;
export type DetailedScoreInput = z.infer<typeof detailedScoreInputSchema>;
export type PasteScoreInput = z.infer<typeof pasteScoreInputSchema>;

export type DerivedStructureMetrics = {
    tripType: 'ONE_WAY' | 'ROUND_TRIP';
    totalSegments: number;
    totalDurationMinutes: number;
    totalLayoverMinutes: number;
    outboundDurationMinutes: number;
    inboundDurationMinutes: number;
    connectionCount: number;
    outboundConnectionCount: number;
    inboundConnectionCount: number;
    outboundLayoverMinutes: number;
    inboundLayoverMinutes: number;
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
    priceSource: 'USER_PROVIDED' | 'PARSED_TEXT' | 'UNAVAILABLE';
    livePriceBenchmarkAvailable: boolean;
    priceMissing: boolean;
    baggageUnverified: boolean;
    baggageSource: 'USER_PROVIDED_BAGGAGE' | 'PARSED_BAGGAGE' | 'INFERRED_BAGGAGE' | 'UNKNOWN_BAGGAGE';
    riskFlags: string[];
    comfortNotes: string[];
    promptForDetails: boolean;
    selfTransferRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    baggageConfidenceScore: number;
    airlineReliabilityMix: DerivedStructureMetrics['airlineReliabilityMix'];
    parseWarnings?: string[];
    parseConfidence?: number;
    passengerPricingContext?: {
        adults: number;
        children: number;
        infants: number;
        totalTravelers: number;
        totalPrice: number;
        comparablePerTravelerPrice: number;
        mixedTravelerTypes: boolean;
    };
};

type InternalDetailedInput = Omit<DetailedScoreInput, 'totalPrice'> & {
    totalPrice?: number;
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
    tripDirection?: 'OUTBOUND' | 'INBOUND';
};

export type ItineraryConversionResult = {
    unifiedFlight: UnifiedFlight;
    assessment: InputAssessment;
    derived: DerivedStructureMetrics;
    extractedSegments: ParsedSegmentPreview[];
};

const summarizePassengerPricingContext = (params: {
    totalPrice: number;
    adults: number;
    children?: number;
    infants?: number;
}) => {
    const adults = Math.max(1, params.adults || 1);
    const children = Math.max(0, params.children || 0);
    const infants = Math.max(0, params.infants || 0);
    const totalTravelers = adults + children + infants;
    const equivalentAdults = adults * 1.0 + children * 0.75 + infants * 0.25;
    const comparablePerTravelerPrice = equivalentAdults > 0
        ? Number((params.totalPrice / equivalentAdults).toFixed(2))
        : params.totalPrice;

    return {
        adults,
        children,
        infants,
        totalTravelers,
        totalPrice: params.totalPrice,
        comparablePerTravelerPrice,
        mixedTravelerTypes: children > 0 || infants > 0,
    };
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

const buildBaggageForDetailed = (input: InternalDetailedInput): BaggageAllowance | undefined => {
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

const buildPoliciesForDetailed = (input: InternalDetailedInput): FlightPolicies | undefined => {
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

const deriveTripStructure = (segments: Array<{ tripDirection?: 'OUTBOUND' | 'INBOUND' }>): {
    tripType: 'ONE_WAY' | 'ROUND_TRIP';
    outboundConnectionCount: number;
    inboundConnectionCount: number;
    connectionCount: number;
} => {
    const inboundSegments = segments.filter((segment) => segment.tripDirection === 'INBOUND');
    const outboundSegments = segments.filter((segment) => segment.tripDirection !== 'INBOUND');
    const tripType: 'ONE_WAY' | 'ROUND_TRIP' = inboundSegments.length > 0 ? 'ROUND_TRIP' : 'ONE_WAY';
    const outboundConnectionCount = Math.max(0, outboundSegments.length - 1);
    const inboundConnectionCount = tripType === 'ROUND_TRIP' ? Math.max(0, inboundSegments.length - 1) : 0;

    return {
        tripType,
        outboundConnectionCount,
        inboundConnectionCount,
        connectionCount: outboundConnectionCount + inboundConnectionCount,
    };
};

const detectRoundTripSplitIndex = (segments: Array<{
    from: string;
    to: string;
    departureDateTime: string;
    arrivalDateTime: string;
    tripDirection?: 'OUTBOUND' | 'INBOUND';
}>): number | null => {
    if (segments.length < 2) return null;

    const firstInboundIndex = segments.findIndex((segment) => segment.tripDirection === 'INBOUND');
    if (firstInboundIndex > 0) {
        return firstInboundIndex - 1;
    }

    const looksLikeClosedLoop = segments[0].from === segments[segments.length - 1].to;
    if (!looksLikeClosedLoop) return null;

    let maxLayover = -1;
    let splitIndex = 0;
    for (let i = 0; i < segments.length - 1; i += 1) {
        const layover = durationBetween(segments[i].arrivalDateTime, segments[i + 1].departureDateTime);
        if (layover > maxLayover) {
            maxLayover = layover;
            splitIndex = i;
        }
    }

    return splitIndex;
};

const isUnknownAirline = (value?: string): boolean => !value || /^UNKN$/i.test(value.trim());

const isUnknownFlightNumber = (value?: string): boolean => !value || /^UNKNOWN\d+$/i.test(value.trim());

const deriveAirlineFromFlightNumber = (flightNumber?: string): string | undefined => {
    if (!flightNumber || isUnknownFlightNumber(flightNumber)) return undefined;
    const match = flightNumber.toUpperCase().match(/^([A-Z]{2,3})\d{1,4}$/);
    return match?.[1];
};

const normalizeAirlineName = (value?: string, flightNumber?: string): string => {
    const raw = (value || '').trim();

    // Flight number prefix is the strongest airline signal — derive it first
    const derivedCode = deriveAirlineFromFlightNumber(flightNumber);
    const derivedName = derivedCode ? (AIRLINE_CODE_TO_NAME[derivedCode] || null) : null;

    if (!raw) {
        return derivedName || derivedCode || 'UNKN';
    }

    const upper = raw.toUpperCase();
    // If raw is a known IATA code, expand it to the full name
    if (AIRLINE_CODE_TO_NAME[upper]) {
        return AIRLINE_CODE_TO_NAME[upper];
    }

    // When flight number maps to a known airline, it overrides free-form text.
    // This prevents "TURKISH AIRLINES" from sticking to an SQ-prefixed flight number.
    if (derivedName) {
        return derivedName;
    }

    return raw;
};

const deriveCarrierCode = (params: { flightNumber?: string; airline?: string; marketedAirline?: string }): string => {
    const fromFlight = deriveAirlineFromFlightNumber(params.flightNumber);
    if (fromFlight) return fromFlight;

    const candidates = [params.marketedAirline, params.airline].filter(Boolean) as string[];
    for (const candidate of candidates) {
        const upper = candidate.trim().toUpperCase();
        if (/^[A-Z]{2,3}$/.test(upper)) {
            return upper;
        }
        if (AIRLINE_NAME_TO_CODE[upper]) {
            return AIRLINE_NAME_TO_CODE[upper];
        }
    }

    return 'UNK';
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
    const passengerPricingContext = summarizePassengerPricingContext({
        totalPrice: input.price,
        adults: input.adults,
        children: input.children,
        infants: input.infants,
    });

    const assessment: InputAssessment = {
        mode: 'quick',
        completenessScore: input.airline ? 0.58 : 0.5,
        realismScore: 0.45,
        priceContextAvailable: true,
        priceSource: 'USER_PROVIDED',
        livePriceBenchmarkAvailable: false,
        priceMissing: false,
        baggageUnverified: false,
        baggageSource: 'UNKNOWN_BAGGAGE',
        riskFlags,
        comfortNotes: [],
        promptForDetails: true,
        selfTransferRisk: 'MEDIUM',
        baggageConfidenceScore,
        airlineReliabilityMix: airlineMix,
        passengerPricingContext,
    };

    const derived: DerivedStructureMetrics = {
        tripType: 'ONE_WAY',
        totalSegments: 1,
        totalDurationMinutes: duration,
        totalLayoverMinutes: input.stops * DEFAULT_LAYOVER_DURATION_MINUTES,
        outboundDurationMinutes: duration,
        inboundDurationMinutes: 0,
        connectionCount: input.stops,
        outboundConnectionCount: input.stops,
        inboundConnectionCount: 0,
        outboundLayoverMinutes: input.stops * DEFAULT_LAYOVER_DURATION_MINUTES,
        inboundLayoverMinutes: 0,
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
    input: InternalDetailedInput,
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
    let outboundLayoverMinutes = 0;
    let inboundLayoverMinutes = 0;
    let tightConnectionCount = 0;
    const roundTripSplitIndex = detectRoundTripSplitIndex(sortedSegments);

    for (let i = 0; i < sortedSegments.length - 1; i += 1) {
        const current = sortedSegments[i];
        const next = sortedSegments[i + 1];
        const isDirectionBoundary =
            (roundTripSplitIndex !== null && i === roundTripSplitIndex)
            || (current.tripDirection && next.tripDirection && current.tripDirection !== next.tripDirection);

        if (isDirectionBoundary) {
            comfortNotes.push(`Detected ${next.tripDirection?.toLowerCase()} leg boundary; skipping connection-risk checks across trip directions.`);
            continue;
        }

        const layoverDuration = durationBetween(current.arrivalDateTime, next.departureDateTime);
        totalLayoverMinutes += layoverDuration;
        const inInboundLeg = roundTripSplitIndex !== null
            ? i > roundTripSplitIndex
            : current.tripDirection === 'INBOUND';
        if (inInboundLeg) {
            inboundLayoverMinutes += layoverDuration;
        } else {
            outboundLayoverMinutes += layoverDuration;
        }
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

    const hasPrice = typeof input.totalPrice === 'number' && Number.isFinite(input.totalPrice) && input.totalPrice > 0;
    const baggageConfidenceScore = typeof input.checkedBaggageKg === 'number'
        ? (typeof input.cabinBaggageKg === 'number' ? 0.95 : 0.8)
        : (typeof input.cabinBaggageKg === 'number' ? 0.6 : 0.45);
    const passengerPricingContext = hasPrice
        ? summarizePassengerPricingContext({
            totalPrice: input.totalPrice as number,
            adults: input.adults,
            children: input.children,
            infants: input.infants,
        })
        : undefined;

    if (typeof input.checkedBaggageKg !== 'number') {
        riskFlags.push('Checked baggage kg missing; baggage confidence reduced.');
    }
    if (!hasPrice) {
        riskFlags.push('Price missing; fare benchmark scoring disabled.');
    }
    if (passengerPricingContext && passengerPricingContext.totalTravelers > 1) {
        comfortNotes.push(`Fare reflects ${passengerPricingContext.totalTravelers} travelers; benchmark comparison uses an estimated per-traveler view.`);
    }
    if (passengerPricingContext?.mixedTravelerTypes) {
        riskFlags.push('Mixed traveler types reduce direct comparability to standard adult fare benchmarks.');
    }

    const completenessScore = Math.max(
        0.55,
        1
            - (typeof input.checkedBaggageKg === 'number' ? 0 : 0.1)
            - (typeof input.cabinBaggageKg === 'number' ? 0 : 0.06)
            - (hasPrice ? 0 : 0.14)
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
    const splitIndex = roundTripSplitIndex;
    const tripStructure = splitIndex !== null
        ? {
            tripType: 'ROUND_TRIP' as const,
            outboundConnectionCount: Math.max(0, splitIndex),
            inboundConnectionCount: Math.max(0, sortedSegments.length - (splitIndex + 2)),
            connectionCount: Math.max(0, sortedSegments.length - 2),
        }
        : deriveTripStructure(sortedSegments);

    const outboundSegments = splitIndex !== null
        ? sortedSegments.slice(0, splitIndex + 1)
        : sortedSegments.filter((segment) => segment.tripDirection !== 'INBOUND');
    const inboundSegments = splitIndex !== null
        ? sortedSegments.slice(splitIndex + 1)
        : sortedSegments.filter((segment) => segment.tripDirection === 'INBOUND');

    const outboundDurationMinutes = outboundSegments.length > 0
        ? durationBetween(
            outboundSegments[0].departureDateTime,
            outboundSegments[outboundSegments.length - 1].arrivalDateTime,
        )
        : totalDuration;
    const inboundDurationMinutes = inboundSegments.length > 0
        ? durationBetween(
            inboundSegments[0].departureDateTime,
            inboundSegments[inboundSegments.length - 1].arrivalDateTime,
        )
        : 0;

    if (splitIndex !== null) {
        totalLayoverMinutes = outboundLayoverMinutes + inboundLayoverMinutes;
    }
    const totalDurationMinutes = tripStructure.tripType === 'ROUND_TRIP'
        ? outboundDurationMinutes + inboundDurationMinutes
        : totalDuration;

    const unifiedSegments = sortedSegments.map((segment, index): FlightSegment => ({
        from: segment.from,
        to: segment.to,
        departureTime: segment.departureDateTime,
        arrivalTime: segment.arrivalDateTime,
        duration: segmentDurations[index] || 0,
        carrier: deriveCarrierCode({
            flightNumber: segment.flightNumber,
            airline: segment.airline,
            marketedAirline: segment.marketedAirline,
        }),
        marketingCarrier: deriveCarrierCode({
            flightNumber: segment.flightNumber,
            airline: segment.marketedAirline || segment.airline,
            marketedAirline: segment.marketedAirline,
        }),
        flightNumber: segment.flightNumber,
        aircraft: segment.aircraft,
    }));

    const assessment: InputAssessment = {
        mode: 'detailed',
        completenessScore,
        realismScore,
        priceContextAvailable: hasPrice,
        priceSource: hasPrice ? 'USER_PROVIDED' : 'UNAVAILABLE',
        livePriceBenchmarkAvailable: false,
        priceMissing: !hasPrice,
        baggageUnverified: false,
        baggageSource: typeof input.checkedBaggageKg === 'number'
            ? 'USER_PROVIDED_BAGGAGE'
            : 'UNKNOWN_BAGGAGE',
        riskFlags,
        comfortNotes,
        promptForDetails: false,
        selfTransferRisk,
        baggageConfidenceScore,
        airlineReliabilityMix: airlineMix,
        passengerPricingContext,
    };

    const derived: DerivedStructureMetrics = {
        tripType: tripStructure.tripType,
        totalSegments: sortedSegments.length,
        totalDurationMinutes,
        totalLayoverMinutes,
        outboundDurationMinutes,
        inboundDurationMinutes,
        connectionCount: tripStructure.connectionCount,
        outboundConnectionCount: tripStructure.outboundConnectionCount,
        inboundConnectionCount: tripStructure.inboundConnectionCount,
        outboundLayoverMinutes,
        inboundLayoverMinutes,
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
            airline: normalizeAirlineName(firstSegment.airline, firstSegment.flightNumber),
            operatingAirline: normalizeAirlineName(firstSegment.airline, firstSegment.flightNumber),
            flightNumber: firstSegment.flightNumber,
            stops,
            cabinClass: normalizeCabinClass(input.cabin),
            segments: unifiedSegments as [FlightSegment, ...FlightSegment[]],
            layovers: layovers.length ? layovers : undefined,
            price: hasPrice ? (input.totalPrice as number) : 0,
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
            marketedAirline: segment.marketedAirline
                ? normalizeAirlineName(segment.marketedAirline, segment.flightNumber)
                : (!isUnknownAirline(segment.airline) ? normalizeAirlineName(segment.airline, segment.flightNumber) : undefined),
            bookingClass: segment.bookingClass,
            tripDirection: segment.tripDirection,
        })),
    };
};

const parseIsoOrUndefined = (value?: string): string | undefined => {
    if (!value) return undefined;
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return undefined;
    return new Date(parsed).toISOString();
};

const inferMissingSegmentTimes = (segments: Array<{
    departureDateTime?: string;
    arrivalDateTime?: string;
}>): {
    normalized: Array<{ departureDateTime: string; arrivalDateTime: string; dateSource: 'EXPLICIT_DATE' | 'INFERRED_DATE' | 'FALLBACK_DATE' }>;
    usedGlobalFallback: boolean;
} => {
    const parsed = segments.map((segment) => ({
        departure: parseIsoOrUndefined(segment.departureDateTime),
        arrival: parseIsoOrUndefined(segment.arrivalDateTime),
    }));
    const hasAnyValidDate = parsed.some((segment) => !!segment.departure || !!segment.arrival);

    const baseMs = Date.now() + 24 * 60 * 60 * 1000;
    const normalized = parsed.map((segment, index) => {
        if (!hasAnyValidDate) {
            const fallbackDeparture = new Date(baseMs + index * 4 * 60 * 60 * 1000).toISOString();
            const fallbackArrival = new Date(baseMs + index * 4 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString();
            return {
                departureDateTime: fallbackDeparture,
                arrivalDateTime: fallbackArrival,
                dateSource: 'FALLBACK_DATE' as const,
            };
        }

        const previous = index > 0 ? parsed[index - 1] : undefined;
        const next = index + 1 < parsed.length ? parsed[index + 1] : undefined;

        let departureDateTime = segment.departure;
        let arrivalDateTime = segment.arrival;
        let dateSource: 'EXPLICIT_DATE' | 'INFERRED_DATE' | 'FALLBACK_DATE' = 'EXPLICIT_DATE';

        if (!departureDateTime) {
            if (previous?.arrival && Number.isFinite(Date.parse(previous.arrival))) {
                departureDateTime = new Date(Date.parse(previous.arrival) + 90 * 60 * 1000).toISOString();
            } else if (next?.departure && Number.isFinite(Date.parse(next.departure))) {
                departureDateTime = new Date(Date.parse(next.departure) - 2 * 60 * 60 * 1000).toISOString();
            } else if (arrivalDateTime) {
                departureDateTime = new Date(Date.parse(arrivalDateTime) - 2 * 60 * 60 * 1000).toISOString();
            }
            dateSource = 'INFERRED_DATE';
        }

        if (!arrivalDateTime) {
            if (departureDateTime) {
                arrivalDateTime = new Date(Date.parse(departureDateTime) + 2 * 60 * 60 * 1000).toISOString();
            } else if (next?.departure) {
                arrivalDateTime = new Date(Date.parse(next.departure) - 30 * 60 * 1000).toISOString();
            }
            dateSource = 'INFERRED_DATE';
        }

        // Defensive: this branch should be unreachable when at least one valid date exists,
        // but keep a deterministic fallback guard for parser safety.
        if (!departureDateTime || !arrivalDateTime) {
            const fallbackDeparture = new Date(baseMs + index * 4 * 60 * 60 * 1000).toISOString();
            const fallbackArrival = new Date(baseMs + index * 4 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString();
            return {
                departureDateTime: fallbackDeparture,
                arrivalDateTime: fallbackArrival,
                dateSource: 'FALLBACK_DATE' as const,
            };
        }

        if (Date.parse(arrivalDateTime) <= Date.parse(departureDateTime)) {
            arrivalDateTime = new Date(Date.parse(departureDateTime) + 2 * 60 * 60 * 1000).toISOString();
            dateSource = dateSource === 'EXPLICIT_DATE' ? 'INFERRED_DATE' : dateSource;
        }

        return {
            departureDateTime,
            arrivalDateTime,
            dateSource,
        };
    });

    return {
        normalized,
        usedGlobalFallback: !hasAnyValidDate,
    };
};

const buildPasteUnifiedFlight = (input: PasteScoreInput): ItineraryConversionResult => {
    if (input.source === 'manual_override' && input.segments && input.segments.length > 0) {
        const normalizedSegments = input.segments.map((segment, index) => {
            const flightNumber = segment.flightNumber || `UNKNOWN${index + 1}`;
            return {
                from: segment.from,
                to: segment.to,
                departureDateTime: segment.departureDateTime,
                arrivalDateTime: segment.arrivalDateTime,
                airline: normalizeAirlineName(segment.airline || deriveAirlineFromFlightNumber(flightNumber), flightNumber),
                flightNumber,
                aircraft: segment.aircraft,
                marketedAirline: segment.marketedAirline,
                bookingClass: segment.bookingClass,
                tripDirection: segment.tripDirection,
            };
        });

        const detailedInput: InternalDetailedInput = {
            mode: 'detailed',
            totalPrice: input.price,
            currency: input.currency ?? 'USD',
            cabin: input.cabin ?? 'economy',
            adults: input.adults,
            children: input.children,
            infants: input.infants,
            checkedBaggageKg: input.checkedBaggageKg,
            cabinBaggageKg: input.cabinBaggageKg,
            refundable: input.refundable,
            segments: normalizedSegments,
        };

        const base = buildDetailedUnifiedFlight(detailedInput);
        const parseWarnings = ['Using manually edited segments from UI.'];

        if (!input.price) {
            parseWarnings.push('Price missing in manual override; fare benchmark scoring disabled.');
        }

        return {
            ...base,
            extractedSegments: base.extractedSegments.map((segment) => ({
                ...segment,
                airline: /^UNKN$/i.test(segment.airline) ? '' : normalizeAirlineName(segment.airline, segment.flightNumber),
                flightNumber: /^UNKNOWN\d+$/i.test(segment.flightNumber) ? '' : segment.flightNumber,
                marketedAirline: segment.marketedAirline
                    ? normalizeAirlineName(segment.marketedAirline, segment.flightNumber)
                    : (!isUnknownAirline(segment.airline) ? normalizeAirlineName(segment.airline, segment.flightNumber) : undefined),
                bookingClass: segment.bookingClass || undefined,
            })),
            assessment: {
                ...base.assessment,
                mode: 'detailed',
                promptForDetails: parseWarnings.length > 0,
                parseWarnings,
                parseConfidence: 1,
                priceContextAvailable: !!input.price,
                priceSource: input.price ? 'USER_PROVIDED' : 'UNAVAILABLE',
                livePriceBenchmarkAvailable: false,
                priceMissing: !input.price,
                baggageSource: typeof input.checkedBaggageKg === 'number'
                    ? 'USER_PROVIDED_BAGGAGE'
                    : 'UNKNOWN_BAGGAGE',
            },
        };
    }

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
            marketedAirline: undefined,
            bookingClass: undefined,
            tripDirection: segment.tripDirection,
        }));

    const normalizationWarnings: string[] = [];
    const normalizedTimes = inferMissingSegmentTimes(sourceSegments);
    const normalizedSegments = sourceSegments.map((segment, index) => {
        const departureDateTime = normalizedTimes.normalized[index].departureDateTime;
        const arrivalDateTime = normalizedTimes.normalized[index].arrivalDateTime;
        const airline = normalizeAirlineName(segment.airline || deriveAirlineFromFlightNumber(segment.flightNumber), segment.flightNumber);
        const flightNumber = segment.flightNumber || `UNKNOWN${index + 1}`;

        return {
            from: segment.from,
            to: segment.to,
            departureDateTime,
            arrivalDateTime,
            airline,
            flightNumber,
            aircraft: segment.aircraft,
            marketedAirline: segment.marketedAirline,
            bookingClass: segment.bookingClass,
            tripDirection: segment.tripDirection,
        };
    });

    for (let i = 0; i < normalizedSegments.length - 1; i += 1) {
        const current = normalizedSegments[i];
        const next = normalizedSegments[i + 1];
        const sameDirection = current.tripDirection === next.tripDirection || !current.tripDirection || !next.tripDirection;
        if (!sameDirection) continue;

        if (isUnknownAirline(current.airline) && !isUnknownAirline(next.airline) && current.to === next.from) {
            current.airline = next.airline;
        }
    }

    normalizedSegments.forEach((segment, index) => {
        const source = sourceSegments[index];
        const sourceClass = normalizedTimes.normalized[index].dateSource;
        if (sourceClass === 'INFERRED_DATE') {
            normalizationWarnings.push(`Segment ${index + 1} had incomplete times; INFERRED_DATE timeline applied from nearby segment context.`);
        }
        if (sourceClass === 'FALLBACK_DATE') {
            normalizationWarnings.push(`Segment ${index + 1} missing valid date context; FALLBACK_DATE timeline applied.`);
        }
        if (!source?.flightNumber) {
            normalizationWarnings.push(`Segment ${index + 1} missing flight number; placeholder assigned.`);
        }
        if (isUnknownAirline(segment.airline)) {
            normalizationWarnings.push(`Segment ${index + 1} missing airline; placeholder assigned.`);
        }

        if (!segment.marketedAirline && !isUnknownAirline(segment.airline)) {
            segment.marketedAirline = normalizeAirlineName(segment.airline, segment.flightNumber);
        }
    });

    if (!normalizedSegments.length) {
        throw new Error('Unable to parse itinerary segments from pasted text.');
    }

    if (normalizedTimes.usedGlobalFallback) {
        normalizationWarnings.push('No valid explicit date detected in pasted text; fallback timeline used for all segments.');
    }

    const inferredTotalPrice = input.price
        ?? parsed.trip.price;
    const inferredCurrency = input.currency
        ?? parsed.trip.currency
        ?? 'USD';
    const inferredCabin = input.cabin
        ?? parsed.trip.cabin
        ?? 'economy';
    const inferredRefundable = typeof input.refundable === 'boolean'
        ? input.refundable
        : parsed.meta.refundable;

    const parserCheckedBaggageEvidence = parsed.trip.checkedBaggageEvidence;
    const parsedCheckedBaggageIsVerified = parserCheckedBaggageEvidence === 'fare_allowance';
    const inferredCheckedBaggageKg = Number.isFinite(input.checkedBaggageKg)
        ? input.checkedBaggageKg
        : parsedCheckedBaggageIsVerified
            ? parsed.trip.checkedBaggageKg ?? undefined
            : undefined;

    const detailedInput: InternalDetailedInput = {
        mode: 'detailed',
        totalPrice: inferredTotalPrice,
        currency: inferredCurrency,
        cabin: inferredCabin,
        adults: input.adults ?? parsed.trip.adults ?? 1,
        children: input.children ?? parsed.trip.children ?? 0,
        infants: input.infants ?? parsed.trip.infants ?? 0,
        checkedBaggageKg: inferredCheckedBaggageKg,
        cabinBaggageKg: typeof input.cabinBaggageKg === 'number'
            ? input.cabinBaggageKg
            : parsed.trip.cabinBaggageKg ?? undefined,
        refundable: inferredRefundable,
        segments: normalizedSegments,
    };

    const base = buildDetailedUnifiedFlight(detailedInput);
    const parseWarnings = [...parsed.warnings, ...normalizationWarnings];
    const adjustedWarnings = (input.price && !parsed.trip.price)
        ? parseWarnings.map((warning) => warning === 'Price not detected from pasted text.'
            ? 'Price not detected in pasted text; manual price override used.'
            : warning)
        : parseWarnings;

    if (!input.price && !parsed.trip.price) {
        adjustedWarnings.push('Price missing in text; fare benchmark scoring disabled.');
    }

    if (!Number.isFinite(input.checkedBaggageKg) && parsed.trip.checkedBaggageKg !== null && !parsedCheckedBaggageIsVerified) {
        adjustedWarnings.push(`Checked baggage detected (${parsed.trip.checkedBaggageKg}kg) from passenger details and is not fare-confirmed.`);
    }

    const parseConfidence = parsed.confidence;
    const downgradedMode = parseConfidence < 0.6 ? 'quick' : 'detailed';

    return {
        ...base,
        extractedSegments: base.extractedSegments.map((segment) => ({
            ...segment,
            airline: /^UNKN$/i.test(segment.airline) ? '' : normalizeAirlineName(segment.airline, segment.flightNumber),
            flightNumber: /^UNKNOWN\d+$/i.test(segment.flightNumber) ? '' : segment.flightNumber,
            marketedAirline: segment.marketedAirline
                ? normalizeAirlineName(segment.marketedAirline, segment.flightNumber)
                : (!isUnknownAirline(segment.airline) ? normalizeAirlineName(segment.airline, segment.flightNumber) : undefined),
            bookingClass: segment.bookingClass || undefined,
        })),
        assessment: {
            ...base.assessment,
            mode: downgradedMode,
            promptForDetails: adjustedWarnings.length > 0 || parseConfidence < 0.7,
            parseWarnings: adjustedWarnings,
            parseConfidence,
            priceContextAvailable: !!inferredTotalPrice,
            priceSource: input.price
                ? 'USER_PROVIDED'
                : parsed.trip.price
                    ? 'PARSED_TEXT'
                    : 'UNAVAILABLE',
            livePriceBenchmarkAvailable: false,
            priceMissing: !inferredTotalPrice,
            baggageUnverified: !Number.isFinite(input.checkedBaggageKg)
                && parsed.trip.checkedBaggageKg !== null
                && !parsedCheckedBaggageIsVerified,
            baggageSource: Number.isFinite(input.checkedBaggageKg)
                ? 'USER_PROVIDED_BAGGAGE'
                : parsed.trip.checkedBaggageKg !== null
                    ? (parsedCheckedBaggageIsVerified ? 'PARSED_BAGGAGE' : 'INFERRED_BAGGAGE')
                    : 'UNKNOWN_BAGGAGE',
            baggageConfidenceScore: !Number.isFinite(input.checkedBaggageKg)
                && parsed.trip.checkedBaggageKg !== null
                && !parsedCheckedBaggageIsVerified
                ? Math.min(base.assessment.baggageConfidenceScore, 0.55)
                : base.assessment.baggageConfidenceScore,
            comfortNotes: !Number.isFinite(input.checkedBaggageKg)
                && parsed.trip.checkedBaggageKg !== null
                && !parsedCheckedBaggageIsVerified
                ? [
                    ...base.assessment.comfortNotes,
                    `Checked baggage detected (${parsed.trip.checkedBaggageKg}kg) but not fare-confirmed.`,
                ]
                : base.assessment.comfortNotes,
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
/**
 * PHASE 2 — SAFE MIGRATION ADAPTER
 *
 * Pure transformation: FlightResult → UnifiedFlight
 *
 * CONTRACT:
 *   - This function is READ-ONLY. It never mutates the input FlightResult.
 *   - It normalizes provider-specific segment shapes into canonical FlightSegment.
 *   - It maps legacy field names (departTime, arriveTime) to canonical names
 *     (departureTime, arrivalTime).
 *   - It extracts baggage and policy data from the FlightResult's various fields
 *     into the UnifiedFlight's structured BaggageAllowance and FlightPolicies.
 *   - All providers (duffel, kiwi, priceline, rapidapi) are handled.
 *
 * USAGE:
 *   import { toUnifiedFlight, toUnifiedFlights } from '@/lib/adapters/toUnifiedFlight';
 *   const unified = toUnifiedFlight(legacyFlight);
 *   const batch   = toUnifiedFlights(legacyFlights);
 *
 * DOES NOT:
 *   - Replace FlightResult anywhere
 *   - Affect runtime outputs
 *   - Modify scoring logic
 *   - Touch provider mappers
 */

import type { FlightResult, FlightSource } from '@/types/hybridFlight';
import type {
    UnifiedFlight,
    UnifiedFlightSource,
    FlightSegment,
    FlightLayover,
    BaggageAllowance,
    FlightPolicies,
    CabinClass,
} from '@/types/unifiedFlight';

// ── Source Mapping ─────────────────────────────────────────────────────────────

const VALID_SOURCES: Set<UnifiedFlightSource> = new Set([
    'duffel',
    'priceline',
    'kiwi',
    'rapidapi',
]);

/**
 * Validate that a FlightSource is a valid UnifiedFlightSource.
 * If not (should never happen given the type union), defaults to 'duffel'.
 */
function mapSource(source: FlightSource): UnifiedFlightSource {
    const lower = String(source || '').toLowerCase() as UnifiedFlightSource;
    return VALID_SOURCES.has(lower) ? lower : 'duffel';
}

// ── Cabin Class ───────────────────────────────────────────────────────────────

function mapCabinClass(value: string | undefined): CabinClass {
    const normalized = String(value || '').toLowerCase();
    if (normalized === 'business') return 'business';
    if (normalized === 'first') return 'first';
    if (normalized === 'premium' || normalized === 'premium_economy') return 'premium';
    return 'economy';
}

// ── Segment Normalization ─────────────────────────────────────────────────────
//
// Each provider has a different segment shape. This normalizer handles ALL known
// field name variations without knowing which provider produced the segment.
// This is defensive — it tries every known field name in priority order.

function normalizeSegment(raw: any, fallbackAirline: string): FlightSegment {
    // ── From / To ────────────────────────────────────────────────────────────
    const from = String(
        raw?.from ||
        raw?.origin?.iata_code || raw?.origin?.iataCode || raw?.origin ||
        raw?.departureAirportCode || raw?.departure_airport_code ||
        ''
    ).toUpperCase();

    const to = String(
        raw?.to ||
        raw?.destination?.iata_code || raw?.destination?.iataCode || raw?.destination ||
        raw?.arrivalAirportCode || raw?.arrival_airport_code ||
        ''
    ).toUpperCase();

    // ── Departure / Arrival Times ────────────────────────────────────────────
    const departureTime = String(
        raw?.departureTime || raw?.departure || raw?.departing_at || raw?.departure_time ||
        raw?.departureDateTime || raw?.departInfo?.time?.dateTime ||
        ''
    );

    const arrivalTime = String(
        raw?.arrivalTime || raw?.arrival || raw?.arriving_at || raw?.arrival_time ||
        raw?.arrivalDateTime || raw?.arrivalInfo?.time?.dateTime ||
        ''
    );

    // ── Duration ─────────────────────────────────────────────────────────────
    let duration = Number(raw?.duration || 0);
    if (duration <= 0 && departureTime && arrivalTime) {
        try {
            const depMs = new Date(departureTime).getTime();
            const arrMs = new Date(arrivalTime).getTime();
            if (Number.isFinite(depMs) && Number.isFinite(arrMs) && arrMs > depMs) {
                duration = Math.round((arrMs - depMs) / 60000);
            }
        } catch { /* fallback to 0 */ }
    }

    // ── Carrier ──────────────────────────────────────────────────────────────
    const carrier = String(
        raw?.carrier ||
        raw?.operatingAirlineCode || raw?.operating_carrier?.iata_code ||
        raw?.marketingAirlineCode || raw?.marketing_carrier?.iata_code ||
        raw?.carrierCode ||
        ''
    ).toUpperCase();

    const marketingCarrier = String(
        raw?.marketingAirlineCode || raw?.marketing_carrier?.iata_code ||
        raw?.marketingCarrier ||
        ''
    ).toUpperCase() || undefined;

    // ── Flight Number ────────────────────────────────────────────────────────
    const flightNumber = String(
        raw?.flightNumber || raw?.flight_no || raw?.flightNo ||
        raw?.flightNumberText ||
        ''
    );

    // ── Aircraft ─────────────────────────────────────────────────────────────
    const aircraft = String(
        raw?.aircraft || raw?.aircraft_type || raw?.equipment ||
        raw?.operating_aircraft ||
        ''
    ) || undefined;

    return {
        from,
        to,
        departureTime,
        arrivalTime,
        duration: Math.max(0, duration),
        carrier: carrier || fallbackAirline.substring(0, 2).toUpperCase(),
        ...(marketingCarrier ? { marketingCarrier } : {}),
        flightNumber: flightNumber || 'N/A',
        ...(aircraft ? { aircraft } : {}),
    };
}

// ── Layover Normalization ─────────────────────────────────────────────────────

function normalizeLayovers(raw: FlightResult['layovers']): FlightLayover[] | undefined {
    if (!Array.isArray(raw) || raw.length === 0) return undefined;

    return raw.map((lay) => ({
        airport: String(lay.airport || '').toUpperCase(),
        ...(lay.city ? { city: lay.city } : {}),
        duration: Math.max(0, Number(lay.duration || 0)),
    }));
}

// ── Baggage Normalization ─────────────────────────────────────────────────────

function normalizeBaggage(flight: FlightResult): BaggageAllowance | undefined {
    const checkedKg = Number(flight.policies?.baggageKg || 0);
    const cabinKg = Number(flight.policies?.cabinBagKg || 0);
    const baggageType = String(flight.baggage || '').toLowerCase();
    const hasChecked = checkedKg > 0 || baggageType === 'checked';

    // If we have absolutely no baggage info, return undefined
    if (checkedKg <= 0 && cabinKg <= 0 && !baggageType) return undefined;

    return {
        included: hasChecked,
        ...(hasChecked || checkedKg > 0
            ? {
                  checked: {
                      ...(checkedKg > 0 ? { kg: checkedKg } : {}),
                      label: checkedKg > 0
                          ? `${checkedKg}kg`
                          : (flight.baggageSummary?.checked || 'Included'),
                  },
              }
            : {
                  checked: {
                      label: 'Not included',
                  },
              }
        ),
        ...(cabinKg > 0
            ? {
                  cabin: {
                      kg: cabinKg,
                      label: `${cabinKg}kg`,
                  },
              }
            : {}
        ),
    };
}

// ── Policies Normalization ────────────────────────────────────────────────────

function normalizePolicies(flight: FlightResult): FlightPolicies | undefined {
    const policies = flight.policies;
    if (!policies) return undefined;

    // Only include if we have meaningful policy data beyond baggage weights
    if (policies.refundable === undefined && policies.changeAllowed === undefined) {
        return undefined;
    }

    return {
        refundable: Boolean(policies.refundable),
        changeAllowed: Boolean(policies.changeAllowed),
        ...(policies.changeFee ? { changeFee: policies.changeFee } : {}),
    };
}

// ── Core Adapter ──────────────────────────────────────────────────────────────

/**
 * Convert a single FlightResult to UnifiedFlight.
 *
 * This is a PURE function — no side effects, no mutations.
 * The input FlightResult is never modified.
 */
export function toUnifiedFlight(flight: FlightResult): UnifiedFlight {
    const source = mapSource(flight.source);
    const airline = String(flight.airline || 'Unknown');

    // ── Segments ─────────────────────────────────────────────────────────────
    // Phase 1 normalized Kiwi + Duffel segments. Priceline has its own shape.
    // This adapter handles ALL shapes via the defensive normalizeSegment().
    const rawSegments = Array.isArray(flight.segments) ? flight.segments : [];

    let normalizedSegments: FlightSegment[];
    if (rawSegments.length > 0) {
        normalizedSegments = rawSegments.map((seg) => normalizeSegment(seg, airline));
    } else {
        // Fallback: create a single synthetic segment from the flight-level data
        normalizedSegments = [
            {
                from: String(flight.from || '').toUpperCase(),
                to: String(flight.to || '').toUpperCase(),
                departureTime: String(flight.departTime || ''),
                arrivalTime: String(flight.arriveTime || ''),
                duration: Math.max(0, Number(flight.duration || 0)),
                carrier: airline.substring(0, 2).toUpperCase(),
                flightNumber: String(flight.flightNumber || 'N/A'),
                ...(flight.aircraft ? { aircraft: flight.aircraft } : {}),
            },
        ];
    }

    // TypeScript tuple: [FlightSegment, ...FlightSegment[]]
    const segments: [FlightSegment, ...FlightSegment[]] = [
        normalizedSegments[0],
        ...normalizedSegments.slice(1),
    ];

    // ── Journey-level fields ─────────────────────────────────────────────────
    const from = String(flight.from || '').toUpperCase();
    const to = String(flight.to || '').toUpperCase();
    const departureTime = String(flight.departTime || '');
    const arrivalTime = String(flight.arriveTime || '');
    const duration = Math.max(0, Number(flight.duration || 0));
    const stops = Math.max(0, Number(flight.stops || 0));

    // ── Build UnifiedFlight ──────────────────────────────────────────────────
    const unified: UnifiedFlight = {
        // Identity
        id: String(flight.id || ''),
        source,

        // Route
        from,
        to,
        departureTime,
        arrivalTime,
        duration,

        // Carrier
        airline,
        ...(flight.operatingAirline ? { operatingAirline: flight.operatingAirline } : {}),
        ...(flight.airlineLogo ? { airlineLogo: flight.airlineLogo } : {}),
        flightNumber: String(flight.flightNumber || 'N/A'),

        // Journey
        stops,
        cabinClass: mapCabinClass(flight.cabinClass),
        segments,
        ...(normalizeLayovers(flight.layovers) ? { layovers: normalizeLayovers(flight.layovers)! } : {}),

        // Price
        price: Math.max(0, Number(flight.price || 0)),
        currency: String(flight.currency || 'USD').toUpperCase(),

        // Ancillaries
        ...(normalizeBaggage(flight) ? { baggage: normalizeBaggage(flight)! } : {}),
        ...(normalizePolicies(flight) ? { policies: normalizePolicies(flight)! } : {}),

        // Booking
        ...(flight.deepLink ? { deepLink: flight.deepLink } : {}),
        ...(flight.bookingLink ? { bookingLink: flight.bookingLink } : {}),
    };

    return unified;
}

// ── Batch Adapter ─────────────────────────────────────────────────────────────

/**
 * Convert an array of FlightResult to UnifiedFlight[].
 * Filters out any flights that fail conversion (logs warning, never throws).
 */
export function toUnifiedFlights(flights: FlightResult[]): UnifiedFlight[] {
    return flights.reduce<UnifiedFlight[]>((acc, flight, idx) => {
        try {
            acc.push(toUnifiedFlight(flight));
        } catch (err) {
            console.warn(`[toUnifiedFlight] Skipped flight at index ${idx}:`, err);
        }
        return acc;
    }, []);
}

// ── Scoring Compatibility Bridge ──────────────────────────────────────────────
//
// The scoring engine currently accepts FlightResult.
// This bridge allows it to ALSO accept UnifiedFlight by converting back
// to the minimal FlightResult shape the scorer needs.
//
// NOTE: This is temporary — when the scoring engine is migrated to accept
// UnifiedFlight directly (Phase 3), this bridge will be removed.

/**
 * Convert UnifiedFlight back to the minimal FlightResult shape
 * required by the scoring engine. Only maps the fields the scorer reads.
 */
export function fromUnifiedForScoring(unified: UnifiedFlight): FlightResult {
    return {
        id: unified.id,
        source: unified.source as FlightSource,
        airline: unified.airline,
        operatingAirline: unified.operatingAirline,
        airlineLogo: unified.airlineLogo,
        flightNumber: unified.flightNumber,
        aircraft: unified.segments[0]?.aircraft,
        from: unified.from,
        to: unified.to,
        departTime: unified.departureTime,
        arriveTime: unified.arrivalTime,
        duration: unified.duration,
        stops: unified.stops,
        cabinClass: unified.cabinClass,
        segments: unified.segments.map((seg) => ({
            from: seg.from,
            to: seg.to,
            departure: seg.departureTime,
            arrival: seg.arrivalTime,
            departing_at: seg.departureTime,
            arriving_at: seg.arrivalTime,
            duration: seg.duration,
            carrier: seg.carrier,
            airline: seg.carrier,
            flightNumber: seg.flightNumber,
            aircraft: seg.aircraft || '',
            operating_carrier: {
                iata_code: seg.carrier,
                name: seg.carrier,
            },
            origin: { iata_code: seg.from },
            destination: { iata_code: seg.to },
        })),
        layovers: unified.layovers?.map((lay) => ({
            airport: lay.airport,
            city: lay.city,
            duration: lay.duration,
        })),
        price: unified.price,
        currency: unified.currency,
        policies: {
            baggageKg: unified.baggage?.checked?.kg,
            cabinBagKg: unified.baggage?.cabin?.kg,
            refundable: unified.policies?.refundable,
            changeAllowed: unified.policies?.changeAllowed,
            changeFee: unified.policies?.changeFee,
        },
        deepLink: unified.deepLink ?? undefined,
        bookingLink: unified.bookingLink ?? undefined,
    };
}

// ── Canonical Output Bridge ───────────────────────────────────────────────────

/**
 * PHASE 7: Convert a scored legacy FlightResult into the canonical ScoredFlight.
 * This extracts the rich intelligence data from `advancedScore` and maps it
 * to the structured `FlightScore` expected by the new UI.
 */
import type { ScoredFlight, FlightScore } from '@/types/unifiedFlight';

export function toScoredFlight(flight: FlightResult): ScoredFlight {
    const unified = toUnifiedFlight(flight);
    const adv = flight.advancedScore || {} as any;

    const score: FlightScore = {
        composite: adv.displayScore || flight.score || 0,
        confidence: adv.confidenceScore || 0,
        breakdown: {
            priceScore: adv.breakdown?.priceValue || 0,
            durationScore: adv.breakdown?.duration || 0,
            stopScore: adv.breakdown?.stops || 0,
            connectionScore: adv.breakdown?.connection || 0,
            selfTransferScore: adv.breakdown?.selfTransfer || 0,
            airlineScore: adv.breakdown?.aircraft || 0,
            baggageScore: adv.breakdown?.baggage || 0,
            reliabilityScore: adv.breakdown?.reliability || 0,
            amenitiesScore: adv.breakdown?.amenities || 0,
            airportIndexScore: adv.breakdown?.airportIndex || 0,
        },
        priceIntel: adv.priceIntel,
        decisionRecommendation: adv.decisionRecommendation,
        decisionConfidence: adv.decisionConfidence,
        decisionReason: adv.decisionReason,
        trendSignal: adv.trendSignal,
        alerts: adv.intelAlerts,
        riskFlags: adv.riskFlags || [],
        comfortNotes: adv.comfortNotes || [],
        tags: flight.tags || [],
        buyWaitSignal: adv.buyWaitSignal,
        routeIntelligence: adv.routeIntelligence,
        estimatedTotalCost: adv.estimatedTotalCost,
        variantGroupId: adv.variantGroupId,
        isRepresentative: adv.isRepresentative,
        variantCount: adv.variantCount,
        priceRange: adv.priceRange,
    };

    return {
        ...unified,
        score,
    };
}

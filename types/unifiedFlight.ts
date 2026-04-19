/**
 * Canonical flight data model.
 *
 * THREE-LAYER ARCHITECTURE:
 *   UnifiedFlight   — immutable transport facts from providers (this file)
 *   ScoredFlight    — UnifiedFlight + scoring engine overlay
 *   RenderedFlight  — ScoredFlight + UI-computed display hints (client-side only)
 *
 * PROVIDERS COVERED: duffel | priceline | kiwi | rapidapi
 * EXPLICITLY EXCLUDED: amadeus (not in active pipeline), travelpayouts (affiliate only)
 *
 * CONTRACT:
 *   - Providers produce UnifiedFlight objects — no downstream normalization required
 *   - Scoring engine reads UnifiedFlight, returns ScoredFlight
 *   - UI reads ScoredFlight; computes durationLabel, formatPrice, etc. locally
 *   - All string times are ISO 8601 with explicit timezone offset
 *   - currency is always 3-letter uppercase ISO 4217
 *   - All IATA codes are uppercase
 */

// ── Source ────────────────────────────────────────────────────────────────────

export type UnifiedFlightSource = "duffel" | "priceline" | "kiwi" | "rapidapi";

// ── Supporting types ──────────────────────────────────────────────────────────

export type CabinClass = "economy" | "premium" | "business" | "first";

/**
 * A single flight leg (one take-off, one landing).
 * Every UnifiedFlight has at least one segment.
 */
export type FlightSegment = {
    /** IATA departure airport, uppercase */
    from: string;
    /** IATA arrival airport, uppercase */
    to: string;
    /** ISO 8601 with timezone */
    departureTime: string;
    /** ISO 8601 with timezone */
    arrivalTime: string;
    /** Leg duration in minutes */
    duration: number;
    /** Operating carrier IATA code, uppercase (e.g. "TK") */
    carrier: string;
    /** Marketing carrier IATA code — may differ on codeshares */
    marketingCarrier?: string;
    /** Full flight designator (e.g. "TK55") */
    flightNumber: string;
    /** ICAO aircraft type code (e.g. "77W") */
    aircraft?: string;
};

export type FlightLayover = {
    /** IATA code of the intermediate airport */
    airport: string;
    /** City name for display (populated by city-enrichment, optional) */
    city?: string;
    /** Ground time in minutes */
    duration: number;
};

export type BaggageAllowance = {
    /** Whether any checked baggage is included in the base fare */
    included: boolean;
    checked?: {
        pieces?: number;
        /** Weight in kilograms */
        kg?: number;
        /** Human-readable label, e.g. "1 × 23 kg" or "Not included" */
        label: string;
    };
    cabin?: {
        kg?: number;
        label: string;
    };
};

export type FlightPolicies = {
    refundable: boolean;
    changeAllowed: boolean;
    /** e.g. "EUR 150" or "Free" */
    changeFee?: string;
};

// ── Core model ────────────────────────────────────────────────────────────────

export type UnifiedFlight = {
    // ── Identity ────────────────────────────────────────────────────────────
    /** Provider-scoped unique ID (e.g. "PRICELINE_abc123", "kiwi_xyz789") */
    id: string;
    /** Normalized lowercase source — set by the provider mapper, never downstream */
    source: UnifiedFlightSource;

    // ── Route ───────────────────────────────────────────────────────────────
    /** IATA departure airport code, uppercase */
    from: string;
    /** IATA arrival airport code, uppercase */
    to: string;
    /** ISO 8601 departure time with explicit timezone */
    departureTime: string;
    /** ISO 8601 arrival time with explicit timezone */
    arrivalTime: string;
    /** Total journey time in minutes (sum of all legs + layovers) */
    duration: number;

    // ── Carrier ─────────────────────────────────────────────────────────────
    /** Marketing airline name or IATA code */
    airline: string;
    /** First segment's operating carrier IATA code */
    operatingAirline?: string;
    airlineLogo?: string;
    /** Marketing flight designator of the first segment */
    flightNumber: string;

    // ── Journey ─────────────────────────────────────────────────────────────
    /** 0 = non-stop, 1 = one stop, etc. */
    stops: number;
    cabinClass: CabinClass;
    /** Always at least one element (tuple enforces this) */
    segments: [FlightSegment, ...FlightSegment[]];
    layovers?: FlightLayover[];

    // ── Price ───────────────────────────────────────────────────────────────
    /** Total fare for all passengers in provider currency */
    price: number;
    /** ISO 4217 uppercase (e.g. "USD", "TRY", "AUD") */
    currency: string;

    // ── Ancillaries (optional — populated when provider supplies the data) ──
    baggage?: BaggageAllowance;
    policies?: FlightPolicies;

    // ── Booking ─────────────────────────────────────────────────────────────
    /** Direct booking URL (provider's own booking page) */
    deepLink?: string | null;
    /** Fallback booking link */
    bookingLink?: string | null;
};

// ── Scoring layer (attached by engine, never by providers) ────────────────────

export type PriceIntelLabel =
    | "Strong deal"
    | "Below average"
    | "Fair price"
    | "Monitor price"
    | "Expect increase";

export type AlertSeverity = "URGENT" | "WARNING" | "INFO";

export type FlightAlert = {
    type: string;
    severity: AlertSeverity;
    headline: string;
    detail: string;
    dataPoint: string;
};

export type FlightScore = {
    /** 0–10 composite rank score */
    composite: number;
    /** 0–100 data confidence */
    confidence: number;
    breakdown: {
        priceScore: number;
        durationScore: number;
        stopScore: number;
        connectionScore: number;
        airlineScore: number;
        baggageScore: number;
        reliabilityScore: number;
    };
    priceIntel?: {
        label: PriceIntelLabel;
        deltaPercent: number;
        absoluteDelta?: number;
    };
    decisionRecommendation?: "BUY_NOW" | "WAIT" | "AVOID";
    decisionConfidence?: number;
    trendSignal?: "RISING" | "FALLING" | "STABLE";
    alerts?: FlightAlert[];
    /** UI tags derived from scoring: "Best Value", "Direct", etc. */
    tags?: string[];
    /** Variant grouping — set by variantGrouper */
    variantGroupId?: string;
    isRepresentative?: boolean;
    variantCount?: number;
    priceRange?: { min: number; max: number; currency: string };
};

/**
 * UnifiedFlight + scoring engine output.
 * This is what the search API returns and the UI renders.
 */
export type ScoredFlight = UnifiedFlight & {
    score: FlightScore;
};

// ── Search params (shared by all providers) ───────────────────────────────────

export type FlightSearchParams = {
    origin: string;
    destination: string;
    /** YYYY-MM-DD */
    date: string;
    returnDate?: string;
    adults: number;
    children?: number;
    infants?: number;
    cabin?: CabinClass;
    /** ISO 4217 target currency */
    currency?: string;
    persona?: "budget" | "comfort" | "business" | "family";
};

// ── Provider mapper contract ───────────────────────────────────────────────────

/**
 * Every provider adapter must satisfy this signature.
 * The return type is UnifiedFlight[], not FlightResult[].
 * Scoring is applied downstream by the engine — never inside mappers.
 */
export type ProviderMapper = (params: FlightSearchParams) => Promise<UnifiedFlight[]>;

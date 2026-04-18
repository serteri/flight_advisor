/**
 * Non-Linear Composite Flight Ranking Engine
 *
 * Scores each flight 0–10 across 7 dimensions, weighted by persona.
 *
 * Dimensions:
 *   price        0.22   (non-linear — strong reward for beating p20)
 *   duration     0.18   (relative to batch min and median)
 *   stops        0.14   (direct=100, 1-stop=72, 2-stop=44, 3+=20)
 *   connection   0.14   (golden zone 90–180min, penalty for extremes)
 *   airline      0.12   (Skytrax + alliance quality table)
 *   baggage      0.10   (checked kg allowance)
 *   reliability  0.10   (route OTP blend + airline delay rate)
 *
 * Persona weight tables override the defaults.
 * Output: float 0–10, two decimal places.
 */

import { FlightResult } from '@/types/hybridFlight';
import { getFlightKey } from './flightDeduplicator';

// ── Types ────────────────────────────────────────────────────────────────────

export type Persona = 'balanced' | 'budget' | 'business' | 'family' | 'comfort';

export interface BatchStats {
    min: number;
    p20: number;
    median: number;
    max: number;
    minDuration: number;
    medianDuration: number;
}

export interface RouteReliability {
    delayRatePct?: number;   // 0–100: percentage of flights delayed >15min
    avgDelayMin?: number;
}

export interface RankingInput {
    batchStats: BatchStats;
    reliability?: RouteReliability;
    persona?: Persona;
}

export interface ScoreBreakdown {
    total: number;           // 0–10
    priceScore: number;
    durationScore: number;
    stopScore: number;
    connectionScore: number;
    airlineScore: number;
    baggageScore: number;
    reliabilityScore: number;
    persona: Persona;
}

// ── Persona Weight Tables ────────────────────────────────────────────────────

interface Weights {
    price: number;
    duration: number;
    stops: number;
    connection: number;
    airline: number;
    baggage: number;
    reliability: number;
}

const PERSONA_WEIGHTS: Record<Persona, Weights> = {
    balanced: {
        price: 0.22, duration: 0.18, stops: 0.14, connection: 0.14,
        airline: 0.12, baggage: 0.10, reliability: 0.10,
    },
    budget: {
        price: 0.38, duration: 0.12, stops: 0.10, connection: 0.10,
        airline: 0.06, baggage: 0.14, reliability: 0.10,
    },
    business: {
        price: 0.08, duration: 0.22, stops: 0.18, connection: 0.16,
        airline: 0.18, baggage: 0.08, reliability: 0.10,
    },
    family: {
        price: 0.20, duration: 0.14, stops: 0.12, connection: 0.12,
        airline: 0.10, baggage: 0.20, reliability: 0.12,
    },
    comfort: {
        price: 0.12, duration: 0.18, stops: 0.16, connection: 0.14,
        airline: 0.20, baggage: 0.10, reliability: 0.10,
    },
};

// ── Airline Quality Table (Skytrax-informed, 0–100) ──────────────────────────

const AIRLINE_QUALITY: Record<string, number> = {
    // 5-star carriers
    QR: 96, SQ: 95, CX: 94, EK: 93, TK: 91, NH: 92, JL: 91, LH: 90,
    ET: 89, EY: 88, OZ: 88, KE: 88, MH: 87, BR: 86, AY: 86, SK: 85,
    // 4-star carriers
    UA: 82, AA: 81, DL: 83, BA: 84, AF: 83, KL: 84, IB: 79, AC: 81,
    QF: 87, NZ: 85, VA: 82, WS: 79, VS: 83, SN: 78, OS: 80, LX: 88,
    TP: 77, AZ: 76, RO: 70, OK: 72, MS: 74, PS: 68, WY: 75, HY: 72,
    // LCC / 2–3 star
    FR: 58, U2: 60, W6: 55, VY: 62, G3: 60, JQ: 63, TZ: 58, PC: 65,
    XL: 62, NK: 52, B6: 68, WN: 70, F9: 56, G4: 50, SY: 54, VX: 72,
    // Turkish carriers
    TK_domestic: 80,
    XQ: 58, PC_tr: 65,
};

function airlineScore(flight: FlightResult): number {
    const code = (flight.operatingAirline || flight.airline || '').toUpperCase().slice(0, 2);
    return AIRLINE_QUALITY[code] ?? 65;
}

// ── Component Scorers ────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}

/**
 * Non-linear price score.
 * Below p20 → 80–100 (strong reward for beating the market)
 * p20 → median → 50–80 (linear)
 * median → p80 → 30–50 (mild penalty)
 * Above p80 → 5–30 (steep penalty)
 */
function priceScore(price: number, stats: BatchStats): number {
    if (!isFinite(price) || price <= 0) return 40;
    const { min, p20, median, max } = stats;

    if (price <= min) return 100;

    if (price <= p20) {
        // 100 at min, 80 at p20
        const t = (price - min) / Math.max(p20 - min, 1);
        return Math.round(100 - t * 20);
    }

    if (price <= median) {
        // 80 at p20, 50 at median
        const t = (price - p20) / Math.max(median - p20, 1);
        return Math.round(80 - t * 30);
    }

    const p80 = median + (max - median) * 0.6;
    if (price <= p80) {
        // 50 at median, 30 at p80
        const t = (price - median) / Math.max(p80 - median, 1);
        return Math.round(50 - t * 20);
    }

    // Steep penalty above p80
    const t = (price - p80) / Math.max(max - p80, 1);
    return clamp(Math.round(30 - t * 25), 5, 30);
}

/**
 * Duration score: relative to batch minimum and median.
 * At min → 100, at median → 60, at 2×min → 25
 */
function durationScore(durationMin: number, stats: BatchStats): number {
    if (!isFinite(durationMin) || durationMin <= 0) return 40;
    const { minDuration, medianDuration } = stats;

    if (durationMin <= minDuration) return 100;

    if (durationMin <= medianDuration) {
        const t = (durationMin - minDuration) / Math.max(medianDuration - minDuration, 1);
        return Math.round(100 - t * 40);
    }

    // Above median: sharper decline
    const overMedianMin = durationMin - medianDuration;
    return clamp(Math.round(60 - overMedianMin * 0.35), 10, 60);
}

function stopScore(stops: number): number {
    if (stops <= 0) return 100;
    if (stops === 1) return 72;
    if (stops === 2) return 44;
    return 20;
}

/**
 * Connection quality score.
 * Golden zone: 90–180 min → 90–100
 * Short: 45–89 min → 50–90 (risk)
 * Critical: <45 min → 10–50 (very risky)
 * Long: 180–360 min → 60–90 (inconvenient but safe)
 * Very long: 360+ min → 15–60 (layover territory)
 */
function connectionScore(flight: FlightResult): number {
    const segs = Array.isArray(flight.segments) ? flight.segments : [];
    if (segs.length <= 1) return 100; // direct — no connection to score

    const layoverMins: number[] = [];
    for (let i = 0; i < segs.length - 1; i++) {
        const arrStr = segs[i]?.arrival?.at || segs[i]?.arriving_at || segs[i]?.arrivalTime || '';
        const depStr = segs[i + 1]?.departure?.at || segs[i + 1]?.departing_at || segs[i + 1]?.departureTime || '';
        const arr = new Date(arrStr).getTime();
        const dep = new Date(depStr).getTime();
        if (isFinite(arr) && isFinite(dep) && dep > arr) {
            layoverMins.push((dep - arr) / 60000);
        }
    }

    if (layoverMins.length === 0) return 70;

    const scores = layoverMins.map(mins => {
        if (mins < 45) return clamp(Math.round(mins * 0.9), 10, 40);
        if (mins < 90) return clamp(Math.round(40 + (mins - 45) * 1.1), 50, 89);
        if (mins <= 180) return clamp(Math.round(89 + (mins - 90) / 90), 89, 100);
        if (mins <= 360) return clamp(Math.round(100 - (mins - 180) * 0.22), 60, 100);
        return clamp(Math.round(60 - (mins - 360) * 0.1), 15, 60);
    });

    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

/**
 * Baggage score based on checked luggage allowance.
 * 0kg → 20, 10kg → 40, 20–23kg → 75, 30kg → 90, 40kg+ → 100
 */
function baggageScore(flight: FlightResult): number {
    const kg = Number(flight.policies?.baggageKg || 0);
    if (kg <= 0) return 20;
    if (kg <= 10) return clamp(Math.round(20 + kg * 2), 20, 40);
    if (kg <= 20) return clamp(Math.round(40 + (kg - 10) * 3.5), 40, 75);
    if (kg <= 30) return clamp(Math.round(75 + (kg - 20) * 1.5), 75, 90);
    return clamp(Math.round(90 + (kg - 30) * 0.5), 90, 100);
}

function reliabilityScore(flight: FlightResult, reliability?: RouteReliability): number {
    const delayRate = reliability?.delayRatePct;
    if (delayRate == null) return 65;
    // 0% delay → 95, 25% → 65, 50%+ → 20
    return clamp(Math.round(95 - delayRate * 1.5), 20, 95);
}

// ── Duration Resolver ────────────────────────────────────────────────────────

export function resolveDurationMinutes(flight: FlightResult): number {
    const d = Number(flight.duration);
    if (isFinite(d) && d > 0) return d;
    const dep = new Date(flight.departTime || '').getTime();
    const arr = new Date(flight.arriveTime || '').getTime();
    if (isFinite(dep) && isFinite(arr) && arr > dep) {
        return Math.round((arr - dep) / 60000);
    }
    return 0;
}

// ── Batch Statistics ─────────────────────────────────────────────────────────

export function computeBatchStats(flights: FlightResult[]): BatchStats {
    const prices = flights
        .map(f => Number(f.price))
        .filter(p => isFinite(p) && p > 0)
        .sort((a, b) => a - b);

    const durations = flights
        .map(f => resolveDurationMinutes(f))
        .filter(d => d > 0)
        .sort((a, b) => a - b);

    const pct = (arr: number[], p: number) => {
        if (arr.length === 0) return 0;
        const idx = Math.floor((p / 100) * (arr.length - 1));
        return arr[idx];
    };

    return {
        min: prices[0] ?? 0,
        p20: pct(prices, 20),
        median: pct(prices, 50),
        max: prices[prices.length - 1] ?? 0,
        minDuration: durations[0] ?? 0,
        medianDuration: pct(durations, 50),
    };
}

// ── Composite Scorer ─────────────────────────────────────────────────────────

export function scoreFlightComposite(
    flight: FlightResult,
    input: RankingInput,
): ScoreBreakdown {
    const persona = input.persona ?? 'balanced';
    const w = PERSONA_WEIGHTS[persona];
    const stats = input.batchStats;

    const price = Number(flight.price);
    const dur = resolveDurationMinutes(flight);

    const PS  = priceScore(price, stats);
    const DS  = durationScore(dur, stats);
    const SS  = stopScore(flight.stops ?? 0);
    const CS  = connectionScore(flight);
    const AS  = airlineScore(flight);
    const BS  = baggageScore(flight);
    const RS  = reliabilityScore(flight, input.reliability);

    const raw =
        w.price       * PS +
        w.duration    * DS +
        w.stops       * SS +
        w.connection  * CS +
        w.airline     * AS +
        w.baggage     * BS +
        w.reliability * RS;

    // Normalize 0–100 range to 0–10
    const total = Math.round((raw / 100) * 100) / 10;

    return {
        total: clamp(parseFloat(total.toFixed(2)), 0, 10),
        priceScore: Math.round(PS),
        durationScore: Math.round(DS),
        stopScore: Math.round(SS),
        connectionScore: Math.round(CS),
        airlineScore: Math.round(AS),
        baggageScore: Math.round(BS),
        reliabilityScore: Math.round(RS),
        persona,
    };
}

// ── Batch Ranking ────────────────────────────────────────────────────────────

/**
 * Ranks a batch of deduplicated flights.
 * Returns flights sorted best→worst, with scoreBreakdown attached.
 * Also returns a Map<flightKey, compositeScore> for variant grouper.
 */
export function rankFlights(
    flights: FlightResult[],
    options: {
        persona?: Persona;
        reliability?: RouteReliability;
    } = {},
): {
    ranked: FlightResult[];
    scoreMap: Map<string, number>;
} {
    if (flights.length === 0) return { ranked: [], scoreMap: new Map() };

    const batchStats = computeBatchStats(flights);
    const input: RankingInput = {
        batchStats,
        reliability: options.reliability,
        persona: options.persona ?? 'balanced',
    };

    const scored = flights.map(flight => {
        const breakdown = scoreFlightComposite(flight, input);
        return {
            flight: {
                ...flight,
                advancedScore: {
                    ...(flight.advancedScore || {}),
                    compositeScore: breakdown.total,
                    scoreBreakdown: breakdown,
                } as any,
            } as FlightResult,
            score: breakdown.total,
            key: getFlightKey(flight),
        };
    });

    scored.sort((a, b) => b.score - a.score);

    const scoreMap = new Map<string, number>();
    for (const s of scored) {
        scoreMap.set(s.key, s.score);
    }

    return {
        ranked: scored.map(s => s.flight),
        scoreMap,
    };
}

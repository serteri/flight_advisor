/**
 * Real Data Confidence Model
 *
 * Replaces the static ~66% confidence with a multi-factor formula
 * that varies meaningfully per flight and per route.
 *
 * Formula:
 *   Confidence = w1·Src + w2·PriceAnchor + w3·Freshness + w4·SeatSignal + w5·VolatilityStability + w6·PriceClarity
 *
 * Weights:
 *   Source reliability   0.28   (GDS is authoritative; scraper is not)
 *   Price vs median      0.22   (price matching history = more predictable)
 *   Data freshness       0.18   (stale = uncertain)
 *   Seat signal          0.12   (known seats = real-time data)
 *   Volatility stability 0.10   (stable route = more trustworthy signal)
 *   Price clarity        0.10   (clear price position = higher signal strength)
 *
 * Output: integer 10–97 (never 0 or 100 — always some uncertainty)
 */

import { FlightResult } from '@/types/hybridFlight';
import { SOURCE_TRUST } from './flightDeduplicator';

// ── Types ────────────────────────────────────────────────────────────────────

export interface RouteHistory {
    medianPrice30d?: number;
    medianPrice90d?: number;
    priceStdDev30d?: number;
    volatility?: number;          // existing RouteInsight.volatility field
    searchCount?: number;
    observedMinPrice?: number;
    observedMaxPrice?: number;
    avgPriceRoute?: number;
    delayRatePct?: number;
}

export interface ConfidenceBreakdown {
    total: number;
    sourceScore: number;
    priceAnchorScore: number;
    freshnessScore: number;
    seatSignalScore: number;
    volatilityScore: number;
    priceClarityScore: number;
}

// ── Component Calculators ────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}

/** Source reliability: GDS = 95, OTA scraper = 55 */
function sourceScore(flight: FlightResult): number {
    return SOURCE_TRUST[flight.source] ?? 58;
}

/**
 * Price anchor: how close is this price to the historical median?
 * 0% deviation → 100 (perfectly predictable)
 * 30%+ deviation → 20 (suspicious outlier)
 * No history → 42 (unknown)
 */
function priceAnchorScore(flight: FlightResult, history: RouteHistory): number {
    const price = Number(flight.price);
    const median = history.medianPrice30d || history.avgPriceRoute;
    if (!median || !isFinite(median) || median <= 0 || !isFinite(price) || price <= 0) {
        return 42;
    }
    const deltaPct = Math.abs(price - median) / median;
    // 0% → 100, 15% → 60, 30% → 20
    return clamp(Math.round(100 - deltaPct * 267), 18, 100);
}

/**
 * Freshness: exponential decay with 20-minute half-life.
 * Scraped now → 100, 20min ago → 50, 60min ago → 12, 2h ago → ~1 (clamped to 8)
 */
function freshnessScore(flight: FlightResult): number {
    const scrapedAt = (flight as any).scrapedAt;
    if (!scrapedAt) return 45; // unknown age → moderate uncertainty
    const ageMs = Date.now() - new Date(scrapedAt).getTime();
    if (!isFinite(ageMs) || ageMs < 0) return 45;
    const ageMin = ageMs / 60000;
    return clamp(Math.round(100 * Math.pow(0.5, ageMin / 20)), 8, 100);
}

/**
 * Seat signal: known low stock = real-time data = higher confidence
 * Unknown → 40 (moderate uncertainty)
 * 1–3 seats → 88 (high-signal inventory data)
 * 4–9 → 75
 * 10+ → 58
 */
function seatSignalScore(flight: FlightResult): number {
    const seats = (flight as any).seatsRemaining;
    if (seats == null || !isFinite(seats)) return 40;
    if (seats <= 3) return 88;
    if (seats <= 9) return 75;
    return 58;
}

/**
 * Volatility stability: stable routes → higher confidence
 * Uses CoV (coefficient of variation) from route history.
 * CoV 0.05 (very stable) → ~85
 * CoV 0.20 (moderate)   → ~40
 * CoV 0.33 (volatile)   → ~1 (clamped to 15)
 */
function volatilityScore(history: RouteHistory): number {
    // Use existing volatility field from RouteInsight (scale: 0–100 range)
    if (history.volatility !== undefined) {
        return clamp(Math.round(100 - history.volatility * 2), 12, 88);
    }
    // Compute from stdDev if available
    const std = history.priceStdDev30d;
    const median = history.medianPrice30d || history.avgPriceRoute;
    if (std && median && median > 0) {
        const cov = std / median;
        return clamp(Math.round(100 - cov * 300), 12, 88);
    }
    return 45; // no data → neutral
}

/**
 * Price clarity: extreme price positions produce clearer signals.
 * Price 30% below avg → strong BUY signal → high clarity
 * Price 30% above avg → strong AVOID signal → high clarity
 * Price near avg → ambiguous → low clarity
 */
function priceClarityScore(flight: FlightResult, history: RouteHistory): number {
    const price = Number(flight.price);
    const avg = history.avgPriceRoute || history.medianPrice30d;
    if (!avg || !isFinite(avg) || avg <= 0 || !isFinite(price) || price <= 0) {
        return 38;
    }
    const deltaPct = Math.abs(price - avg) / avg;
    // 0% deviation → 10 (no signal), 30%+ deviation → 90 (very clear)
    return clamp(Math.round(deltaPct * 280), 10, 88);
}

// ── Main Function ────────────────────────────────────────────────────────────

/**
 * Computes a real, differentiated confidence score for a single flight.
 *
 * Expected range:
 *   GDS flight, fresh, stable route, known seats, clear price position → 80–92%
 *   OTA scrape, 1h old, volatile route, no seat data, mid-range price  → 35–52%
 */
export function computeRealConfidence(
    flight: FlightResult,
    history: RouteHistory = {},
): ConfidenceBreakdown {
    const Src   = sourceScore(flight);
    const PA    = priceAnchorScore(flight, history);
    const Fresh = freshnessScore(flight);
    const Seat  = seatSignalScore(flight);
    const Vol   = volatilityScore(history);
    const Clarity = priceClarityScore(flight, history);

    const raw =
        0.28 * Src +
        0.22 * PA +
        0.18 * Fresh +
        0.12 * Seat +
        0.10 * Vol +
        0.10 * Clarity;

    // Mark invalid-data flights with a hard ceiling
    const isInvalid = flight.advancedScore?.dataQuality === 'invalid';
    const total = clamp(Math.round(isInvalid ? raw * 0.4 : raw), 10, 97);

    return {
        total,
        sourceScore: Math.round(Src),
        priceAnchorScore: Math.round(PA),
        freshnessScore: Math.round(Fresh),
        seatSignalScore: Math.round(Seat),
        volatilityScore: Math.round(Vol),
        priceClarityScore: Math.round(Clarity),
    };
}

/**
 * Attaches real confidence scores to a batch of flights.
 * Replaces the static confidenceScore in advancedScore.
 */
export function applyRealConfidence(
    flights: FlightResult[],
    history: RouteHistory = {},
): FlightResult[] {
    return flights.map(flight => {
        const breakdown = computeRealConfidence(flight, history);
        return {
            ...flight,
            advancedScore: {
                ...(flight.advancedScore || {}),
                confidenceScore: breakdown.total,
                confidenceBreakdown: breakdown,
            } as any,
        };
    });
}

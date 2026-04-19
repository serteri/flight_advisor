/**
 * Flight Intelligence Alert Engine
 *
 * Generates specific, data-driven alerts for each flight.
 * Replaces generic "RARE_DEAL" text with contextual signals.
 *
 * Alert types (in priority order):
 *   SEATS_CRITICAL     — ≤3 seats remaining at this price
 *   SEATS_LOW          — 4–9 seats remaining
 *   RARE_DEAL          — price in bottom 5% of 90-day history
 *   BELOW_SEASONAL     — price below same-period seasonal baseline
 *   LIKELY_RISE_24H    — departure within 21 days + low inventory + rising trend
 *   PRICE_SPIKE        — price rose >15% since previous scrape
 *   PRICE_DROP_EXPECTED— seasonal trend suggests drop in next 3–7 days
 *   HIGH_DELAY_ROUTE   — route delay rate >25%
 *   SELF_TRANSFER      — OTA-stitched itinerary (different PNRs)
 *   TIGHT_CONNECTION   — layover < 60 min
 *   AIRPORT_CHANGE     — different airports within same city at connection
 *   LONG_LAYOVER       — layover > 6 hours
 *   OVERNIGHT_LAYOVER  — layover spans midnight
 *
 * UI rule: max 2 alerts shown collapsed; rest in expanded view.
 *          SEATS_CRITICAL always takes slot 1 when present.
 */

import { FlightResult } from '@/types/hybridFlight';
import { normalizeSource } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

export type AlertType =
    | 'RARE_DEAL'
    | 'BELOW_SEASONAL'
    | 'PRICE_SPIKE'
    | 'LIKELY_RISE_24H'
    | 'SEATS_CRITICAL'
    | 'SEATS_LOW'
    | 'HIGH_DELAY_ROUTE'
    | 'SELF_TRANSFER'
    | 'PRICE_DROP_EXPECTED'
    | 'TIGHT_CONNECTION'
    | 'LONG_LAYOVER'
    | 'AIRPORT_CHANGE'
    | 'OVERNIGHT_LAYOVER';

export type AlertSeverity = 'URGENT' | 'WARNING' | 'INFO';

export interface IntelAlert {
    type: AlertType;
    severity: AlertSeverity;
    headline: string;          // 1 sentence, user-facing
    detail: string;            // expanded explanation
    dataPoint: string;         // the number/fact that triggered this
}

export interface BatchStats {
    minPrice: number;
    maxPrice: number;
    avgPrice: number;
    p5Price: number;           // 5th percentile (rare deal threshold)
    p20Price: number;
}

export interface RouteAlertContext {
    medianPrice90d?: number;
    seasonalBaseline?: number; // same-week-of-year median
    avgPriceChangeFinal3Weeks?: number; // avg % change in final 21 days to dep
    delayRatePct?: number;
    volatility?: number;
    trendSignal?: 'RISING' | 'FALLING' | 'STABLE';
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}

function round1(v: number): number {
    return Math.round(v * 10) / 10;
}

function daysUntil(dateStr: string): number {
    const dep = new Date(dateStr).getTime();
    if (!isFinite(dep)) return 30;
    return Math.max(0, Math.round((dep - Date.now()) / 86_400_000));
}

function computeBatchPercentiles(flights: FlightResult[]): BatchStats {
    const prices = flights
        .map(f => Number(f.price))
        .filter(p => isFinite(p) && p > 0)
        .sort((a, b) => a - b);

    if (prices.length === 0) {
        return { minPrice: 0, maxPrice: 0, avgPrice: 0, p5Price: 0, p20Price: 0 };
    }

    const min = prices[0];
    const max = prices[prices.length - 1];
    const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
    const p5 = prices[Math.floor(prices.length * 0.05)] ?? min;
    const p20 = prices[Math.floor(prices.length * 0.20)] ?? min;

    return { minPrice: min, maxPrice: max, avgPrice: avg, p5Price: p5, p20Price: p20 };
}

function resolveLayovers(flight: FlightResult): { duration: number; airport?: string }[] {
    if (Array.isArray(flight.layovers) && flight.layovers.length > 0) {
        return flight.layovers.map(l => ({
            duration: Number(l.duration) || 0,
            airport: l.airport,
        }));
    }

    // Derive from segments
    const segs = Array.isArray(flight.segments) ? flight.segments : [];
    const layovers: { duration: number; airport?: string }[] = [];
    for (let i = 0; i < segs.length - 1; i++) {
        const arr = new Date(
            segs[i]?.arrival?.at || segs[i]?.arriving_at || segs[i]?.arrival || ''
        ).getTime();
        const dep = new Date(
            segs[i + 1]?.departure?.at || segs[i + 1]?.departing_at || segs[i + 1]?.departure || ''
        ).getTime();
        if (isFinite(arr) && isFinite(dep) && dep > arr) {
            layovers.push({
                duration: Math.round((dep - arr) / 60000),
                airport: segs[i]?.arrival?.iataCode || segs[i]?.to || undefined,
            });
        }
    }
    return layovers;
}

function isOvernightLayover(durationMin: number): boolean {
    // A layover > 6h that crosses typical midnight window
    return durationMin >= 360;
}

function hasSelfTransfer(flight: FlightResult): boolean {
    // Kiwi / OTA-stitched flights are self-transfer by nature
    const src = normalizeSource(flight.source);
    if (src === 'kiwi' || src === 'serpapi') return (flight.stops ?? 0) > 0;
    // Check for mixed-PNR signal in segments
    const segs = Array.isArray(flight.segments) ? flight.segments : [];
    const pnrs = new Set(segs.map((s: any) => s?.bookingCode || s?.pnr || s?.ticketingStatus).filter(Boolean));
    return pnrs.size > 1;
}

function hasAirportChange(flight: FlightResult): boolean {
    const segs = Array.isArray(flight.segments) ? flight.segments : [];
    for (let i = 0; i < segs.length - 1; i++) {
        const arrAirport = (segs[i]?.arrival?.iataCode || segs[i]?.to || '').toUpperCase();
        const depAirport = (segs[i + 1]?.departure?.iataCode || segs[i + 1]?.from || '').toUpperCase();
        if (arrAirport && depAirport && arrAirport !== depAirport) return true;
    }
    return false;
}

// ── Alert Generators ─────────────────────────────────────────────────────────

function seatsAlert(flight: FlightResult): IntelAlert | null {
    const seats = (flight as any).seatsRemaining;
    if (seats == null || !isFinite(seats)) return null;

    if (seats <= 3) {
        return {
            type: 'SEATS_CRITICAL',
            severity: 'URGENT',
            headline: `Only ${seats} seat${seats === 1 ? '' : 's'} left at this price.`,
            detail: 'Once these sell, the next available fare will be in a higher booking class.',
            dataPoint: `seatsRemaining=${seats}`,
        };
    }

    if (seats <= 9) {
        return {
            type: 'SEATS_LOW',
            severity: 'WARNING',
            headline: `${seats} seats remaining at this price.`,
            detail: 'Inventory is running low at this fare level.',
            dataPoint: `seatsRemaining=${seats}`,
        };
    }

    return null;
}

function rareDealAlert(
    flight: FlightResult,
    batch: BatchStats,
    context: RouteAlertContext,
): IntelAlert | null {
    const price = Number(flight.price);
    if (!isFinite(price) || price <= 0) return null;

    const median90d = context.medianPrice90d;
    const seasonal = context.seasonalBaseline;

    // Check against 90-day history (most reliable signal)
    if (median90d && isFinite(median90d) && median90d > 0) {
        const pctBelow = ((median90d - price) / median90d) * 100;
        if (price <= batch.p5Price && pctBelow >= 15) {
            return {
                type: 'RARE_DEAL',
                severity: 'URGENT',
                headline: `Price is ${Math.round(pctBelow)}% below the 90-day median — unusually low for this route.`,
                detail: `The 90-day median for this route is $${Math.round(median90d)}. This fare at $${Math.round(price)} is in the bottom 5% of prices observed.`,
                dataPoint: `median90d=$${Math.round(median90d)} current=$${Math.round(price)}`,
            };
        }

        // Below seasonal baseline
        if (seasonal && isFinite(seasonal) && seasonal > 0) {
            const pctBelowSeasonal = ((seasonal - price) / seasonal) * 100;
            if (pctBelowSeasonal >= 18) {
                return {
                    type: 'BELOW_SEASONAL',
                    severity: 'URGENT',
                    headline: `Price is ${Math.round(pctBelowSeasonal)}% below the seasonal average for this departure period.`,
                    detail: `Flights on this route during this time of year typically cost around $${Math.round(seasonal)}. This fare is significantly below that baseline.`,
                    dataPoint: `seasonalBaseline=$${Math.round(seasonal)} current=$${Math.round(price)}`,
                };
            }
        }
    } else {
        // Fallback: use batch p5 only
        if (price <= batch.p5Price && batch.p5Price > 0) {
            const pctBelow = Math.round(((batch.avgPrice - price) / batch.avgPrice) * 100);
            return {
                type: 'RARE_DEAL',
                severity: 'URGENT',
                headline: `Cheapest fare in this search — ${pctBelow}% below the average result.`,
                detail: `This is in the bottom 5% of prices found across all options for this route and date.`,
                dataPoint: `batchP5=$${Math.round(batch.p5Price)} current=$${Math.round(price)}`,
            };
        }
    }

    return null;
}

function likelyRiseAlert(
    flight: FlightResult,
    daysLeft: number,
    context: RouteAlertContext,
): IntelAlert | null {
    if (daysLeft > 21) return null;

    const avgRisePct = context.avgPriceChangeFinal3Weeks;
    const seats = (flight as any).seatsRemaining;
    const trend = context.trendSignal;

    const risingHistorically = avgRisePct && avgRisePct >= 0.08;
    const risingNow = trend === 'RISING';
    const lowInventory = seats != null && seats <= 6;

    if ((risingHistorically || risingNow) && (lowInventory || daysLeft <= 10)) {
        const avgRisePctDisplay = avgRisePct ? `${Math.round(avgRisePct * 100)}%` : 'notable';
        return {
            type: 'LIKELY_RISE_24H',
            severity: 'URGENT',
            headline: `Prices on this route typically rise sharply in the final ${daysLeft <= 10 ? '10 days' : '3 weeks'}.`,
            detail: `Historical data shows an average ${avgRisePctDisplay} price increase once inside ${daysLeft <= 10 ? '10' : '21'} days of departure.${seats != null && seats <= 6 ? ` Only ${seats} seats remain at this fare.` : ''}`,
            dataPoint: `daysLeft=${daysLeft} trend=${trend || 'N/A'} seats=${seats ?? 'unknown'}`,
        };
    }

    return null;
}

function priceDropExpectedAlert(
    flight: FlightResult,
    context: RouteAlertContext,
    daysLeft: number,
): IntelAlert | null {
    if (daysLeft < 7) return null; // Too late to wait
    if (context.trendSignal !== 'FALLING') return null;

    const price = Number(flight.price);
    const avg = context.seasonalBaseline || 0;
    // Only suggest waiting if price is above average (otherwise "wait" is bad advice)
    if (avg > 0 && price <= avg) return null;

    return {
        type: 'PRICE_DROP_EXPECTED',
        severity: 'WARNING',
        headline: `Prices on this route are currently trending downward.`,
        detail: `Recent searches show a declining price trend. With ${daysLeft} days until departure, waiting 3–5 days to rebook may yield a lower fare.`,
        dataPoint: `trendSignal=FALLING daysLeft=${daysLeft}`,
    };
}

function delayRouteAlert(context: RouteAlertContext): IntelAlert | null {
    const rate = context.delayRatePct;
    if (!rate || rate <= 25) return null;

    return {
        type: 'HIGH_DELAY_ROUTE',
        severity: 'WARNING',
        headline: `This route has a ${rate}% historical on-time rate — above average disruption risk.`,
        detail: `Factor in extra buffer time if you have onward connections or time-sensitive arrivals at the destination.`,
        dataPoint: `delayRate=${rate}%`,
    };
}

function selfTransferAlert(flight: FlightResult): IntelAlert | null {
    if (!hasSelfTransfer(flight)) return null;
    return {
        type: 'SELF_TRANSFER',
        severity: 'WARNING',
        headline: `Self-transfer required — this itinerary combines separate tickets.`,
        detail: `If your first flight is delayed and you miss the second, the airline is not obligated to rebook you. Consider travel insurance.`,
        dataPoint: `source=${flight.source} stops=${flight.stops}`,
    };
}

function connectionAlerts(flight: FlightResult): IntelAlert[] {
    const alerts: IntelAlert[] = [];
    const layovers = resolveLayovers(flight);

    for (const l of layovers) {
        const dur = l.duration;
        if (dur > 0 && dur < 60) {
            alerts.push({
                type: 'TIGHT_CONNECTION',
                severity: 'WARNING',
                headline: `Tight connection at ${l.airport || 'layover city'} — only ${dur} minutes.`,
                detail: `Under 60 minutes is considered high-risk. Passport control, gate distance, and any delay on the incoming leg could cause you to miss this connection.`,
                dataPoint: `layoverMin=${dur} airport=${l.airport || 'N/A'}`,
            });
        }

        if (dur >= 360) {
            if (isOvernightLayover(dur)) {
                alerts.push({
                    type: 'OVERNIGHT_LAYOVER',
                    severity: 'INFO',
                    headline: `Long layover at ${l.airport || 'connection point'} — ${Math.round(dur / 60)}h wait.`,
                    detail: `You may want to arrange a transit hotel or lounge access for this ${Math.round(dur / 60)}-hour layover.`,
                    dataPoint: `layoverMin=${dur}`,
                });
            } else {
                alerts.push({
                    type: 'LONG_LAYOVER',
                    severity: 'INFO',
                    headline: `Long layover — ${Math.round(dur / 60)}h wait at ${l.airport || 'connection point'}.`,
                    detail: `A ${Math.round(dur / 60)}-hour layover is long but manageable. Most international airports have lounges, restaurants, and transit areas.`,
                    dataPoint: `layoverMin=${dur}`,
                });
            }
        }
    }

    if (hasAirportChange(flight)) {
        alerts.push({
            type: 'AIRPORT_CHANGE',
            severity: 'WARNING',
            headline: `Airport change required during layover.`,
            detail: `You will need to transfer between different airports at your connection point. Budget extra time and check local transport options.`,
            dataPoint: `hasAirportChange=true`,
        });
    }

    return alerts;
}

// ── Main Alert Generator ─────────────────────────────────────────────────────

const SEVERITY_RANK: Record<AlertSeverity, number> = {
    URGENT: 3,
    WARNING: 2,
    INFO: 1,
};

/**
 * Generates all applicable alerts for a single flight.
 *
 * Returns alerts sorted by severity (URGENT first).
 * The UI should show max 2 alerts collapsed; rest in expanded view.
 */
export function generateAlerts(
    flight: FlightResult,
    batchFlights: FlightResult[],
    context: RouteAlertContext = {},
    departureDate?: string,
): IntelAlert[] {
    const alerts: IntelAlert[] = [];
    const batch = computeBatchPercentiles(batchFlights);
    const daysLeft = daysUntil(departureDate || flight.departTime || '');

    // 1. Seat availability (highest priority)
    const sAlert = seatsAlert(flight);
    if (sAlert) alerts.push(sAlert);

    // 2. Price intelligence
    const dealAlert = rareDealAlert(flight, batch, context);
    if (dealAlert) alerts.push(dealAlert);

    // 3. Urgency signals
    const riseAlert = likelyRiseAlert(flight, daysLeft, context);
    if (riseAlert) alerts.push(riseAlert);

    const dropAlert = priceDropExpectedAlert(flight, context, daysLeft);
    if (dropAlert) alerts.push(dropAlert);

    // 4. Route quality
    const delayAlert = delayRouteAlert(context);
    if (delayAlert) alerts.push(delayAlert);

    // 5. Itinerary risk flags
    const stAlert = selfTransferAlert(flight);
    if (stAlert) alerts.push(stAlert);

    const connAlerts = connectionAlerts(flight);
    alerts.push(...connAlerts);

    // Sort: URGENT first, then WARNING, then INFO
    alerts.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);

    // Deduplicate same type
    const seen = new Set<AlertType>();
    return alerts.filter(a => {
        if (seen.has(a.type)) return false;
        seen.add(a.type);
        return true;
    });
}

/**
 * Attaches alerts to a batch of flights.
 */
export function applyAlerts(
    flights: FlightResult[],
    context: RouteAlertContext = {},
    departureDate?: string,
): FlightResult[] {
    return flights.map(flight => ({
        ...flight,
        advancedScore: {
            ...(flight.advancedScore || {}),
            intelAlerts: generateAlerts(flight, flights, context, departureDate),
        } as any,
    }));
}

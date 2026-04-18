/**
 * Variant Grouping System
 *
 * After deduplication, flights that share the same route but differ in
 * departure time are separate journeys. This module groups them into
 * FlightVariantGroup objects for the UI.
 *
 * One card in the UI = one FlightVariantGroup
 * Expandable drawer = all variants within the group
 *
 * Each group tracks:
 *  - representative: the card shown collapsed (elected by score + trust)
 *  - roles: cheapest / fastest / bestValue variants
 *  - variants: all options with delta vs representative
 *  - priceRange, variantCount, sourceCount
 */

import { FlightResult } from '@/types/hybridFlight';
import { getFlightKey, SOURCE_TRUST } from './flightDeduplicator';

// ── Types ────────────────────────────────────────────────────────────────────

export interface VariantRole {
    flightKey: string;
    price: number;
    durationMinutes: number;
    compositeScore: number;
    source: string;
}

export interface VariantRow {
    flightKey: string;
    flight: FlightResult;
    roles: Array<'CHEAPEST' | 'FASTEST' | 'BEST_VALUE'>;
    deltaVsRepresentative: {
        priceDiff: number;        // positive = more expensive
        durationDiff: number;     // minutes, positive = slower
        baggageDiff: string;
    };
    fareFamily: string;
    source: string;
    price: number;
    durationMinutes: number;
    compositeScore: number;
}

export interface FlightVariantGroup {
    groupId: string;

    // Card displayed in the list view (collapsed state)
    representative: FlightResult;

    // Pre-computed roles
    roles: {
        cheapest: VariantRole;
        fastest: VariantRole;
        bestValue: VariantRole;
    };

    // All options shown in the expanded drawer
    variants: VariantRow[];

    // Summary metadata
    priceRange: { min: number; max: number; currency: string };
    durationRange: { min: number; max: number };
    variantCount: number;
    sourceCount: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function resolveDuration(flight: FlightResult): number {
    const d = Number(flight.duration);
    if (isFinite(d) && d > 0) return d;

    // Fallback: compute from dep/arr timestamps
    const dep = new Date(flight.departTime || '').getTime();
    const arr = new Date(flight.arriveTime || '').getTime();
    if (isFinite(dep) && isFinite(arr) && arr > dep) {
        return Math.round((arr - dep) / 60000);
    }
    return 0;
}

function resolveFareFamily(flight: FlightResult): string {
    const fareType = flight.fareType;
    if (fareType === 'flex') return 'Flex';
    if (fareType === 'standard') return 'Standard';
    if (fareType === 'basic') return 'Basic Economy';
    return 'Economy';
}

function baggageDiff(a: FlightResult, b: FlightResult): string {
    const aKg = Number(a.policies?.baggageKg || 0);
    const bKg = Number(b.policies?.baggageKg || 0);
    if (aKg === bKg) return 'Same baggage allowance';
    if (aKg > bKg) return `+${aKg - bKg}kg checked vs representative`;
    return `${aKg - bKg}kg checked vs representative`;
}

/**
 * Elects the representative flight for a variant group.
 * Prefers: high composite score + trusted source + fresh data + known seats
 */
function electRepresentative(
    flights: FlightResult[],
    scoreMap: Map<string, number>
): FlightResult {
    return flights.reduce((best, f) => {
        const score = (scoreMap.get(getFlightKey(f)) ?? 0) * 10 +
            (SOURCE_TRUST[(f.source || '').toLowerCase()] ?? 50) * 0.5 +
            ((f as any).seatsRemaining != null ? 8 : 0);
        const bestScore = (scoreMap.get(getFlightKey(best)) ?? 0) * 10 +
            (SOURCE_TRUST[(best.source || '').toLowerCase()] ?? 50) * 0.5 +
            ((best as any).seatsRemaining != null ? 8 : 0);
        return score > bestScore ? f : best;
    }, flights[0]);
}

// ── Grouping Logic ───────────────────────────────────────────────────────────

/**
 * Groups deduplicated flights into variant groups.
 *
 * Flights are in the same group when they share:
 * - Same origin + destination
 * - Same departure date (same calendar day)
 * - Same operating airline (codeshare variants) OR departure within 30min
 *
 * This is intentionally more lenient than deduplication:
 * two slightly different departure times from the same airline on the same day
 * may be presented as variants of each other.
 *
 * @param flights  Deduplicated FlightResult[] (output of deduplicateFlights)
 * @param scoreMap Map<flightKey, compositeScore 0–10> from rankingEngine
 */
export function groupIntoVariants(
    flights: FlightResult[],
    scoreMap: Map<string, number> = new Map()
): FlightVariantGroup[] {
    if (flights.length === 0) return [];

    const assigned = new Set<string>();
    const groups: FlightVariantGroup[] = [];

    for (const flight of flights) {
        const key = getFlightKey(flight);
        if (assigned.has(key)) continue;

        const cluster = [flight];
        assigned.add(key);

        // Find other flights that belong in the same card
        for (const other of flights) {
            const oKey = getFlightKey(other);
            if (assigned.has(oKey)) continue;
            if (shouldGroup(flight, other)) {
                cluster.push(other);
                assigned.add(oKey);
            }
        }

        groups.push(buildGroup(cluster, scoreMap));
    }

    return groups;
}

/**
 * Two flights belong in the same variant group when:
 * - Same origin/destination
 * - Same operating airline
 * - Departure on same calendar day
 * - Departure within 2 hours of each other (different fare timing, not different flights)
 */
function shouldGroup(a: FlightResult, b: FlightResult): boolean {
    if ((a.from || '').toUpperCase() !== (b.from || '').toUpperCase()) return false;
    if ((a.to || '').toUpperCase() !== (b.to || '').toUpperCase()) return false;
    if ((a.stops ?? 0) !== (b.stops ?? 0)) return false;

    // Same operating airline
    const aOp = (a.operatingAirline || a.airline || '').toUpperCase().slice(0, 3);
    const bOp = (b.operatingAirline || b.airline || '').toUpperCase().slice(0, 3);
    if (aOp !== bOp && aOp && bOp) return false;

    const depA = new Date(a.departTime || '').getTime();
    const depB = new Date(b.departTime || '').getTime();
    if (!isFinite(depA) || !isFinite(depB)) return false;

    // Same day
    const dayA = new Date(depA).toISOString().slice(0, 10);
    const dayB = new Date(depB).toISOString().slice(0, 10);
    if (dayA !== dayB) return false;

    // Within 2-hour window
    return Math.abs(depA - depB) / 60000 <= 120;
}

function buildGroup(
    cluster: FlightResult[],
    scoreMap: Map<string, number>
): FlightVariantGroup {
    const representative = electRepresentative(cluster, scoreMap);
    const repKey = getFlightKey(representative);
    const repDuration = resolveDuration(representative);
    const repPrice = Number(representative.price);

    // Compute roles
    const cheapest = cluster.reduce((min, f) =>
        Number(f.price) < Number(min.price) ? f : min, cluster[0]);

    const fastest = cluster.reduce((min, f) =>
        resolveDuration(f) < resolveDuration(min) ? f : min, cluster[0]);

    const bestValue = cluster.reduce((best, f) => {
        const s = scoreMap.get(getFlightKey(f)) ?? 0;
        const bs = scoreMap.get(getFlightKey(best)) ?? 0;
        return s > bs ? f : best;
    }, cluster[0]);

    const prices = cluster.map(f => Number(f.price)).filter(p => p > 0);
    const durations = cluster.map(f => resolveDuration(f)).filter(d => d > 0);
    const sources = new Set(cluster.map(f => f.source));

    const variants: VariantRow[] = cluster.map(f => {
        const fKey = getFlightKey(f);
        const roles: Array<'CHEAPEST' | 'FASTEST' | 'BEST_VALUE'> = [];
        if (getFlightKey(cheapest) === fKey) roles.push('CHEAPEST');
        if (getFlightKey(fastest) === fKey) roles.push('FASTEST');
        if (getFlightKey(bestValue) === fKey) roles.push('BEST_VALUE');

        return {
            flightKey: fKey,
            flight: f,
            roles,
            deltaVsRepresentative: {
                priceDiff: Number(f.price) - repPrice,
                durationDiff: resolveDuration(f) - repDuration,
                baggageDiff: baggageDiff(f, representative),
            },
            fareFamily: resolveFareFamily(f),
            source: f.source,
            price: Number(f.price),
            durationMinutes: resolveDuration(f),
            compositeScore: scoreMap.get(fKey) ?? 0,
        };
    }).sort((a, b) => a.price - b.price); // cheapest first in drawer

    const groupId = repKey;

    const toRole = (f: FlightResult): VariantRole => ({
        flightKey: getFlightKey(f),
        price: Number(f.price),
        durationMinutes: resolveDuration(f),
        compositeScore: scoreMap.get(getFlightKey(f)) ?? 0,
        source: f.source,
    });

    return {
        groupId,
        representative,
        roles: {
            cheapest: toRole(cheapest),
            fastest: toRole(fastest),
            bestValue: toRole(bestValue),
        },
        variants,
        priceRange: {
            min: prices.length > 0 ? Math.min(...prices) : repPrice,
            max: prices.length > 0 ? Math.max(...prices) : repPrice,
            currency: representative.currency,
        },
        durationRange: {
            min: durations.length > 0 ? Math.min(...durations) : repDuration,
            max: durations.length > 0 ? Math.max(...durations) : repDuration,
        },
        variantCount: cluster.length,
        sourceCount: sources.size,
    };
}

/**
 * Attaches variant group metadata back onto each FlightResult.
 * This lets the existing card UI show "3 variants available ▾" without
 * requiring a new API response shape.
 */
export function attachVariantMetadata(
    groups: FlightVariantGroup[],
    allFlights: FlightResult[]
): FlightResult[] {
    const keyToGroup = new Map<string, FlightVariantGroup>();
    for (const group of groups) {
        for (const v of group.variants) {
            keyToGroup.set(v.flightKey, group);
        }
    }

    return allFlights.map(flight => {
        const key = getFlightKey(flight);
        const group = keyToGroup.get(key);
        if (!group) return flight;

        const isRep = getFlightKey(group.representative) === key;

        return {
            ...flight,
            advancedScore: {
                ...(flight.advancedScore || {}),
                variantGroupId: group.groupId,
                isRepresentative: isRep,
                variantCount: group.variantCount,
                priceRange: group.priceRange,
                variantRoles: group.variants.find(v => v.flightKey === key)?.roles || [],
            } as any,
        };
    });
}

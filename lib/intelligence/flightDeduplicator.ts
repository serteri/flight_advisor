/**
 * Flight Deduplication Engine
 *
 * Problem: Same physical flight appears multiple times across sources
 * (Duffel + Priceline + Amadeus all return QF1 SYD→LHR).
 *
 * Solution:
 * 1. Build a deterministic flightKey from the physical journey (operating airline + segment times)
 * 2. Cluster flights by key — exact match first, then ±5min tolerance
 * 3. Merge each cluster into one canonical record, tracking all sources in soldBy[]
 */

import crypto from 'crypto';
import { FlightResult } from '@/types/hybridFlight';
import { normalizeSource } from '@/lib/utils';

// ── Source Trust Levels (0–100) ──────────────────────────────────────────────
export const SOURCE_TRUST: Record<string, number> = {
    amadeus:  95,
    duffel:   80,
    priceline: 62,
    kiwi:     60,
    rapidapi: 55,
    serpapi:  50,
};

// ── Internal marker key ──────────────────────────────────────────────────────
const FLIGHT_KEY_SYM = '__flightKey';

// ── Helpers ──────────────────────────────────────────────────────────────────

function truncateToMinute(iso: string): string {
    try {
        const d = new Date(iso);
        if (!isFinite(d.getTime())) return iso;
        return d.toISOString().slice(0, 16); // "2025-11-15T03:32"
    } catch {
        return iso;
    }
}

function resolveOperatingAirline(flight: FlightResult): string {
    const seg = Array.isArray(flight.segments) ? flight.segments[0] : null;
    const candidates = [
        seg?.operating_carrier?.iata_code,
        seg?.operating?.carrierCode,
        seg?.operatingAirlineCode,
        flight.operatingAirline,
        seg?.carrierCode,
        seg?.carrier,
        (flight.airline || '').slice(0, 3),
    ];
    for (const c of candidates) {
        const n = String(c || '').trim().toUpperCase();
        if (/^[A-Z0-9]{2,3}$/.test(n)) return n;
    }
    return (flight.airline || 'XX').toUpperCase().slice(0, 3);
}

function segDep(seg: any): string {
    return seg?.departure?.at || seg?.departing_at || seg?.departureTime || seg?.departure || '';
}
function segArr(seg: any): string {
    return seg?.arrival?.at || seg?.arriving_at || seg?.arrivalTime || seg?.arrival || '';
}
function segFrom(seg: any): string {
    return (seg?.departure?.iataCode || seg?.from || seg?.origin?.iata_code || '').toUpperCase();
}
function segTo(seg: any): string {
    return (seg?.arrival?.iataCode || seg?.to || seg?.destination?.iata_code || '').toUpperCase();
}
function segOp(seg: any): string {
    const candidates = [
        seg?.operating_carrier?.iata_code,
        seg?.operating?.carrierCode,
        seg?.operatingAirlineCode,
        seg?.carrierCode,
        seg?.carrier,
    ];
    for (const c of candidates) {
        const n = String(c || '').trim().toUpperCase();
        if (/^[A-Z0-9]{2,3}$/.test(n)) return n;
    }
    return '';
}

// ── Flight Key ───────────────────────────────────────────────────────────────

/**
 * Builds a deterministic 16-char hex key for a physical journey.
 * Same journey from different sources → same key.
 * Codeshare marketing differences are ignored (uses operating carrier only).
 */
export function buildFlightKey(flight: FlightResult): string {
    const segs = Array.isArray(flight.segments) && flight.segments.length > 0
        ? [...flight.segments].sort((a, b) => segDep(a).localeCompare(segDep(b)))
        : null;

    let data: string;

    if (segs && segs.length > 0) {
        data = segs.map(s => [
            segOp(s) || resolveOperatingAirline(flight),
            segFrom(s),
            segTo(s),
            truncateToMinute(segDep(s)),
            truncateToMinute(segArr(s)),
        ].join('|')).join('::');
    } else {
        data = [
            resolveOperatingAirline(flight),
            (flight.from || '').toUpperCase(),
            (flight.to || '').toUpperCase(),
            truncateToMinute(flight.departTime || ''),
            truncateToMinute(flight.arriveTime || ''),
        ].join('|');
    }

    return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);
}

// ── Variant Detection ────────────────────────────────────────────────────────

/**
 * Returns true if two flights are the same physical journey
 * (different price, fare, or source — but same aircraft/schedule).
 */
export function areVariants(a: FlightResult, b: FlightResult): boolean {
    const ka = getKey(a);
    const kb = getKey(b);
    if (ka === kb) return true;

    // Secondary: same operating airline + same route + departure within 5 minutes
    if (resolveOperatingAirline(a) !== resolveOperatingAirline(b)) return false;
    if ((a.from || '').toUpperCase() !== (b.from || '').toUpperCase()) return false;
    if ((a.to || '').toUpperCase() !== (b.to || '').toUpperCase()) return false;
    if ((a.stops ?? 0) !== (b.stops ?? 0)) return false;

    const depA = new Date(a.departTime || '').getTime();
    const depB = new Date(b.departTime || '').getTime();
    if (!isFinite(depA) || !isFinite(depB)) return false;

    return Math.abs(depA - depB) / 60000 <= 5;
}

function getKey(f: FlightResult): string {
    return (f as any)[FLIGHT_KEY_SYM] || buildFlightKey(f);
}

// ── Merge Logic ──────────────────────────────────────────────────────────────

/**
 * Merges a cluster of duplicate flights into one canonical record.
 * - Price: cheapest bookable fare
 * - Policies/baggage: from highest-trust source
 * - Seats: most conservative (minimum known)
 * - soldBy: all source variants tracked
 */
function mergeCluster(cluster: FlightResult[], clusterKey: string): FlightResult {
    if (cluster.length === 1) {
        const f = { ...(cluster[0]) } as any;
        f[FLIGHT_KEY_SYM] = clusterKey;
        return f;
    }

    // Sort by trust descending — most authoritative source first
    const byTrust = [...cluster].sort(
        (a, b) => (SOURCE_TRUST[normalizeSource(b.source)] ?? 50) - (SOURCE_TRUST[normalizeSource(a.source)] ?? 50)
    );

    const primary = byTrust[0];

    // Cheapest price across all sources
    const cheapest = cluster.reduce(
        (min, f) => (Number(f.price) < Number(min.price) ? f : min),
        cluster[0]
    );

    // Seat count: take minimum (most conservative signal)
    const seatCounts = cluster
        .map(f => (f as any).seatsRemaining)
        .filter((s): s is number => typeof s === 'number' && s >= 0);
    const seatsRemaining = seatCounts.length > 0 ? Math.min(...seatCounts) : undefined;

    // Build soldBy tracking all sources
    const soldBy = cluster.map(f => ({
        source: f.source,
        airline: f.airline,
        price: Number(f.price),
        currency: f.currency,
    }));

    const merged: any = {
        ...primary,
        // Price from cheapest bookable source
        price: cheapest.price,
        currency: cheapest.currency,
        source: cheapest.source,
        bookingLink: cheapest.bookingLink || primary.bookingLink,
        deepLink: cheapest.deepLink || primary.deepLink,
        // Policies from most trusted source
        policies: primary.policies || cheapest.policies,
        baggageSummary: primary.baggageSummary || cheapest.baggageSummary,
        // Track all sources
        soldBy,
        // Seat availability (most conservative)
        ...(seatsRemaining !== undefined ? { seatsRemaining } : {}),
        // Internal key
        [FLIGHT_KEY_SYM]: clusterKey,
    };

    return merged as FlightResult;
}

// ── Main Deduplication Function ──────────────────────────────────────────────

/**
 * Deduplicates a batch of raw flights from multiple sources.
 *
 * Returns merged FlightResult[] where:
 * - Same physical journey → one record (cheapest price, best-source data)
 * - soldBy[] tracks all source variants
 * - __flightKey is set for downstream grouping
 *
 * Before: 31 raw flights (6 sources)
 * After:  ~12 unique journeys
 */
export function deduplicateFlights(flights: FlightResult[]): FlightResult[] {
    if (flights.length === 0) return [];

    // Phase 1: Assign flight keys and group by exact key
    const exactGroups = new Map<string, FlightResult[]>();

    for (const flight of flights) {
        const key = buildFlightKey(flight);
        (flight as any)[FLIGHT_KEY_SYM] = key;
        const group = exactGroups.get(key) || [];
        group.push(flight);
        exactGroups.set(key, group);
    }

    // Phase 2: Merge exact-match groups
    const exactMerged: FlightResult[] = [];
    for (const [key, group] of exactGroups) {
        exactMerged.push(mergeCluster(group, key));
    }

    // Phase 3: Near-duplicate pass — catch ±5min schedule tolerance
    const finalClusters: FlightResult[][] = [];
    const assigned = new Set<string>();

    for (const flight of exactMerged) {
        const key = getKey(flight);
        if (assigned.has(key)) continue;

        const cluster = [flight];
        assigned.add(key);

        for (const other of exactMerged) {
            const oKey = getKey(other);
            if (assigned.has(oKey)) continue;
            if (areVariants(flight, other)) {
                cluster.push(other);
                assigned.add(oKey);
            }
        }

        finalClusters.push(cluster);
    }

    // Phase 4: Merge near-duplicate clusters
    return finalClusters.map(cluster =>
        cluster.length === 1
            ? cluster[0]
            : mergeCluster(cluster, getKey(cluster[0]))
    );
}

/**
 * Get the internal flight key (assigned during deduplication).
 * Only available after deduplicateFlights() has been called.
 */
export function getFlightKey(flight: FlightResult): string {
    return (flight as any)[FLIGHT_KEY_SYM] || buildFlightKey(flight);
}

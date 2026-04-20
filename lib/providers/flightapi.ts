/**
 * FlightAPI.io provider client — server-side only.
 * One-way trip search via /onewaytrip endpoint.
 * Docs: https://api.flightapi.io
 */

import type { HybridSearchParams } from '@/types/hybridFlight';

export class FlightAPIError extends Error {
    constructor(msg: string) { super(msg); this.name = 'FlightAPIError'; }
}

// ── Cabin mapping ─────────────────────────────────────────────────────────────

function toCabinLabel(cabin: HybridSearchParams['cabin']): string {
    switch (cabin) {
        case 'premium':  return 'premium_economy';
        case 'business': return 'business';
        case 'first':    return 'first';
        default:         return 'economy';
    }
}

// ── Search ────────────────────────────────────────────────────────────────────

export async function searchFlightAPI(params: HybridSearchParams): Promise<any> {
    const apiKey = process.env.FLIGHTAPI_KEY;
    const baseUrl = process.env.FLIGHTAPI_BASE_URL || 'https://api.flightapi.io';

    if (!apiKey) throw new FlightAPIError('FLIGHTAPI_KEY is not set');

    const adults   = Math.max(1, params.adults ?? 1);
    const children = Math.max(0, params.children ?? 0);
    const infants  = Math.max(0, params.infants ?? 0);
    const cabin    = toCabinLabel(params.cabin);
    const currency = (params.currency || 'USD').toUpperCase();

    // Endpoint: /onewaytrip/{key}/{from}/{to}/{date}/{adults}/{children}/{infants}/{cabin}/{currency}
    const url = [
        baseUrl,
        'onewaytrip',
        apiKey,
        params.origin.toUpperCase(),
        params.destination.toUpperCase(),
        params.date,         // YYYY-MM-DD
        adults,
        children,
        infants,
        cabin,
        currency,
    ].join('/');

    const start = Date.now();
    const res = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(20_000),
    });

    const elapsed = Date.now() - start;
    console.log(`[FlightAPI] ${params.origin}→${params.destination} — HTTP ${res.status} (${elapsed}ms)`);

    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new FlightAPIError(`FlightAPI request failed (${res.status}): ${body.slice(0, 200)}`);
    }

    return res.json();
}

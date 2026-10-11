// lib/flightData/client.ts
//
// The only place that talks to AeroDataBox.
//
// Environment: live calls happen only when VERCEL_ENV === 'production', or when
// AERODATABOX_FORCE_LIVE=true (manual testing). Development and preview use the
// scenario mocks in ./mock.ts and log "MOCK" on every call. Live calls are
// always subject to the monthly quota policy, including forced-live ones.

import { parseFlightNumber } from '@/lib/flights/flightNumber';
import { LegMismatchError, parseAeroDataBoxResponse, type LegHint, type NormalizedFlight } from '@/lib/flightData/aerodatabox';
import { parseLegs, type FlightLegOption } from '@/lib/flightData/legs';
import { getMockAeroDataBoxPayload } from '@/lib/flightData/mock';
import { isCheckAllowed, type CheckKind } from '@/lib/flightData/quotaPolicy';
import { getQuotaStatus, recordProviderCall } from '@/lib/flightData/quotaStore';

export type FlightLookupErrorCode =
    | 'INVALID_FLIGHT_NUMBER'
    | 'MISSING_CREDENTIALS'
    | 'QUOTA_BLOCKED'
    | 'NOT_FOUND'
    | 'HTTP_ERROR'
    | 'EXCEPTION';

export type FlightLookupFailure = { ok: false; code: FlightLookupErrorCode; message: string; httpStatus?: number };

export type FlightLookupResult =
    | { ok: true; flight: NormalizedFlight }
    | FlightLookupFailure;

// All legs of a flight number on a date (the form's "find my flight" step).
export type FlightLegsResult =
    | { ok: true; legs: FlightLegOption[] }
    | FlightLookupFailure;

const REQUEST_TIMEOUT_MS = 10_000;

export function isLiveFlightData(env: Record<string, string | undefined> = process.env): boolean {
    return env.VERCEL_ENV === 'production' || env.AERODATABOX_FORCE_LIVE === 'true';
}

type FetchedPayload = { ok: true; payload: unknown; source: 'LIVE' | 'MOCK'; flightNumber: string } | FlightLookupFailure;

// Mock scenario in dev/preview, live call (quota-checked, counted) in production.
// Everything up to the raw payload; callers parse it.
async function fetchPayload(flightNumberInput: string, date: string, kind: CheckKind): Promise<FetchedPayload> {
    const parsed = parseFlightNumber(flightNumberInput);
    if (!parsed) {
        return { ok: false, code: 'INVALID_FLIGHT_NUMBER', message: `Invalid flight number: ${flightNumberInput}` };
    }
    const flightNumber = parsed.full;

    if (!isLiveFlightData()) {
        const payload = getMockAeroDataBoxPayload(flightNumber, date);
        console.log(`[AeroDataBox] MOCK response for ${flightNumber} on ${date} (${kind}) — not real flight data`);
        return { ok: true, payload, source: 'MOCK', flightNumber };
    }

    const apiKey = process.env.RAPID_API_KEY;
    const host = process.env.RAPID_API_HOST_AERODATABOX;
    if (!apiKey || !host) {
        console.error('[AeroDataBox] RAPID_API_KEY / RAPID_API_HOST_AERODATABOX not configured');
        return { ok: false, code: 'MISSING_CREDENTIALS', message: 'AeroDataBox API credentials not configured' };
    }

    const quota = await getQuotaStatus();
    if (!isCheckAllowed(kind, quota.level)) {
        console.warn(
            `[AeroDataBox] ${kind} for ${flightNumber} skipped: quota ${Math.round(quota.ratio * 100)}% (${quota.level})`,
        );
        return { ok: false, code: 'QUOTA_BLOCKED', message: `Quota level ${quota.level} blocks ${kind}` };
    }

    const url = `https://${host}/flights/number/${encodeURIComponent(flightNumber)}/${date}`;

    let response: Response;
    try {
        response = await fetch(url, {
            method: 'GET',
            headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': host },
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
    } catch (error: any) {
        console.error(`[AeroDataBox] LIVE request failed for ${flightNumber} on ${date}: ${error?.message || error}`);
        return { ok: false, code: 'EXCEPTION', message: error?.message || 'AeroDataBox request failed' };
    }

    // The request reached the provider, so it counts against the quota.
    await recordProviderCall(response.headers);

    if (response.status === 204 || response.status === 404) {
        return { ok: false, code: 'NOT_FOUND', message: `No flight found for ${flightNumber} on ${date}` };
    }

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        console.error(`[AeroDataBox] LIVE HTTP ${response.status} for ${flightNumber} on ${date}: ${body.slice(0, 300)}`);
        return { ok: false, code: 'HTTP_ERROR', message: `AeroDataBox returned HTTP ${response.status}`, httpStatus: response.status };
    }

    try {
        return { ok: true, payload: await response.json(), source: 'LIVE', flightNumber };
    } catch (error: any) {
        console.error(`[AeroDataBox] LIVE response parse failed for ${flightNumber}: ${error?.message || error}`);
        return { ok: false, code: 'EXCEPTION', message: 'Could not parse AeroDataBox response' };
    }
}

// `options.leg`: the airports the trip was registered on. For a number that flies
// several legs a day, the matching leg is used (never another leg's times).
export async function lookupFlight(
    flightNumberInput: string,
    date: string,
    kind: CheckKind,
    options: { leg?: LegHint } = {},
): Promise<FlightLookupResult> {
    const fetched = await fetchPayload(flightNumberInput, date, kind);
    if (!fetched.ok) return fetched;
    const { payload, source, flightNumber } = fetched;

    try {
        const flight = parseAeroDataBoxResponse(payload, flightNumber, date, source, options.leg);
        if (!flight) {
            return source === 'MOCK'
                ? { ok: false, code: 'NOT_FOUND', message: `MOCK: no flight for ${flightNumber} on ${date}` }
                : { ok: false, code: 'NOT_FOUND', message: `No flight found for ${flightNumber} on ${date}` };
        }
        if (source === 'LIVE') console.log(`[AeroDataBox] LIVE ${flightNumber} on ${date} (${kind}): status=${flight.rawStatus}`);
        return { ok: true, flight };
    } catch (error: any) {
        if (error instanceof LegMismatchError) {
            console.error(`[AeroDataBox] ${flightNumber} on ${date}: ${error.message}`);
            return { ok: false, code: 'EXCEPTION', message: error.message };
        }
        console.error(`[AeroDataBox] ${source} response parse failed for ${flightNumber}: ${error?.message || error}`);
        return { ok: false, code: 'EXCEPTION', message: 'Could not parse AeroDataBox response' };
    }
}

// Every leg of the flight number on that day (one option per physical leg).
export async function lookupFlightLegs(flightNumberInput: string, date: string): Promise<FlightLegsResult> {
    const fetched = await fetchPayload(flightNumberInput, date, 'FORM_LOOKUP');
    if (!fetched.ok) return fetched;
    const legs = parseLegs(fetched.payload);
    if (legs.length === 0) {
        return { ok: false, code: 'NOT_FOUND', message: `No flight found for ${fetched.flightNumber} on ${date}` };
    }
    console.log(`[AeroDataBox] ${fetched.source} legs for ${fetched.flightNumber} on ${date}: ${legs.length}`);
    return { ok: true, legs };
}

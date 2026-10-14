// lib/guardian/monitorSelection.ts
//
// POST /api/trips/monitor (signed-in "Add booked trip"): the browser sends only
// flight number, date and the KEY of the leg it chose. Route and times are
// resolved here from the server's own FlightLookupCache entry (the one
// /api/flights/lookup wrote). Unlike the anonymous sign-up, nothing is saved
// unverified: no fresh lookup, an unknown key or a missing key all fail.

import { isCacheFresh, resolveFlightSelection, type LookupCacheEntry } from '@/lib/flightData/formLookup';
import type { FlightLegOption } from '@/lib/flightData/legs';
import { verifiedSegmentData, type VerifiedSegmentData } from '@/lib/guardian/verifiedFlight';

export type MonitorSelectionCode = 'FLIGHT_NOT_FOUND' | 'INVALID_SEGMENT';

export type MonitorSelection =
    | { ok: true; leg: FlightLegOption; segment: VerifiedSegmentData }
    | { ok: false; code: MonitorSelectionCode };

export function resolveMonitorSelection(input: {
    cache: LookupCacheEntry | null;
    date: string;
    departureDate: Date;
    legKey?: string | null;
    now?: Date;
}): MonitorSelection {
    const now = input.now ?? new Date();
    const { cache, legKey } = input;
    if (!cache || !isCacheFresh(cache, now)) return { ok: false, code: 'INVALID_SEGMENT' };
    if (cache.outcome === 'NOT_FOUND') return { ok: false, code: 'FLIGHT_NOT_FOUND' };
    if (!legKey) return { ok: false, code: 'INVALID_SEGMENT' };

    const selection = resolveFlightSelection({ cache, date: input.date, legKey, now });
    if (selection.action !== 'VERIFIED') return { ok: false, code: 'INVALID_SEGMENT' };
    const segment = verifiedSegmentData(selection.leg, input.departureDate);
    if (!segment) return { ok: false, code: 'INVALID_SEGMENT' };
    return { ok: true, leg: selection.leg, segment };
}

const PNR_REGEX = /^[A-Z0-9]{5,8}$/;

/** Empty → null (no PNR); valid → uppercased; anything else → 'INVALID'. */
export function normalizePnr(input: unknown): string | null | 'INVALID' {
    if (input === undefined || input === null) return null;
    if (typeof input !== 'string') return 'INVALID';
    const value = input.trim().toUpperCase();
    if (!value) return null;
    return PNR_REGEX.test(value) ? value : 'INVALID';
}

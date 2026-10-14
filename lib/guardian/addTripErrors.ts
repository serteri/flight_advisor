// lib/guardian/addTripErrors.ts
//
// "Add booked trip" modal: which response means which inline error, and the
// final user-facing copy. Pure, so the mapping is tested without a browser.
// A provider that is unavailable is NEVER reported as "flight not found".

import { MAX_DAYS_AHEAD } from '@/lib/flights/flightDateRule';
import type { FlightLegOption } from '@/lib/flightData/legs';

export type AddTripErrorCode =
    | 'INVALID_FLIGHT_FORMAT'
    | 'INVALID_DATE'
    | 'DATE_PAST'
    | 'DATE_TOO_FAR'
    | 'FLIGHT_NOT_FOUND'
    | 'MULTIPLE_LEGS'
    | 'INVALID_SEGMENT'
    | 'INVALID_PNR'
    | 'RATE_LIMITED'
    | 'PROVIDER_UNAVAILABLE'
    | 'NETWORK_ERROR'
    | 'SAVE_FAILED';

export interface AddTripErrorCopy {
    title: string;
    message: string;
    note?: string;
}

export const ADD_TRIP_ERRORS: Record<AddTripErrorCode, AddTripErrorCopy> = {
    INVALID_FLIGHT_FORMAT: { title: 'Check the flight number', message: 'Enter a valid flight number, for example QF549.' },
    INVALID_DATE: { title: 'Check the flight date', message: 'Choose a valid upcoming flight date.' },
    DATE_PAST: { title: 'This flight date has passed', message: 'Choose today or a future date.' },
    DATE_TOO_FAR: {
        title: 'Flight date is too far ahead',
        message: 'FlightAgent can currently track flights only within the supported booking window.',
        note: `Choose a date within the next ${MAX_DAYS_AHEAD} days.`,
    },
    FLIGHT_NOT_FOUND: {
        title: "We couldn't find this flight",
        message: "We couldn't find this flight for the selected date. Check the flight number and date, then try again.",
        note: 'Airline schedules can also change or may not yet be available.',
    },
    MULTIPLE_LEGS: {
        title: 'Choose your flight',
        message: 'This flight number has more than one route on this date. Select the flight that matches your booking.',
    },
    INVALID_SEGMENT: {
        title: 'Flight selection changed',
        message: 'The selected flight is no longer available. Search again and choose your flight.',
    },
    INVALID_PNR: {
        title: 'Check the booking reference',
        message: 'A booking reference (PNR) has 5 to 8 letters and numbers. You can also leave it empty.',
    },
    RATE_LIMITED: {
        title: 'Too many searches',
        message: "You've made several flight searches recently. Please wait a little while and try again.",
    },
    PROVIDER_UNAVAILABLE: {
        title: "We can't verify this flight right now",
        message: 'Our flight-data provider is temporarily unavailable. Please try again shortly.',
    },
    NETWORK_ERROR: {
        title: 'Connection problem',
        message: "We couldn't reach FlightAgent. Check your connection and try again.",
    },
    SAVE_FAILED: {
        title: "We couldn't add this trip",
        message: "Your flight was found, but we couldn't start monitoring it. Please try again.",
    },
};

export const FREE_PLAN_LIMIT_NOTE = 'Your Free plan includes one monitored flight at a time.';

export const ADD_TRIP_SUCCESS = {
    title: 'Flight monitoring is active',
    message: "We'll monitor this flight for important disruptions and email you when something meaningful changes.",
    primary: 'View monitored flight',
    secondary: 'Back to Booked Trips',
} as const;

export type LookupOutcome =
    | { kind: 'FOUND'; options: FlightLegOption[] }
    | { kind: 'ERROR'; code: AddTripErrorCode };

const FIELD_CODES: Record<string, AddTripErrorCode> = {
    INVALID_FLIGHT: 'INVALID_FLIGHT_FORMAT',
    INVALID_DATE: 'INVALID_DATE',
    DATE_PAST: 'DATE_PAST',
    DATE_TOO_FAR: 'DATE_TOO_FAR',
};

const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

/** Response of POST /api/flights/lookup (the single lookup source) → card list or inline error. */
export function classifyLookupResponse(httpStatus: number, data: unknown): LookupOutcome {
    const body = asRecord(data);
    if (httpStatus === 429 || body.status === 'RATE_LIMITED') return { kind: 'ERROR', code: 'RATE_LIMITED' };
    if (httpStatus === 400) {
        return { kind: 'ERROR', code: FIELD_CODES[String(body.code)] ?? 'PROVIDER_UNAVAILABLE' };
    }
    if (httpStatus >= 200 && httpStatus < 300) {
        if (body.status === 'FOUND' && Array.isArray(body.options) && body.options.length > 0) {
            return { kind: 'FOUND', options: body.options as FlightLegOption[] };
        }
        if (body.status === 'NOT_FOUND') return { kind: 'ERROR', code: 'FLIGHT_NOT_FOUND' };
    }
    // SKIPPED (quota / provider), 5xx, malformed body: we could not verify, which is not "not found".
    return { kind: 'ERROR', code: 'PROVIDER_UNAVAILABLE' };
}

export type SaveOutcome =
    | { kind: 'OK'; tripId: string | null }
    | { kind: 'LIMIT'; feature: string; current?: number; limit?: number }
    | { kind: 'ERROR'; code: AddTripErrorCode };

/** Response of POST /api/trips/monitor. */
export function classifySaveResponse(httpStatus: number, data: unknown): SaveOutcome {
    const body = asRecord(data);
    if (httpStatus === 402) {
        return {
            kind: 'LIMIT',
            feature: typeof body.feature === 'string' ? body.feature : 'monitored_trip',
            current: typeof body.current === 'number' ? body.current : undefined,
            limit: typeof body.limit === 'number' ? body.limit : undefined,
        };
    }
    if (httpStatus >= 200 && httpStatus < 300) {
        return { kind: 'OK', tripId: typeof body.tripId === 'string' ? body.tripId : null };
    }
    if (httpStatus === 400) {
        if (body.code === 'FLIGHT_NOT_FOUND') return { kind: 'ERROR', code: 'FLIGHT_NOT_FOUND' };
        if (body.code === 'INVALID_SEGMENT') return { kind: 'ERROR', code: 'INVALID_SEGMENT' };
        if (body.code === 'INVALID_PNR') return { kind: 'ERROR', code: 'INVALID_PNR' };
        const fieldCode = FIELD_CODES[String(body.code)];
        if (fieldCode) return { kind: 'ERROR', code: fieldCode };
    }
    return { kind: 'ERROR', code: 'SAVE_FAILED' };
}

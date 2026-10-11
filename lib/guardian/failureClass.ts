// lib/guardian/failureClass.ts
//
// Classifies a failed provider lookup and decides whether the check may be
// retried. Pure and deterministic so the policy is testable.
//
//   TEMPORARY       5xx, 408, 429, timeouts / network errors  -> retry (bounded)
//   QUOTA           our own quota guard blocked the call       -> no retry (skipped)
//   AUTHENTICATION  missing credentials, 401, 403              -> no retry, loud error
//   NOT_FOUND       provider does not know the flight          -> handled elsewhere
//   INVALID_INPUT   bad flight number, 400/422                 -> no retry
//   PERMANENT       other 4xx                                  -> no retry
//   UNKNOWN         anything else (e.g. unparsable payload)    -> no retry
//
// Retries ride on QStash's own delivery retries (the publish sets retries: 3):
// the handler answers 503 and QStash redelivers with an Upstash-Retried header
// that counts the redeliveries, which bounds the loop without a schema change.

import type { FailureClass } from '@/lib/guardian/failureText';

export interface LookupFailureLike {
    code: string;
    message?: string;
    httpStatus?: number;
}

// QStash publishes with retries: 3 -> redeliveries number 1..3 (header 0 = first delivery).
export const MAX_CHECK_RETRIES = 3;

const NETWORK_PATTERN = /timeout|timed out|abort|fetch failed|network|econn|enotfound|eai_again|socket|etimedout|und_err/i;

export function classifyLookupFailure(failure: LookupFailureLike): FailureClass {
    switch (failure.code) {
        case 'INVALID_FLIGHT_NUMBER':
            return 'INVALID_INPUT';
        case 'MISSING_CREDENTIALS':
            return 'AUTHENTICATION';
        case 'QUOTA_BLOCKED':
            return 'QUOTA';
        case 'NOT_FOUND':
            return 'NOT_FOUND';
        case 'HTTP_ERROR': {
            const status = failure.httpStatus;
            if (status === undefined) return 'UNKNOWN';
            if (status === 401 || status === 403) return 'AUTHENTICATION';
            if (status === 408 || status === 429 || status >= 500) return 'TEMPORARY';
            if (status === 400 || status === 422) return 'INVALID_INPUT';
            return 'PERMANENT';
        }
        case 'EXCEPTION':
            return NETWORK_PATTERN.test(failure.message ?? '') ? 'TEMPORARY' : 'UNKNOWN';
        default:
            return 'UNKNOWN';
    }
}

export const isRetryableClass = (failureClass: FailureClass): boolean => failureClass === 'TEMPORARY';

// `retried` = number of redeliveries so far (Upstash-Retried header, 0 on the first delivery).
export function shouldRetry(failureClass: FailureClass, retried: number): boolean {
    return isRetryableClass(failureClass) && retried < MAX_CHECK_RETRIES;
}

export function retriedFromHeader(value: string | null | undefined): number {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

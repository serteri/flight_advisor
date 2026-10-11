// lib/guardian/failureText.ts
//
// ScheduledTripCheck.error is free text. Failures are written as
// "<CLASS>: <CODE>: <message>" so the ops page can show the failure type
// without a schema change.

export const FAILURE_CLASSES = [
    'TEMPORARY', 'PERMANENT', 'QUOTA', 'AUTHENTICATION', 'NOT_FOUND', 'INVALID_INPUT', 'UNKNOWN',
] as const;
export type FailureClass = (typeof FAILURE_CLASSES)[number];

export function formatFailure(failureClass: FailureClass, code: string, message: string): string {
    return `${failureClass}: ${code}: ${message}`.slice(0, 500);
}

export function parseFailure(error: string | null | undefined): { failureClass: FailureClass | 'UNCLASSIFIED'; code: string | null } {
    const match = /^([A-Z_]+): ([A-Z_]+):/.exec(error ?? '');
    if (match && (FAILURE_CLASSES as readonly string[]).includes(match[1])) {
        return { failureClass: match[1] as FailureClass, code: match[2] };
    }
    return { failureClass: 'UNCLASSIFIED', code: null };
}

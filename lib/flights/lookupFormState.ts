// lib/flights/lookupFormState.ts
//
// Client-side state of the form's "find my flight" step and the rule for when
// the form may be submitted. Pure, so it is unit-tested; the server enforces the
// same rules itself (lib/flightData/formLookup.ts → resolveFlightSelection).

import type { FlightLegOption } from '@/lib/flightData/legs';

export type LookupOption = FlightLegOption;

export type LookupState =
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'found'; options: LookupOption[] }
    | { kind: 'notFound'; blocking: boolean }   // blocking: ≤7 days to departure
    | { kind: 'skipped' }                       // quota / provider trouble: form works as before
    | { kind: 'rateLimited' };                  // same: not a reason to stop the visitor

export type SubmitGate =
    | 'LOOKUP_REQUIRED'   // nothing looked up yet: submitting runs the lookup instead
    | 'LOOKUP_PENDING'
    | 'SELECT_SEGMENT'    // several legs and none chosen
    | 'CONFIRM_FLIGHT'    // one leg, "This is my flight" not pressed
    | 'FLIGHT_NOT_FOUND';

/** Why the form must not be sent right now (null = it may be sent). */
export function submitGate(state: LookupState, selectedKey: string | null): SubmitGate | null {
    switch (state.kind) {
        case 'idle':
            return 'LOOKUP_REQUIRED';
        case 'loading':
            return 'LOOKUP_PENDING';
        case 'notFound':
            return state.blocking ? 'FLIGHT_NOT_FOUND' : null;
        case 'found':
            if (selectedKey && state.options.some((o) => o.key === selectedKey)) return null;
            return state.options.length > 1 ? 'SELECT_SEGMENT' : 'CONFIRM_FLIGHT';
        default:
            return null;
    }
}

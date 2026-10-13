// lib/flightData/quotaView.ts
//
// Pure operator view of the AeroDataBox quota. Operational guidance only: it
// describes the existing quota behaviour, it does not change it.

import {
    EXPECTED_CALLS_PER_TRIP,
    getQuotaLevel,
    computeUsageRatio,
    type QuotaConfig,
    type QuotaLevel,
} from '@/lib/flightData/quotaPolicy';

export interface QuotaViewInput {
    callsUsed: number;
    unitsUsed: number;
    headerLimit?: number | null;
    headerRemaining?: number | null;
    headerKind?: string | null;
    config: QuotaConfig;
}

export interface QuotaView {
    source: 'PROVIDER_HEADERS' | 'INTERNAL_COUNTER';
    monthlyAllocationUnits: number;
    unitsUsed: number;
    unitsRemaining: number;
    estimatedCallsUsed: number;
    estimatedCallsRemaining: number;
    level: QuotaLevel;
    usedPercent: number;
    /** Normal trips (EXPECTED_CALLS_PER_TRIP provider calls each) the remaining calls can still cover. */
    additionalNormalTrips: number;
}

export function buildQuotaView(input: QuotaViewInput): QuotaView {
    const { config } = input;
    const hasHeaders =
        typeof input.headerLimit === 'number' && input.headerLimit > 0 && typeof input.headerRemaining === 'number';
    // A "requests" rate-limit object counts one unit per call.
    const unitsPerCall = hasHeaders && /request/i.test(input.headerKind ?? '') ? 1 : config.unitsPerCall;

    const allocation = hasHeaders ? input.headerLimit! : config.monthlyQuotaUnits;
    const unitsUsed = hasHeaders ? Math.max(0, input.headerLimit! - input.headerRemaining!) : input.unitsUsed;
    const unitsRemaining = Math.max(0, allocation - unitsUsed);
    const callsRemaining = Math.floor(unitsRemaining / unitsPerCall);
    const ratio = computeUsageRatio(
        { unitsUsed: input.unitsUsed, headerLimit: input.headerLimit, headerRemaining: input.headerRemaining },
        config,
    );

    return {
        source: hasHeaders ? 'PROVIDER_HEADERS' : 'INTERNAL_COUNTER',
        monthlyAllocationUnits: allocation,
        unitsUsed,
        unitsRemaining,
        estimatedCallsUsed: input.callsUsed,
        estimatedCallsRemaining: callsRemaining,
        level: getQuotaLevel(ratio),
        usedPercent: Math.round(ratio * 1000) / 10,
        additionalNormalTrips: Math.floor(callsRemaining / EXPECTED_CALLS_PER_TRIP),
    };
}

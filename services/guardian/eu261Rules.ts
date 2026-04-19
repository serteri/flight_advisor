export type Eu261DisruptionType = 'DELAY' | 'CANCELLED';

export type Eu261Eligibility = true | false | 'unknown';
export type Eu261Confidence = 'low' | 'medium';

export interface Eu261RuleInput {
    eventType: Eu261DisruptionType;
    delayMinutes?: number;
    departureAirport?: string;
    arrivalAirport?: string;
    carrier?: string;
    departsFromScope?: boolean;
    carrierInScope?: boolean;
    distanceKm?: number | null;
}

export interface Eu261Assessment {
    eligible: Eu261Eligibility;
    reason: string;
    compensationRange: 'EUR_250' | 'EUR_400' | 'EUR_600' | null;
    confidence: Eu261Confidence;
}

const EU261_SCOPE_COUNTRIES = new Set([
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
    'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK',
    'SI', 'ES', 'SE',
    'IS', 'LI', 'NO',
    'CH', 'GB', 'UK',
]);

const EU261_SCOPE_CARRIERS = new Set([
    'AF', 'AZ', 'BA', 'BT', 'DY', 'EI', 'EW', 'FI', 'FR', 'IB', 'KL', 'LH', 'LO',
    'LX', 'OS', 'SK', 'TP', 'U2', 'VY', 'W6', 'LS', 'EC', 'EN', 'SN', 'JU', 'RO',
]);

const normalizeCode = (value: unknown): string => String(value || '').trim().toUpperCase();

const resolveCompensationRange = (distanceKm?: number | null): Eu261Assessment['compensationRange'] => {
    if (!Number.isFinite(distanceKm) || !distanceKm || distanceKm <= 0) return null;
    if (distanceKm <= 1500) return 'EUR_250';
    if (distanceKm <= 3500) return 'EUR_400';
    return 'EUR_600';
};

export const isEu261Country = (countryCode?: string): boolean => {
    const normalized = normalizeCode(countryCode);
    return normalized ? EU261_SCOPE_COUNTRIES.has(normalized) : false;
};

export const isEu261Carrier = (carrierCode?: string): boolean => {
    const normalized = normalizeCode(carrierCode);
    return normalized ? EU261_SCOPE_CARRIERS.has(normalized) : false;
};

export function assessEu261ForDisruption(input: Eu261RuleInput): Eu261Assessment {
    const departsFromScope = input.departsFromScope;
    const carrierInScope = input.carrierInScope;
    const inScope = departsFromScope === true || carrierInScope === true;
    const explicitlyOutOfScope = departsFromScope === false && carrierInScope === false;

    if (input.eventType === 'DELAY') {
        const delayMinutes = Number(input.delayMinutes || 0);

        if (delayMinutes < 180) {
            return {
                eligible: false,
                reason: 'Arrival delay is below 180 minutes, so EU261 compensation is unlikely.',
                compensationRange: null,
                confidence: explicitlyOutOfScope || inScope ? 'medium' : 'low',
            };
        }

        if (inScope) {
            return {
                eligible: true,
                reason: 'Delay is 180+ minutes and route/carrier appears within EU261 scope; likely eligible.',
                compensationRange: resolveCompensationRange(input.distanceKm),
                confidence: 'medium',
            };
        }

        if (explicitlyOutOfScope) {
            return {
                eligible: false,
                reason: 'Delay is 180+ minutes but route/carrier appears outside EU261 scope.',
                compensationRange: null,
                confidence: 'medium',
            };
        }

        return {
            eligible: 'unknown',
            reason: 'Delay is 180+ minutes but EU261 scope is unclear with current route/carrier data.',
            compensationRange: null,
            confidence: 'low',
        };
    }

    if (inScope) {
        return {
            eligible: true,
            reason: 'Cancellation occurred and route/carrier appears within EU261 scope; likely eligible.',
            compensationRange: resolveCompensationRange(input.distanceKm),
            confidence: 'medium',
        };
    }

    if (explicitlyOutOfScope) {
        return {
            eligible: false,
            reason: 'Cancellation occurred but route/carrier appears outside EU261 scope.',
            compensationRange: null,
            confidence: 'medium',
        };
    }

    return {
        eligible: 'unknown',
        reason: 'Cancellation detected, but EU261 scope is unclear with current route/carrier data.',
        compensationRange: null,
        confidence: 'low',
    };
}

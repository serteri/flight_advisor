// lib/compensation/engine.ts
//
// The single EU261 / UK261 compensation engine. Pure: no I/O, no clock
// (callers pass every timestamp), deterministic airport data.
//
// Output wording is deliberately non-committal ("may be eligible"): the
// engine works from flight data only and can never rule out extraordinary
// circumstances, which the airline may invoke.
//
// Rules implemented (Regulation (EC) 261/2004 as applied by the CJEU —
// Sturgeon C-402/07 for delays — and the retained UK version "UK261"):
//  Scope EU261: departure from an EU/EEA/Swiss airport (any carrier), or
//               arrival there from outside on an EU/EEA/Swiss ("Community") carrier.
//  Scope UK261: departure from a UK airport (any carrier), or arrival in the UK
//               from outside on a UK or EU carrier.
//  Distance:    great-circle from the first departure to the FINAL destination.
//  Amounts:     ≤1500 km €250 / £220; intra-zone >1500 km and other 1500–3500 km
//               €400 / £350; other >3500 km €600 / £520.
//  Delay:       arrival delay ≥180 min; >3500 km band with 180–239 min → 50 %.
//  Cancellation: eligible when notified <14 days before departure; unknown
//               notice → NEEDS_INFO.
//  Australia domestic: no statutory compensation scheme → NOT_ELIGIBLE.

import airports from 'airports';
import { AIRPORT_COORDINATES } from './airportCoordinates';
import { calculateHaversineDistanceKm } from './haversine';

export type CompensationRegime = 'EU261' | 'UK261' | 'NONE';
export type CompensationStatus = 'LIKELY_ELIGIBLE' | 'NOT_ELIGIBLE' | 'NEEDS_INFO';
export type CompensationCurrency = 'EUR' | 'GBP';

export interface CompensationInput {
    disruption: 'DELAY' | 'CANCELLATION';
    /** IATA code of the operating carrier (flight-number prefix is used as a proxy). */
    carrierIata: string | null;
    /** First departure airport of the journey (IATA). */
    originIata: string;
    /** Final destination of the journey (IATA) — not the first connection. */
    finalDestinationIata: string;

    /** ISO timestamps (UTC). */
    scheduledDepartureUtc?: string | null;
    scheduledArrivalUtc?: string | null;
    /** Gate arrival (doors open / on-block). Preferred when known. */
    actualGateArrivalUtc?: string | null;
    /** Any other actual arrival time (e.g. provider "actual"/revised). */
    actualArrivalUtc?: string | null;
    /** Pre-computed arrival delay, used only when no timestamps are given. */
    arrivalDelayMinutes?: number | null;

    /** When the passenger was told about the cancellation (ISO). */
    cancellationNoticeUtc?: string | null;
}

export interface CompensationResult {
    regime: CompensationRegime;
    status: CompensationStatus;
    amount: number | null;
    currency: CompensationCurrency | null;
    distanceKm: number | null;
    reasons: string[];
}

export interface AirportInfo {
    country: string;
    lat: number;
    lon: number;
}

export type AirportLookup = (iata: string) => AirportInfo | null;

// ── Reference data ─────────────────────────────────────────────────────────

// EU member states, their outermost regions that carry their own ISO codes,
// EEA states and Switzerland (EU261 applies there by agreement).
const EU261_ZONE = new Set([
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT',
    'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
    'GP', 'MQ', 'GF', 'RE', 'YT', 'MF', // French outermost regions
    'IS', 'LI', 'NO', // EEA
    'CH',
]);

const UK_ZONE = new Set(['GB']);

// Carriers holding an EU/EEA/Swiss operating licence ("Community carriers").
export const COMMUNITY_CARRIERS = new Set([
    'A3', 'AF', 'AY', 'AZ', 'BT', 'CL', 'D8', 'DE', 'DX', 'DY', 'EC', 'EI', 'EN', 'EW', 'FB',
    'FI', 'FR', 'HV', 'I2', 'IB', 'KL', 'LG', 'LH', 'LO', 'LX', 'NT', 'OA', 'OG', 'OK', 'OR',
    'OS', 'OU', 'RK', 'RO', 'SK', 'SN', 'TO', 'TP', 'UX', 'V7', 'VY', 'W4', 'W6', 'WF', 'WK',
    'X3', 'YM', '2L', '4Y',
]);

// Carriers holding a UK operating licence. U2 = easyJet UK (easyJet Europe
// flies as EC but markets U2 numbers — the operating carrier is not known
// from the flight number alone).
export const UK_CARRIERS = new Set(['BA', 'BY', 'LM', 'LS', 'T3', 'U2', 'VS', 'W9']);

// Carriers known to be neither Community nor UK. Anything not listed in any
// set is "unknown" and yields NEEDS_INFO when the carrier decides scope.
export const OTHER_CARRIERS = new Set([
    '3K', '6E', '9W', 'AA', 'AC', 'AI', 'AS', 'B6', 'CA', 'CI', 'CX', 'CZ', 'DL', 'EK', 'ET',
    'EY', 'FZ', 'G3', 'GA', 'GF', 'JL', 'JQ', 'KE', 'KQ', 'LA', 'LY', 'MH', 'MS', 'MU', 'NH',
    'NZ', 'OZ', 'PC', 'PR', 'QF', 'QR', 'RJ', 'SA', 'SQ', 'SV', 'TG', 'TK', 'UA', 'UL', 'VA',
    'VN', 'WN', 'WS', 'XQ',
]);

export type CarrierZone = 'COMMUNITY' | 'UK' | 'OTHER' | 'UNKNOWN';

export function classifyCarrier(iata: string | null | undefined): CarrierZone {
    const code = String(iata || '').trim().toUpperCase();
    if (!code) return 'UNKNOWN';
    if (COMMUNITY_CARRIERS.has(code)) return 'COMMUNITY';
    if (UK_CARRIERS.has(code)) return 'UK';
    if (OTHER_CARRIERS.has(code)) return 'OTHER';
    return 'UNKNOWN';
}

const AIRPORTS_BY_IATA: Map<string, AirportInfo> = (() => {
    const map = new Map<string, AirportInfo>();
    for (const item of airports as Array<{ iata?: string; iso?: string; lat?: string; lon?: string }>) {
        const iata = item.iata?.toUpperCase();
        const lat = Number(item.lat);
        const lon = Number(item.lon);
        if (!iata || !item.iso || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        map.set(iata, { country: item.iso.toUpperCase(), lat, lon });
    }
    // Curated coordinates win over the bulk dataset.
    for (const [iata, info] of Object.entries(AIRPORT_COORDINATES)) {
        map.set(iata.toUpperCase(), { country: info.country.toUpperCase(), lat: info.lat, lon: info.lng });
    }
    return map;
})();

export const defaultAirportLookup: AirportLookup = (iata) =>
    AIRPORTS_BY_IATA.get(String(iata || '').trim().toUpperCase()) ?? null;

// ── Helpers ────────────────────────────────────────────────────────────────

const EXTRAORDINARY_REASON =
    'The airline may claim extraordinary circumstances (e.g. weather, air-traffic-control strikes, security risks), which would remove the right to compensation. This cannot be determined from flight data.';

const inEu = (country: string) => EU261_ZONE.has(country);
const inUk = (country: string) => UK_ZONE.has(country);

const toMs = (iso?: string | null): number | null => {
    if (!iso) return null;
    const ms = Date.parse(iso);
    return Number.isNaN(ms) ? null : ms;
};

interface RegimeDecision {
    regime: CompensationRegime;
    status: 'IN_SCOPE' | 'OUT_OF_SCOPE' | 'NEEDS_INFO';
    reason: string;
    note?: string;
}

// Scope only (no amounts). Exported for callers that just need the regime.
export function determineRegime(
    originCountry: string,
    destinationCountry: string,
    carrier: CarrierZone,
): RegimeDecision {
    if (inEu(originCountry)) {
        return {
            regime: 'EU261',
            status: 'IN_SCOPE',
            reason: 'Departs from an EU/EEA/Swiss airport, so EU261 applies regardless of the airline.',
            note: inUk(destinationCountry) && carrier === 'UK'
                ? 'UK261 may also apply (arrival in the UK on a UK carrier); compensation can only be claimed once.'
                : undefined,
        };
    }

    if (inUk(originCountry)) {
        return {
            regime: 'UK261',
            status: 'IN_SCOPE',
            reason: 'Departs from a UK airport, so UK261 applies regardless of the airline.',
            note: inEu(destinationCountry) && carrier === 'COMMUNITY'
                ? 'EU261 may also apply (arrival in the EU on an EU carrier); compensation can only be claimed once.'
                : undefined,
        };
    }

    if (inEu(destinationCountry)) {
        if (carrier === 'COMMUNITY') {
            return { regime: 'EU261', status: 'IN_SCOPE', reason: 'Arrives in the EU/EEA/Switzerland from outside on an EU/EEA/Swiss carrier.' };
        }
        if (carrier === 'UNKNOWN') {
            return { regime: 'EU261', status: 'NEEDS_INFO', reason: 'Arrives in the EU/EEA/Switzerland from outside; EU261 applies only if the operating airline is an EU/EEA/Swiss carrier, which could not be determined.' };
        }
        return { regime: 'NONE', status: 'OUT_OF_SCOPE', reason: 'Arrives in the EU/EEA/Switzerland from outside on a non-EU carrier, so EU261 does not apply.' };
    }

    if (inUk(destinationCountry)) {
        if (carrier === 'UK' || carrier === 'COMMUNITY') {
            return { regime: 'UK261', status: 'IN_SCOPE', reason: 'Arrives in the UK from outside on a UK or EU carrier.' };
        }
        if (carrier === 'UNKNOWN') {
            return { regime: 'UK261', status: 'NEEDS_INFO', reason: 'Arrives in the UK from outside; UK261 applies only if the operating airline is a UK or EU carrier, which could not be determined.' };
        }
        return { regime: 'NONE', status: 'OUT_OF_SCOPE', reason: 'Arrives in the UK from outside on a non-UK/EU carrier, so UK261 does not apply.' };
    }

    return { regime: 'NONE', status: 'OUT_OF_SCOPE', reason: 'Neither departs from nor arrives in the EU/EEA/Switzerland or the UK, so neither EU261 nor UK261 applies.' };
}

interface Band {
    amount: number;
    longHaul: boolean; // the >3500 km non-intra-zone band (50 % reduction applies)
    description: string;
}

export function compensationBand(regime: 'EU261' | 'UK261', distanceKm: number, intraZone: boolean): Band {
    const [low, mid, high] = regime === 'EU261' ? [250, 400, 600] : [220, 350, 520];
    const zoneName = regime === 'EU261' ? 'intra-EU' : 'domestic UK';
    if (distanceKm <= 1500) {
        return { amount: low, longHaul: false, description: `distance ${distanceKm} km (≤1500 km)` };
    }
    if (intraZone) {
        return { amount: mid, longHaul: false, description: `${zoneName} flight of ${distanceKm} km (>1500 km)` };
    }
    if (distanceKm <= 3500) {
        return { amount: mid, longHaul: false, description: `distance ${distanceKm} km (1500–3500 km)` };
    }
    return { amount: high, longHaul: true, description: `distance ${distanceKm} km (>3500 km)` };
}

// Arrival delay in minutes, preferring gate arrival. Returns the note to add
// to reasons about which measurement was used.
function resolveArrivalDelay(input: CompensationInput): { minutes: number | null; note: string | null } {
    const scheduled = toMs(input.scheduledArrivalUtc);
    const gate = toMs(input.actualGateArrivalUtc);
    const actual = toMs(input.actualArrivalUtc);

    if (scheduled !== null && gate !== null) {
        return { minutes: Math.max(0, Math.round((gate - scheduled) / 60000)), note: null };
    }
    if (scheduled !== null && actual !== null) {
        return {
            minutes: Math.max(0, Math.round((actual - scheduled) / 60000)),
            note: 'Gate arrival (doors-open) time was not available; the reported actual arrival time was used instead.',
        };
    }
    if (typeof input.arrivalDelayMinutes === 'number' && Number.isFinite(input.arrivalDelayMinutes)) {
        return {
            minutes: Math.max(0, Math.round(input.arrivalDelayMinutes)),
            note: 'Delay was taken from a pre-computed arrival delay, not from gate arrival time.',
        };
    }
    return { minutes: null, note: null };
}

// Scope-only zone for guidance features (e.g. the disruption playbook).
// AU_DOMESTIC replaces the former, incorrect "DGCA" label (DGCA is India's
// regulator; Australia has no statutory compensation scheme).
export type RegulationZone = CompensationRegime | 'AU_DOMESTIC';

export function determineRegulationZone(
    params: { origin: string; destination: string; carrier: string | null },
    lookup: AirportLookup = defaultAirportLookup,
): RegulationZone {
    const origin = lookup(params.origin);
    const destination = lookup(params.destination);
    if (!origin || !destination) return 'NONE';
    if (origin.country === 'AU' && destination.country === 'AU') return 'AU_DOMESTIC';
    const decision = determineRegime(origin.country, destination.country, classifyCarrier(params.carrier));
    // NEEDS_INFO still names the regime that may apply.
    return decision.status === 'OUT_OF_SCOPE' ? 'NONE' : decision.regime;
}

// ── Engine ─────────────────────────────────────────────────────────────────

export function evaluateCompensation(
    input: CompensationInput,
    lookup: AirportLookup = defaultAirportLookup,
): CompensationResult {
    const reasons: string[] = [];
    const origin = lookup(input.originIata);
    const destination = lookup(input.finalDestinationIata);

    if (!origin || !destination) {
        const missing = [!origin ? input.originIata : null, !destination ? input.finalDestinationIata : null]
            .filter(Boolean)
            .join(', ');
        return {
            regime: 'NONE',
            status: 'NEEDS_INFO',
            amount: null,
            currency: null,
            distanceKm: null,
            reasons: [`Airport data is missing for ${missing || 'the route'}, so scope and distance cannot be determined.`],
        };
    }

    const distanceKm = Math.round(calculateHaversineDistanceKm(
        { lat: origin.lat, lng: origin.lon },
        { lat: destination.lat, lng: destination.lon },
    ));

    if (origin.country === 'AU' && destination.country === 'AU') {
        return {
            regime: 'NONE',
            status: 'NOT_ELIGIBLE',
            amount: null,
            currency: null,
            distanceKm,
            reasons: ['no statutory compensation scheme', 'Australian domestic flights have no statutory cash compensation for delays or cancellations; refunds and care depend on airline policy and Australian Consumer Law.'],
        };
    }

    const carrierZone = classifyCarrier(input.carrierIata);
    const decision = determineRegime(origin.country, destination.country, carrierZone);
    reasons.push(decision.reason);
    if (decision.note) reasons.push(decision.note);

    if (decision.status === 'OUT_OF_SCOPE') {
        return { regime: 'NONE', status: 'NOT_ELIGIBLE', amount: null, currency: null, distanceKm, reasons };
    }

    const regime = decision.regime as 'EU261' | 'UK261';
    const currency: CompensationCurrency = regime === 'EU261' ? 'EUR' : 'GBP';
    const intraZone = regime === 'EU261'
        ? inEu(origin.country) && inEu(destination.country)
        : inUk(origin.country) && inUk(destination.country);
    const band = compensationBand(regime, distanceKm, intraZone);
    reasons.push(`Distance from ${input.originIata.toUpperCase()} to the final destination ${input.finalDestinationIata.toUpperCase()}: ${band.description}.`);

    if (decision.status === 'NEEDS_INFO') {
        return { regime, status: 'NEEDS_INFO', amount: null, currency, distanceKm, reasons };
    }

    if (input.disruption === 'CANCELLATION') {
        const departure = toMs(input.scheduledDepartureUtc);
        const notice = toMs(input.cancellationNoticeUtc);
        if (departure === null || notice === null) {
            reasons.push('The date the airline notified you of the cancellation is unknown; compensation depends on whether notice was given at least 14 days before departure.');
            return { regime, status: 'NEEDS_INFO', amount: null, currency, distanceKm, reasons };
        }

        const noticeDays = (departure - notice) / (24 * 60 * 60 * 1000);
        if (noticeDays >= 14) {
            reasons.push(`The cancellation was notified ${Math.floor(noticeDays)} days before departure (14 days or more), so no compensation is due; refund or re-routing rights still apply.`);
            return { regime, status: 'NOT_ELIGIBLE', amount: null, currency, distanceKm, reasons };
        }

        reasons.push(`The cancellation was notified ${Math.max(0, Math.floor(noticeDays))} days before departure (less than 14 days), so you may be eligible for compensation.`);
        reasons.push('Compensation may be reduced or not due if the airline offered re-routing that departed and arrived close to the original times.');
        reasons.push(EXTRAORDINARY_REASON);
        return { regime, status: 'LIKELY_ELIGIBLE', amount: band.amount, currency, distanceKm, reasons };
    }

    const delay = resolveArrivalDelay(input);
    if (delay.note) reasons.push(delay.note);
    if (delay.minutes === null) {
        reasons.push('The arrival delay is not known yet.');
        return { regime, status: 'NEEDS_INFO', amount: null, currency, distanceKm, reasons };
    }

    if (delay.minutes < 180) {
        reasons.push(`Arrival delay of ${delay.minutes} minutes is below the 3-hour threshold.`);
        return { regime, status: 'NOT_ELIGIBLE', amount: null, currency, distanceKm, reasons };
    }

    let amount = band.amount;
    reasons.push(`Arrival delay of ${delay.minutes} minutes is at least 3 hours, so you may be eligible for compensation.`);
    if (band.longHaul && delay.minutes < 240) {
        amount = band.amount / 2;
        reasons.push('For flights over 3500 km with an arrival delay between 3 and 4 hours, compensation may be reduced by 50%.');
    }
    reasons.push(EXTRAORDINARY_REASON);

    return { regime, status: 'LIKELY_ELIGIBLE', amount, currency, distanceKm, reasons };
}

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classifyCarrier, evaluateCompensation, type CompensationInput } from '@/lib/compensation/engine';
import { compensationInputFromFlight } from '@/lib/compensation/fromFlight';
import { parseAeroDataBoxResponse } from '@/lib/flightData/aerodatabox';
import { FIXTURE_BASE_DATE, getMockAeroDataBoxPayload } from '@/lib/flightData/mock';

const SCHED_ARR = '2026-03-10T12:00:00.000Z';
const arrivedAfter = (minutes: number) => new Date(Date.parse(SCHED_ARR) + minutes * 60000).toISOString();

// Delay case with a gate-arrival time `minutes` after schedule.
const delay = (originIata: string, finalDestinationIata: string, carrierIata: string | null, minutes: number): CompensationInput => ({
    disruption: 'DELAY',
    carrierIata,
    originIata,
    finalDestinationIata,
    scheduledArrivalUtc: SCHED_ARR,
    actualGateArrivalUtc: arrivedAfter(minutes),
});

const cancellation = (noticeDaysBefore: number | null): CompensationInput => ({
    disruption: 'CANCELLATION',
    carrierIata: 'LH',
    originIata: 'FRA',
    finalDestinationIata: 'MAD',
    scheduledDepartureUtc: '2026-03-20T08:00:00.000Z',
    cancellationNoticeUtc: noticeDaysBefore === null
        ? null
        : new Date(Date.parse('2026-03-20T08:00:00.000Z') - noticeDaysBefore * 86400000).toISOString(),
});

const fixtureFlight = (flightNumber: string) =>
    parseAeroDataBoxResponse(getMockAeroDataBoxPayload(flightNumber, FIXTURE_BASE_DATE), flightNumber, FIXTURE_BASE_DATE, 'MOCK')!;

const fromFixture = (flightNumber: string, extra: { cancellationNoticeUtc?: string | null } = {}) => {
    const f = fixtureFlight(flightNumber);
    return evaluateCompensation(compensationInputFromFlight(f, {
        originIata: f.origin.iata!,
        finalDestinationIata: f.destination.iata!,
        carrierIata: f.airlineIata,
    }, extra));
};

const EXTRAORDINARY = /extraordinary circumstances/i;

// ── Intra-EU ────────────────────────────────────────────────────────────────

test('1. intra-EU short (MUC→FCO, 200 min) → €250', () => {
    const r = evaluateCompensation(delay('MUC', 'FCO', 'LH', 200));
    assert.equal(r.regime, 'EU261');
    assert.equal(r.status, 'LIKELY_ELIGIBLE');
    assert.equal(r.amount, 250);
    assert.equal(r.currency, 'EUR');
    assert.ok(r.distanceKm! <= 1500);
});

test('2. intra-EU 1500–3500 km (MAD→ARN, 200 min) → €400', () => {
    const r = evaluateCompensation(delay('MAD', 'ARN', 'IB', 200));
    assert.equal(r.amount, 400);
    assert.ok(r.distanceKm! > 1500 && r.distanceKm! <= 3500);
});

test('3. intra-EU long >3500 km (CDG→RUN Réunion, 300 min) → €400, not €600', () => {
    const r = evaluateCompensation(delay('CDG', 'RUN', 'AF', 300));
    assert.equal(r.regime, 'EU261');
    assert.ok(r.distanceKm! > 3500);
    assert.equal(r.amount, 400);
});

test('4. intra-EU long 3–4h delay gets no 50% reduction (band is €400)', () => {
    assert.equal(evaluateCompensation(delay('CDG', 'RUN', 'AF', 200)).amount, 400);
});

// ── Transatlantic ───────────────────────────────────────────────────────────

test('5. transatlantic 3h (fixture XX1180, 185 min) → 50% of €600 = €300', () => {
    const r = fromFixture('XX1180');
    assert.equal(r.regime, 'EU261');
    assert.equal(r.status, 'LIKELY_ELIGIBLE');
    assert.equal(r.amount, 300);
    assert.ok(r.reasons.some((x) => /50%/.test(x)));
});

test('6. transatlantic 4h (fixture XX1240, 245 min) → €600', () => {
    const r = fromFixture('XX1240');
    assert.equal(r.amount, 600);
    assert.equal(r.status, 'LIKELY_ELIGIBLE');
});

test('7. exactly 180 min is eligible (no off-by-one)', () => {
    const r = evaluateCompensation(delay('CDG', 'JFK', 'AF', 180));
    assert.equal(r.status, 'LIKELY_ELIGIBLE');
    assert.equal(r.amount, 300);
});

test('8. 179 min is not eligible', () => {
    const r = evaluateCompensation(delay('CDG', 'JFK', 'AF', 179));
    assert.equal(r.status, 'NOT_ELIGIBLE');
    assert.equal(r.amount, null);
});

test('9. exactly 240 min on >3500 km gets the full amount', () => {
    assert.equal(evaluateCompensation(delay('CDG', 'JFK', 'AF', 240)).amount, 600);
});

// ── Arrivals into the EU ───────────────────────────────────────────────────

test('10. non-EU carrier arriving in the EU (EK DXB→FRA) → out of scope', () => {
    const r = evaluateCompensation(delay('DXB', 'FRA', 'EK', 300));
    assert.equal(r.regime, 'NONE');
    assert.equal(r.status, 'NOT_ELIGIBLE');
    assert.equal(r.amount, null);
});

test('11. EU carrier arriving in the EU (LH JFK→FRA, 200 min) → EU261 €300', () => {
    const r = evaluateCompensation(delay('JFK', 'FRA', 'LH', 200));
    assert.equal(r.regime, 'EU261');
    assert.equal(r.amount, 300);
});

test('12. unknown carrier arriving in the EU → NEEDS_INFO', () => {
    const r = evaluateCompensation(delay('JFK', 'FRA', 'XX', 300));
    assert.equal(r.status, 'NEEDS_INFO');
    assert.equal(r.regime, 'EU261');
    assert.equal(r.amount, null);
});

test('13. W6 (Wizz Air, EU carrier) into the EU from outside (TLV→BUD) → EU261', () => {
    const r = evaluateCompensation(delay('TLV', 'BUD', 'W6', 200));
    assert.equal(r.regime, 'EU261');
    assert.equal(r.status, 'LIKELY_ELIGIBLE');
    assert.equal(r.amount, 400);
});

test('14. Swiss departure (LX ZRH→JFK) is EU261', () => {
    assert.equal(evaluateCompensation(delay('ZRH', 'JFK', 'LX', 250)).regime, 'EU261');
});

// ── UK261 ──────────────────────────────────────────────────────────────────

test('15. UK departure long-haul (BA LHR→JFK, 250 min) → UK261 £520', () => {
    const r = evaluateCompensation(delay('LHR', 'JFK', 'BA', 250));
    assert.equal(r.regime, 'UK261');
    assert.equal(r.currency, 'GBP');
    assert.equal(r.amount, 520);
});

test('16. UK departure short on U2 (LGW→AMS, 190 min) → UK261 £220', () => {
    const r = evaluateCompensation(delay('LGW', 'AMS', 'U2', 190));
    assert.equal(r.regime, 'UK261');
    assert.equal(r.amount, 220);
});

test('17. UK departure on a non-UK carrier (DL LHR→JFK, 200 min) → UK261 £260 (50%)', () => {
    const r = evaluateCompensation(delay('LHR', 'JFK', 'DL', 200));
    assert.equal(r.regime, 'UK261');
    assert.equal(r.amount, 260);
});

test('18. UK arrival on a non-UK/EU carrier (DL JFK→LHR) → out of scope', () => {
    const r = evaluateCompensation(delay('JFK', 'LHR', 'DL', 300));
    assert.equal(r.regime, 'NONE');
    assert.equal(r.status, 'NOT_ELIGIBLE');
});

test('19. UK arrival on an EU carrier (IB JFK→LHR) → UK261', () => {
    assert.equal(evaluateCompensation(delay('JFK', 'LHR', 'IB', 300)).regime, 'UK261');
});

test('20. EU departure to the UK on a UK carrier (BA CDG→LHR) → EU261 with a UK261 note', () => {
    const r = evaluateCompensation(delay('CDG', 'LHR', 'BA', 200));
    assert.equal(r.regime, 'EU261');
    assert.equal(r.amount, 250);
    assert.ok(r.reasons.some((x) => /UK261 may also apply/.test(x)));
});

// ── Connecting journey ─────────────────────────────────────────────────────

test('21. connecting journey uses the final destination (FRA→IST→SIN) for distance', () => {
    const toFinal = evaluateCompensation(delay('FRA', 'SIN', 'TK', 300));
    const firstLegOnly = evaluateCompensation(delay('FRA', 'IST', 'TK', 300));
    assert.equal(toFinal.amount, 600);
    assert.equal(firstLegOnly.amount, 400);
    assert.ok(toFinal.reasons.some((x) => /final destination SIN/.test(x)));
});

// ── Cancellations ──────────────────────────────────────────────────────────

test('22. cancellation notified 10 days before → likely eligible, full band (FRA→MAD ≈1420 km → €250)', () => {
    const r = evaluateCompensation(cancellation(10));
    assert.equal(r.status, 'LIKELY_ELIGIBLE');
    assert.equal(r.amount, 250);
});

test('23. cancellation notified 20 days before → not eligible', () => {
    const r = evaluateCompensation(cancellation(20));
    assert.equal(r.status, 'NOT_ELIGIBLE');
    assert.equal(r.amount, null);
});

test('24. cancellation without notice date (fixture XX1300) → NEEDS_INFO', () => {
    const r = fromFixture('XX1300');
    assert.equal(r.regime, 'EU261');
    assert.equal(r.status, 'NEEDS_INFO');
    assert.ok(r.reasons.some((x) => /14 days/.test(x)));
});

// ── U2 / W6 / fixtures ─────────────────────────────────────────────────────

test('25. U2 intra-EU on time (fixture U21234) → not eligible, EU261 scope', () => {
    const r = fromFixture('U21234');
    assert.equal(r.regime, 'EU261');
    assert.equal(r.status, 'NOT_ELIGIBLE');
});

test('26. U2 intra-EU (BER→FCO) 200 min → EU261 €250 regardless of UK carrier', () => {
    const r = evaluateCompensation(delay('BER', 'FCO', 'U2', 200));
    assert.equal(r.regime, 'EU261');
    assert.equal(r.amount, 250);
});

test('27. carrier classification', () => {
    assert.equal(classifyCarrier('U2'), 'UK');
    assert.equal(classifyCarrier('W6'), 'COMMUNITY');
    assert.equal(classifyCarrier('JU'), 'UNKNOWN', 'Air Serbia is not an EU carrier');
    assert.equal(classifyCarrier('TK'), 'OTHER');
    assert.equal(classifyCarrier(null), 'UNKNOWN');
});

// ── Out of scope / unknown data ────────────────────────────────────────────

test('28. Australian domestic (QF SYD→MEL) → no statutory compensation scheme', () => {
    const r = evaluateCompensation(delay('SYD', 'MEL', 'QF', 400));
    assert.equal(r.status, 'NOT_ELIGIBLE');
    assert.equal(r.regime, 'NONE');
    assert.equal(r.reasons[0], 'no statutory compensation scheme');
    assert.ok(!r.reasons.some((x) => /DGCA/.test(x)));
});

test('29. neither EU nor UK (AA JFK→LAX) → out of scope', () => {
    assert.equal(evaluateCompensation(delay('JFK', 'LAX', 'AA', 400)).status, 'NOT_ELIGIBLE');
});

test('30. unknown airport → NEEDS_INFO', () => {
    const r = evaluateCompensation(delay('ZZZ', 'FRA', 'LH', 300));
    assert.equal(r.status, 'NEEDS_INFO');
    assert.equal(r.distanceKm, null);
});

// ── Delay measurement ──────────────────────────────────────────────────────

test('31. gate arrival preferred; actual-arrival fallback is noted in reasons', () => {
    const gate = evaluateCompensation(delay('MUC', 'FCO', 'LH', 200));
    assert.ok(!gate.reasons.some((x) => /Gate arrival .* not available/.test(x)));

    const actualOnly = evaluateCompensation({
        disruption: 'DELAY', carrierIata: 'LH', originIata: 'MUC', finalDestinationIata: 'FCO',
        scheduledArrivalUtc: SCHED_ARR, actualArrivalUtc: arrivedAfter(200),
    });
    assert.equal(actualOnly.status, 'LIKELY_ELIGIBLE');
    assert.ok(actualOnly.reasons.some((x) => /Gate arrival \(doors-open\) time was not available/.test(x)));
});

test('32. no arrival data yet → NEEDS_INFO (estimates before landing never qualify)', () => {
    const f = fixtureFlight('XX1180');
    const inFlight = { ...f, status: 'active' as const };
    const r = evaluateCompensation(compensationInputFromFlight(inFlight, {
        originIata: 'CDG', finalDestinationIata: 'JFK', carrierIata: 'XX',
    }));
    assert.equal(r.status, 'NEEDS_INFO');
});

test('33. every positive result mentions extraordinary circumstances; negatives do not promise anything', () => {
    const positives = [
        evaluateCompensation(delay('MUC', 'FCO', 'LH', 200)),
        evaluateCompensation(cancellation(3)),
        fromFixture('XX1240'),
    ];
    for (const r of positives) {
        assert.equal(r.status, 'LIKELY_ELIGIBLE');
        assert.ok(r.reasons.some((x) => EXTRAORDINARY.test(x)), 'must warn about extraordinary circumstances');
    }
    for (const r of [evaluateCompensation(delay('MUC', 'FCO', 'LH', 100)), evaluateCompensation(delay('DXB', 'FRA', 'EK', 300))]) {
        assert.equal(r.amount, null);
    }
});

test('34. amount is never derived from delay length (same route, different delays ≥4h)', () => {
    const amounts = [245, 300, 600].map((m) => evaluateCompensation(delay('MUC', 'FCO', 'LH', m)).amount);
    assert.deepEqual(amounts, [250, 250, 250]);
});

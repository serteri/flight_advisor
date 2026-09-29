import { test } from 'node:test';
import assert from 'node:assert/strict';

import { LEGAL_DISCLAIMER_TEXT, withLegalFooter } from '@/lib/email/legalFooter';
import { buildClaimLetter, isRealPassengerName, compensationInputFromFlightNumber } from '@/lib/compensation/claimLetter';
import { evaluateCompensation, type CompensationResult } from '@/lib/compensation/engine';

test('withLegalFooter appends the notice to html (inside body) and text, once', () => {
    const once = withLegalFooter({ html: '<html><body><p>Hi</p></body></html>', text: 'Hi' });
    assert.match(once.html!, /Hi<\/p><p data-legal-disclaimer[^>]*>.*<\/p><\/body>/);
    assert.ok(once.text!.endsWith(LEGAL_DISCLAIMER_TEXT));
    const twice = withLegalFooter(once);
    assert.equal(twice.html, once.html);
    assert.equal(twice.text, once.text);
});

test('withLegalFooter leaves absent fields absent', () => {
    const r = withLegalFooter<{ html?: string; text?: string }>({ text: 'x' });
    assert.equal(r.html, undefined);
});

test('isRealPassengerName rejects the old placeholder', () => {
    assert.equal(isRealPassengerName('Passenger'), false);
    assert.equal(isRealPassengerName(' passenger '), false);
    assert.equal(isRealPassengerName(''), false);
    assert.equal(isRealPassengerName(null), false);
    assert.equal(isRealPassengerName('Ada Lovelace'), true);
});

const likely: CompensationResult = {
    regime: 'EU261', status: 'LIKELY_ELIGIBLE', amount: 400, currency: 'EUR', distanceKm: 2000, reasons: [],
};

test('claim letter uses real name and engine amount, hedged wording, no representation claim', () => {
    const letter = buildClaimLetter({
        passengerName: 'Ada Lovelace', flightNumber: 'U21234', origin: 'LGW', destination: 'ATH',
        scheduledDate: '01 June 2026', disruption: 'DELAY', arrivalDelayMinutes: 200,
        compensation: likely, today: new Date('2026-06-10T00:00:00Z'),
    });
    assert.ok(letter);
    assert.match(letter!, /Passenger: Ada Lovelace/);
    assert.match(letter!, /EUR 400/);
    assert.match(letter!, /may be entitled/);
    assert.match(letter!, /not legal advice/);
    assert.doesNotMatch(letter!, /Represented by|not caused by extraordinary|Passenger: Passenger/i);
});

test('claim letter is refused unless the engine says LIKELY_ELIGIBLE', () => {
    for (const status of ['NOT_ELIGIBLE', 'NEEDS_INFO'] as const) {
        const letter = buildClaimLetter({
            passengerName: 'Ada Lovelace', flightNumber: 'LH1', origin: 'FRA', destination: 'MUC',
            scheduledDate: 'x', disruption: 'DELAY', arrivalDelayMinutes: 90,
            compensation: { ...likely, status, amount: null, currency: null }, today: new Date(),
        });
        assert.equal(letter, null);
    }
});

test('client-side flight details go through the engine (carrier parsed from flight number)', () => {
    const input = compensationInputFromFlightNumber({
        flightNumber: 'w61234', origin: 'bud', destination: 'lhr', disruption: 'DELAY', arrivalDelayMinutes: 200,
    });
    assert.equal(input.carrierIata, 'W6');
    assert.equal(input.originIata, 'BUD');
    const result = evaluateCompensation(input);
    // BUD→LHR: EU departure, 1450 km band → EUR 250
    assert.equal(result.status, 'LIKELY_ELIGIBLE');
    assert.equal(result.regime, 'EU261');
});

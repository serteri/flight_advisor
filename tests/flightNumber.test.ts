import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FLIGHT_NUMBER_REGEX, isValidFlightNumber, normalizeFlightNumber, parseFlightNumber } from '@/lib/flights/flightNumber';

test('regex is the agreed single rule', () => {
    assert.equal(FLIGHT_NUMBER_REGEX.source, '^[A-Z0-9]{2}\\d{1,4}[A-Z]?$');
});

test('accepts letter-only IATA designators', () => {
    assert.deepEqual(parseFlightNumber('TK1999'), { airlineCode: 'TK', number: '1999', full: 'TK1999' });
    assert.deepEqual(parseFlightNumber('BA1'), { airlineCode: 'BA', number: '1', full: 'BA1' });
});

test('accepts mixed letter+digit designators (U2, W6, 3K, 9W)', () => {
    assert.deepEqual(parseFlightNumber('U21234'), { airlineCode: 'U2', number: '1234', full: 'U21234' });
    assert.deepEqual(parseFlightNumber('W61'), { airlineCode: 'W6', number: '1', full: 'W61' });
    assert.deepEqual(parseFlightNumber('3K521'), { airlineCode: '3K', number: '521', full: '3K521' });
    assert.deepEqual(parseFlightNumber('9W7'), { airlineCode: '9W', number: '7', full: '9W7' });
});

test('accepts an operational suffix letter', () => {
    assert.deepEqual(parseFlightNumber('BA2490A'), { airlineCode: 'BA', number: '2490A', full: 'BA2490A' });
});

test('normalizes case and whitespace', () => {
    assert.equal(normalizeFlightNumber(' u2 1234 '), 'U21234');
    assert.equal(parseFlightNumber('w6 12')?.full, 'W612');
});

test('rejects all-digit designators', () => {
    assert.equal(parseFlightNumber('1234'), null);
    assert.equal(parseFlightNumber('12345'), null);
    assert.equal(parseFlightNumber('00123'), null);
});

test('rejects malformed numbers', () => {
    for (const bad of ['', 'T', 'TK', 'TK12345', 'THY1999', 'TK-1999', 'TKABC', 'TK19A9', 'TK1999AB']) {
        assert.equal(isValidFlightNumber(bad), false, `expected "${bad}" to be rejected`);
    }
});

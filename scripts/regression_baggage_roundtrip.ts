import { itineraryInputToUnifiedFlight } from '../lib/manualFlightToUnifiedFlight';
import { parseItineraryText } from '../lib/itineraryTextParser';
import { applyAdvancedFlightScoring } from '../lib/scoring/advancedFlightScoring';

function assert(condition: unknown, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function minutesBetween(startIso: string, endIso: string): number {
    return Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);
}

async function run(): Promise<void> {
    const pasteItineraryText = [
        'Outbound Flight:',
        '| SQ266',
        'Brisbane Arpt(BNE) to Changi Intl Arpt(SIN)',
        'Depart: 2026-06-01T00:10:00+10:00',
        'Arrive: 2026-06-01T06:30:00+08:00',
        'Baggage: 30 K',
        '',
        'Outbound Flight:',
        '| SQ392',
        'Changi Intl Arpt(SIN) to Istanbul Airport(IST)',
        'Depart: 2026-06-01T10:00:00+08:00',
        'Arrive: 2026-06-01T16:30:00+03:00',
        '',
        'Inbound Flight:',
        '| SQ391',
        'Istanbul Airport(IST) to Changi Intl Arpt(SIN)',
        'Depart: 2026-06-05T13:20:00+03:00',
        'Arrive: 2026-06-06T04:40:00+08:00',
        '',
        'Inbound Flight:',
        '| SQ265',
        'Changi Intl Arpt(SIN) to Brisbane Arpt(BNE)',
        'Depart: 2026-06-06T06:10:00+08:00',
        'Arrive: 2026-06-06T15:45:00+10:00',
    ].join('\n');

    const parsed = parseItineraryText(pasteItineraryText);
    assert(parsed.trip.checkedBaggageKg === 30, `Expected parser checked baggage 30kg, got ${parsed.trip.checkedBaggageKg}`);

    const manualOverrideResult = itineraryInputToUnifiedFlight({
        mode: 'paste',
        source: 'manual_override',
        itineraryText: pasteItineraryText,
        checkedBaggageKg: 30,
        segments: [
            {
                from: 'BNE',
                to: 'SIN',
                departureDateTime: '2026-06-01T00:10:00+10:00',
                arrivalDateTime: '2026-06-01T06:30:00+08:00',
                airline: 'SINGAPORE AIRLINES',
                flightNumber: 'SQ266',
                tripDirection: 'OUTBOUND',
            },
            {
                from: 'SIN',
                to: 'IST',
                departureDateTime: '2026-06-01T10:00:00+08:00',
                arrivalDateTime: '2026-06-01T16:30:00+03:00',
                airline: 'SINGAPORE AIRLINES',
                flightNumber: 'SQ392',
                tripDirection: 'OUTBOUND',
            },
            {
                from: 'IST',
                to: 'SIN',
                departureDateTime: '2026-06-05T13:20:00+03:00',
                arrivalDateTime: '2026-06-06T04:40:00+08:00',
                airline: 'SINGAPORE AIRLINES',
                flightNumber: 'SQ391',
                tripDirection: 'INBOUND',
            },
            {
                from: 'SIN',
                to: 'BNE',
                departureDateTime: '2026-06-06T06:10:00+08:00',
                arrivalDateTime: '2026-06-06T15:45:00+10:00',
                airline: 'SINGAPORE AIRLINES',
                flightNumber: 'SQ265',
                tripDirection: 'INBOUND',
            },
        ],
        totalPrice: 1950,
        currency: 'AUD',
        cabin: 'economy',
    } as any);

    const expectedOutboundDuration = minutesBetween('2026-06-01T00:10:00+10:00', '2026-06-01T16:30:00+03:00');
    const expectedInboundDuration = minutesBetween('2026-06-05T13:20:00+03:00', '2026-06-06T15:45:00+10:00');
    const expectedOutboundLayover = minutesBetween('2026-06-01T06:30:00+08:00', '2026-06-01T10:00:00+08:00');
    const expectedInboundLayover = minutesBetween('2026-06-06T04:40:00+08:00', '2026-06-06T06:10:00+08:00');

    assert(manualOverrideResult.unifiedFlight.baggage?.checked?.kg === 30, 'Manual baggage override did not persist as exact 30kg');
    assert(manualOverrideResult.derived.tripType === 'ROUND_TRIP', 'Expected round trip structure');
    assert(manualOverrideResult.derived.outboundDurationMinutes === expectedOutboundDuration, `Outbound duration mismatch: expected ${expectedOutboundDuration}, got ${manualOverrideResult.derived.outboundDurationMinutes}`);
    assert(manualOverrideResult.derived.inboundDurationMinutes === expectedInboundDuration, `Inbound duration mismatch: expected ${expectedInboundDuration}, got ${manualOverrideResult.derived.inboundDurationMinutes}`);
    assert(manualOverrideResult.derived.outboundLayoverMinutes === expectedOutboundLayover, `Outbound layover mismatch: expected ${expectedOutboundLayover}, got ${manualOverrideResult.derived.outboundLayoverMinutes}`);
    assert(manualOverrideResult.derived.inboundLayoverMinutes === expectedInboundLayover, `Inbound layover mismatch: expected ${expectedInboundLayover}, got ${manualOverrideResult.derived.inboundLayoverMinutes}`);

    const [scored] = await applyAdvancedFlightScoring([manualOverrideResult.unifiedFlight], {
        origin: manualOverrideResult.unifiedFlight.from,
        destination: 'IST',
        departureDate: manualOverrideResult.unifiedFlight.departureTime,
    });

    const comfortNotes = scored?.score?.comfortNotes || [];
    assert(comfortNotes.includes('30kg checked baggage included'), `Expected exact baggage comfort note, got: ${comfortNotes.join(' | ')}`);

    console.log('PASS regression_baggage_roundtrip');
    console.log(JSON.stringify({
        parsedCheckedBaggageKg: parsed.trip.checkedBaggageKg,
        derived: manualOverrideResult.derived,
        comfortNotes,
    }, null, 2));
}

run().catch((error) => {
    console.error('FAIL regression_baggage_roundtrip');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});

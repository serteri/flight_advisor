import { itineraryInputToUnifiedFlight } from '@/lib/manualFlightToUnifiedFlight';

const flattenedSample = `Depart: Brisbane Arpt Australia Thu 11 Jun 2026 06:10pm Terminal: I Arrive: Changi Intl Arpt Singapore Fri 12 Jun 2026 12:10am Terminal: 0 Status: Confirmed Cabin Class: Economy Aircraft: 359 Baggage: 30 K - NAME Stopover of 2 Hours 5 Mins in Changi Intl Arpt, Singapore, Singapore Outbound Flight: Fri 12 Jun 2026 Airline Reference: DSHE4G Changi Intl Arpt(SIN) Istanbul Airport(IST) | SQ392 Depart: Changi Intl Arpt Singapore Fri 12 Jun 2026 02:15am Terminal: 3 Arrive: Istanbul Airport Turkey Fri 12 Jun 2026 08:30am Status: Confirmed Cabin Class: Economy Aircraft: 359 Inbound Flight: Wed 15 Jul 2026 Airline Reference: DSHE4G Istanbul Airport(IST) Changi Intl Arpt(SIN) | SQ391 Depart: Istanbul Airport Turkey Wed 15 Jul 2026 01:10pm Arrive: Changi Intl Arpt Singapore Thu 16 Jul 2026 04:55am Status: Confirmed Cabin Class: Economy Aircraft: 359 Inbound Flight: Thu 16 Jul 2026 Airline Reference: DSHE4G Changi Intl Arpt(SIN) Brisbane Arpt(BNE) | SQ265 Depart: Changi Intl Arpt Singapore Thu 16 Jul 2026 07:20am Terminal: 3 Arrive: Brisbane Arpt Australia Thu 16 Jul 2026 04:55pm Terminal: I Status: Confirmed Cabin Class: Economy Aircraft: 359`;

const result = itineraryInputToUnifiedFlight({
  mode: 'paste',
  itineraryText: flattenedSample,
});

console.log(JSON.stringify({
  extractedSegments: result.extractedSegments,
  parseWarnings: result.assessment.parseWarnings || [],
  parseConfidence: result.assessment.parseConfidence,
}, null, 2));

if (result.extractedSegments.length < 4) {
  throw new Error(`Expected at least 4 extracted segments, received ${result.extractedSegments.length}`);
}

const expectedCore = [
  ['BNE', 'SIN', '2026-06-11T18:10:00.000Z', '2026-06-12T00:10:00.000Z'],
  ['SIN', 'IST', '2026-06-12T02:15:00.000Z', '2026-06-12T08:30:00.000Z', 'SQ392'],
  ['IST', 'SIN', '2026-07-15T13:10:00.000Z', '2026-07-16T04:55:00.000Z', 'SQ391'],
  ['SIN', 'BNE', '2026-07-16T07:20:00.000Z', '2026-07-16T16:55:00.000Z', 'SQ265'],
] as const;

for (const expected of expectedCore) {
  const [from, to, departure, arrival, flightNumber] = expected;
  const match = result.extractedSegments.find((segment) => (
    segment.from === from
    && segment.to === to
    && segment.departureDateTime === departure
    && segment.arrivalDateTime === arrival
    && (!flightNumber || segment.flightNumber === flightNumber)
  ));

  if (!match) {
    throw new Error(`Missing expected segment ${from}->${to} (${departure} -> ${arrival})`);
  }
}

const warnings = result.assessment.parseWarnings || [];
if (warnings.some((warning) => /fallback times applied|current date|today/i.test(warning))) {
  throw new Error(`Unexpected fallback-date warning for flattened sample: ${warnings.join(' | ')}`);
}
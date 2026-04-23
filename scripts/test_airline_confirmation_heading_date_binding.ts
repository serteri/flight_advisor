import { itineraryInputToUnifiedFlight } from '@/lib/manualFlightToUnifiedFlight';

const sample = `Singapore Airlines
Outbound Flight: Thu 11 Jun 2026
Brisbane Arpt(BNE)
Depart:
06:10pm
Arrive:
12:10am
Status:
Confirmed
Cabin Class:
Economy
Aircraft:
Airbus A350-900
| SQ266
Changi Intl Arpt(SIN)

Inbound Flight: Wed 15 Jul 2026
Changi Intl Arpt(SIN)
Depart:
07:20am
Arrive:
04:55pm
Status:
Confirmed
Cabin Class:
Economy
Aircraft:
Boeing 787-10
| SQ265
Brisbane Arpt(BNE)
`;

const result = itineraryInputToUnifiedFlight({
  mode: 'paste',
  itineraryText: sample,
});

const expectedSegments = [
  ['BNE', 'SIN', 'SQ266', '2026-06-11T18:10:00.000Z', '2026-06-12T00:10:00.000Z'],
  ['SIN', 'BNE', 'SQ265', '2026-07-15T07:20:00.000Z', '2026-07-15T16:55:00.000Z'],
] as const;

console.log(JSON.stringify({
  extractedSegments: result.extractedSegments,
  parseWarnings: result.assessment.parseWarnings || [],
}, null, 2));

if (result.extractedSegments.length !== 2) {
  throw new Error(`Expected 2 extracted segments, received ${result.extractedSegments.length}`);
}

for (const [index, expected] of expectedSegments.entries()) {
  const actual = result.extractedSegments[index];
  if (!actual) {
    throw new Error(`Missing segment at index ${index}`);
  }

  const [from, to, flightNumber, departureDateTime, arrivalDateTime] = expected;
  if (
    actual.from !== from
    || actual.to !== to
    || actual.flightNumber !== flightNumber
    || actual.departureDateTime !== departureDateTime
    || actual.arrivalDateTime !== arrivalDateTime
  ) {
    throw new Error(`Segment ${index + 1} mismatch: ${JSON.stringify(actual)}`);
  }
}

const warnings = result.assessment.parseWarnings || [];
if (warnings.some((warning) => /fallback times applied|current date|today/i.test(warning))) {
  throw new Error(`Unexpected fallback-date warning for heading date binding sample: ${warnings.join(' | ')}`);
}
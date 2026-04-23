import { itineraryInputToUnifiedFlight } from '@/lib/manualFlightToUnifiedFlight';

const sample = `Singapore Airlines
Outbound Flight: Thu 11 Jun 2026
Brisbane Arpt(BNE)
Depart:
Thu 11 Jun 2026 06:10pm
Arrive:
Fri 12 Jun 2026 12:10am
Status:
Confirmed
Cabin Class:
Economy
Aircraft:
Airbus A350-900
Baggage: 30 K - NAME ONE
| SQ266
Changi Intl Arpt(SIN)
Stopover of 2 Hours 5 Mins in Changi Intl Arpt, Singapore, Singapore
Changi Intl Arpt(SIN)
Depart:
Fri 12 Jun 2026 02:15am
Arrive:
Fri 12 Jun 2026 08:30am
Status:
Confirmed
Cabin Class:
Economy
Aircraft:
Airbus A350-900
Baggage: 30 K - NAME ONE
| SQ392
Istanbul Airport(IST)

Inbound Flight: Wed 15 Jul 2026
Istanbul Airport(IST)
Depart:
Wed 15 Jul 2026 01:10pm
Arrive:
Thu 16 Jul 2026 04:55am
Status:
Confirmed
Cabin Class:
Economy
Aircraft:
Airbus A350-900
Baggage: 30 K - NAME ONE
| SQ391
Changi Intl Arpt(SIN)
Stopover of 1 Hours 50 Mins in Changi Intl Arpt, Singapore, Singapore
Inbound Flight: Thu 16 Jul 2026
Changi Intl Arpt(SIN)
Depart:
Thu 16 Jul 2026 07:20am
Arrive:
Thu 16 Jul 2026 04:55pm
Status:
Confirmed
Cabin Class:
Economy
Aircraft:
Boeing 787-10
Baggage: 30 K - NAME ONE
| SQ265
Brisbane Arpt(BNE)
`;

const result = itineraryInputToUnifiedFlight({
  mode: 'paste',
  itineraryText: sample,
});

const weekdayTokens = new Set(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);

const expectedSegments = [
  ['BNE', 'SIN', 'SQ266', '2026-06-11T18:10:00.000Z', '2026-06-12T00:10:00.000Z'],
  ['SIN', 'IST', 'SQ392', '2026-06-12T02:15:00.000Z', '2026-06-12T08:30:00.000Z'],
  ['IST', 'SIN', 'SQ391', '2026-07-15T13:10:00.000Z', '2026-07-16T04:55:00.000Z'],
  ['SIN', 'BNE', 'SQ265', '2026-07-16T07:20:00.000Z', '2026-07-16T16:55:00.000Z'],
] as const;

console.log(JSON.stringify({
  extractedSegments: result.extractedSegments,
  parseWarnings: result.assessment.parseWarnings || [],
  parseConfidence: result.assessment.parseConfidence,
}, null, 2));

if (result.extractedSegments.length !== 4) {
  throw new Error(`Expected 4 extracted segments, received ${result.extractedSegments.length}`);
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

  const airlineToken = (actual.airline || '').toUpperCase();
  const flightToken = (actual.flightNumber || '').slice(0, 3).toUpperCase();
  if (weekdayTokens.has(airlineToken) || weekdayTokens.has(flightToken)) {
    throw new Error(`Weekday token leaked into airline/flight fields for segment ${index + 1}: ${JSON.stringify(actual)}`);
  }
}

const warnings = result.assessment.parseWarnings || [];
if (warnings.some((warning) => /fallback times applied|missing segment times/i.test(warning))) {
  throw new Error(`Unexpected fallback-time warning for exact regression sample: ${warnings.join(' | ')}`);
}

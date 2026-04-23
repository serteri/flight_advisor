import { itineraryInputToUnifiedFlight } from '@/lib/manualFlightToUnifiedFlight';

const sample = `Depart:
Brisbane Arpt
Australia
Thu 11 Jun 2026
06:10pm
Terminal: I
Arrive:
Changi Intl Arpt
Singapore
Fri 12 Jun 2026
12:10am
Terminal: 0
Status: Confirmed 
Cabin Class: Economy
Aircraft: 359
Baggage: 30 K - CIMEN
DUYARIYIGUNLU
Baggage: 30 K - ALTAY IYIGUNLU
Stopover of 2 Hours 5 Mins in Changi Intl Arpt, Singapore, Singapore
Outbound Flight: Fri 12 Jun 2026 Airline Reference: DSHE4G
Changi Intl Arpt(SIN) Istanbul Airport(IST)
 | SQ392
Depart:
Changi Intl Arpt
Singapore
Fri 12 Jun 2026
02:15am
Terminal: 3
Arrive:
Istanbul Airport
Turkey
Fri 12 Jun 2026
08:30am
Terminal:
Status: Confirmed 
Cabin Class: Economy
Aircraft: 359
Baggage: 30 K - CIMEN
DUYARIYIGUNLU
Baggage: 30 K - ALTAY IYIGUNLU
Inbound Flight: Wed 15 Jul 2026 Airline Reference: DSHE4G
Istanbul Airport(IST) Changi Intl Arpt(SIN)
 | SQ391
Depart:
Istanbul Airport
Turkey
Wed 15 Jul 2026
01:10pm
Arrive:
Changi Intl Arpt
Singapore
Thu 16 Jul 2026
04:55am
Status: Confirmed 
Cabin Class: Economy
Baggage: 30 K - CIMEN
DUYARIYIGUNLU
Baggage: 30 K - ALTAY IYIGUNLU
Aircraft: 359
Terminal: Terminal: 0
Stopover of 2 Hours 25 Mins in Changi Intl Arpt, Singapore, Singapore
Inbound Flight: Thu 16 Jul 2026 Airline Reference: DSHE4G
Changi Intl Arpt(SIN) Brisbane Arpt(BNE)
 | SQ265
Depart:
Changi Intl Arpt
Singapore
Thu 16 Jul 2026
07:20am
Terminal: 3
Arrive:
Brisbane Arpt
Australia
Thu 16 Jul 2026
04:55pm
Terminal: I
Status: Confirmed 
Cabin Class: Economy
Baggage: 30 K - CIMEN
DUYARIYIGUNLU
Baggage: 30 K - ALTAY IYIGUNLU
Aircraft: 359`;

const result = itineraryInputToUnifiedFlight({
  mode: 'paste',
  itineraryText: sample,
});

const expectedSegments = [
  ['SIN', 'IST', 'SQ392', '2026-06-12T02:15:00.000Z', '2026-06-12T08:30:00.000Z'],
  ['IST', 'SIN', 'SQ391', '2026-07-15T13:10:00.000Z', '2026-07-16T04:55:00.000Z'],
  ['SIN', 'BNE', 'SQ265', '2026-07-16T07:20:00.000Z', '2026-07-16T16:55:00.000Z'],
] as const;

console.log(JSON.stringify({
  extractedSegments: result.extractedSegments,
  parseWarnings: result.assessment.parseWarnings || [],
  parseConfidence: result.assessment.parseConfidence,
}, null, 2));

if (result.extractedSegments.length !== 3) {
  throw new Error(`Expected 3 extracted segments, received ${result.extractedSegments.length}`);
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
if (warnings.some((warning) => /missing segment times|fallback times applied|current date|today/i.test(warning))) {
  throw new Error(`Unexpected fallback-time warning for user regression sample: ${warnings.join(' | ')}`);
}
import { itineraryInputToUnifiedFlight } from '@/lib/manualFlightToUnifiedFlight';

const sample = `Depart: Brisbane Arpt Australia Thu 11 Jun 2026 06:10pm Terminal: I Arrive: Changi Intl Arpt Singapore Fri 12 Jun 2026 12:10am Terminal: 0 Status: Confirmed Cabin Class: Economy Aircraft: 359 Stopover of 2 Hours 5 Mins in Changi Intl Arpt, Singapore, Singapore Outbound Flight: Fri 12 Jun 2026 Airline Reference: DSHE4G Changi Intl Arpt(SIN) Istanbul Airport(IST) | SQ392 Depart: Changi Intl Arpt Singapore Fri 12 Jun 2026 02:15am Terminal: 3 Arrive: Istanbul Airport Turkey Fri 12 Jun 2026 08:30am Status: Confirmed Cabin Class: Economy Aircraft: 359 Inbound Flight: Wed 15 Jul 2026 Airline Reference: DSHE4G Istanbul Airport(IST) Changi Intl Arpt(SIN) | SQ391 Depart: Istanbul Airport Turkey Wed 15 Jul 2026 01:10pm Arrive: Changi Intl Arpt Singapore Thu 16 Jul 2026 04:55am Status: Confirmed Cabin Class: Economy Aircraft: 359 Inbound Flight: Thu 16 Jul 2026 Airline Reference: DSHE4G Changi Intl Arpt(SIN) Brisbane Arpt(BNE) | SQ265 Depart: Changi Intl Arpt Singapore Thu 16 Jul 2026 07:20am Terminal: 3 Arrive: Brisbane Arpt Australia Thu 16 Jul 2026 04:55pm Terminal: I Status: Confirmed Cabin Class: Economy Aircraft: 359`;

const result = itineraryInputToUnifiedFlight({
  mode: 'paste',
  itineraryText: sample,
  price: 3400,
  currency: 'AUD',
  segments: [
    {
      from: 'BNE',
      to: 'SIN',
      departureDateTime: '2026-06-11T18:10:00.000Z',
      arrivalDateTime: '2026-06-12T00:10:00.000Z',
      airline: 'UNKN',
      flightNumber: 'UNKNOWN1',
      aircraft: '359',
      tripDirection: 'OUTBOUND',
    },
    {
      from: 'SIN',
      to: 'IST',
      departureDateTime: '2026-06-12T02:15:00.000Z',
      arrivalDateTime: '2026-06-12T08:30:00.000Z',
      airline: 'SQ',
      flightNumber: 'SQ392',
      aircraft: '359',
      bookingClass: 'K',
      tripDirection: 'OUTBOUND',
    },
    {
      from: 'IST',
      to: 'SIN',
      departureDateTime: '2026-07-15T13:10:00.000Z',
      arrivalDateTime: '2026-07-16T04:55:00.000Z',
      airline: 'SQ',
      flightNumber: 'SQ391',
      aircraft: '359',
      tripDirection: 'INBOUND',
    },
    {
      from: 'SIN',
      to: 'BNE',
      departureDateTime: '2026-07-16T07:20:00.000Z',
      arrivalDateTime: '2026-07-16T16:55:00.000Z',
      airline: 'SQ',
      flightNumber: 'SQ265',
      aircraft: '359',
      tripDirection: 'INBOUND',
    },
  ],
});

console.log(JSON.stringify({
  derived: result.derived,
  parseWarnings: result.assessment.parseWarnings,
  extractedSegments: result.extractedSegments,
}, null, 2));

if (result.derived.tripType !== 'ROUND_TRIP') {
  throw new Error(`Expected ROUND_TRIP, received ${result.derived.tripType}`);
}

if (result.derived.connectionCount !== 2) {
  throw new Error(`Expected total direction-aware connectionCount=2, received ${result.derived.connectionCount}`);
}

if (result.derived.outboundConnectionCount !== 1 || result.derived.inboundConnectionCount !== 1) {
  throw new Error(`Expected outbound=1 and inbound=1, received ${result.derived.outboundConnectionCount}/${result.derived.inboundConnectionCount}`);
}

const firstSegment = result.extractedSegments[0];
if (!firstSegment) {
  throw new Error('Expected first extracted segment.');
}

if (firstSegment.airline === 'UNKN' || /^UNKNOWN\d+$/i.test(firstSegment.flightNumber)) {
  throw new Error(`Expected user-facing extracted segment to hide placeholders, received ${JSON.stringify(firstSegment)}`);
}

if (firstSegment.flightNumber !== '') {
  throw new Error(`Expected missing flight number to remain clean blank in extracted surface, received ${JSON.stringify(firstSegment)}`);
}

if (firstSegment.airline !== 'SQ') {
  throw new Error(`Expected airline inference from neighboring SQ leg, received ${JSON.stringify(firstSegment)}`);
}

const secondSegment = result.extractedSegments[1];
if (!secondSegment || secondSegment.marketedAirline !== 'SQ') {
  throw new Error(`Expected marketedAirline to default from SQ, received ${JSON.stringify(secondSegment)}`);
}

if (secondSegment.bookingClass !== 'K') {
  throw new Error(`Expected bookingClass K to be preserved, received ${JSON.stringify(secondSegment)}`);
}

const warnings = result.assessment.parseWarnings || [];
if (warnings.includes('Price not detected from pasted text.')) {
  throw new Error(`Expected manual-price warning wording, found generic warning: ${warnings.join(' | ')}`);
}

if (!warnings.some((warning) => /manual price override used/i.test(warning))) {
  throw new Error(`Expected warning mentioning manual price override, received: ${warnings.join(' | ')}`);
}
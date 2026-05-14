import { parseItineraryText } from '../lib/itineraryTextParser';
import { itineraryInputToUnifiedFlight } from '../lib/manualFlightToUnifiedFlight';
import { FORBIDDEN_FAKE_FLIGHT_TOKENS } from '../lib/parser/flightNumberValidation';

type Fixture = {
    name: string;
    input: string;
    expectedMinSegments: number;
    expectedTripType?: 'ONE_WAY' | 'ROUND_TRIP' | 'MULTI_CITY';
    expectedFlights?: Array<string | null>;
    expectedRoutes?: string[];
    expectedDirections?: Array<'OUTBOUND' | 'INBOUND' | undefined>;
    allowFallback?: boolean;
};

const istBneSample = `Istanbul (IST) -> Brisbane (BNE)
Round trip | 1 adult, 1 child | Economy | AUD 3500 total | 30 kg checked baggage

OUTBOUND
Turkish Airlines TK54
IST -> SIN | Tue 10 Jun 2026 | Departs 02:00 -> Arrives 17:45
Aircraft: Boeing 777-300ER

Layover SIN: 2h 25m

Singapore Airlines SQ245
SIN -> BNE | Tue 10 Jun 2026 | Departs 20:10 -> Arrives Wed 11 Jun 05:55
Aircraft: Airbus A350-900

INBOUND
Singapore Airlines SQ246
BNE -> SIN | Wed 15 Jul 2026 | Departs 23:50 -> Arrives Thu 16 Jul 05:45
Aircraft: Airbus A350-900

Layover SIN: 2h 30m

Turkish Airlines TK55
SIN -> IST | Thu 16 Jul 2026 | Departs 08:15 -> Arrives 14:10
Aircraft: Boeing 777-300ER`;

const fixtures: Fixture[] = [
    {
        name: 'Google Flights round-trip IST-BNE',
        input: istBneSample,
        expectedMinSegments: 4,
        expectedTripType: 'ROUND_TRIP',
        expectedFlights: ['TK54', 'SQ245', 'SQ246', 'TK55'],
        expectedRoutes: ['IST|SIN', 'SIN|BNE', 'BNE|SIN', 'SIN|IST'],
        expectedDirections: ['OUTBOUND', 'OUTBOUND', 'INBOUND', 'INBOUND'],
    },
    {
        name: 'Singapore airline confirmation BNE-IST-BNE',
        input: `Singapore Airlines booking confirmation
Round trip | AUD 2780 | Economy
Outbound Flight:
| SQ256
Depart: Brisbane Airport (BNE) Tue 10 Mar 2026 09:20
Arrive: Changi Intl Airport (SIN) Tue 10 Mar 2026 15:30
Aircraft: Airbus A350
| TK55
Depart: Changi Intl Airport (SIN) Tue 10 Mar 2026 23:25
Arrive: Istanbul Airport (IST) Wed 11 Mar 2026 06:15
Inbound Flight:
| TK54
Depart: Istanbul Airport (IST) Wed 01 Apr 2026 02:00
Arrive: Changi Intl Airport (SIN) Wed 01 Apr 2026 17:45
| SQ245
Depart: Changi Intl Airport (SIN) Wed 01 Apr 2026 20:10
Arrive: Brisbane Airport (BNE) Thu 02 Apr 2026 05:55`,
        expectedMinSegments: 4,
        expectedTripType: 'ROUND_TRIP',
        expectedFlights: ['SQ256', 'TK55', 'TK54', 'SQ245'],
        expectedRoutes: ['BNE|SIN', 'SIN|IST', 'IST|SIN', 'SIN|BNE'],
        expectedDirections: ['OUTBOUND', 'OUTBOUND', 'INBOUND', 'INBOUND'],
    },
    {
        name: 'Flattened single-line airline confirmation',
        input: `Round trip AUD 2780 Outbound Flight: | SQ256 Depart: Brisbane Airport (BNE) Tue 10 Mar 2026 09:20 Arrive: Changi Intl Airport (SIN) Tue 10 Mar 2026 15:30 Aircraft: Airbus A350 | TK55 Depart: Changi Intl Airport (SIN) Tue 10 Mar 2026 23:25 Arrive: Istanbul Airport (IST) Wed 11 Mar 2026 06:15 Inbound Flight: | TK54 Depart: Istanbul Airport (IST) Wed 01 Apr 2026 02:00 Arrive: Changi Intl Airport (SIN) Wed 01 Apr 2026 17:45 | SQ245 Depart: Changi Intl Airport (SIN) Wed 01 Apr 2026 20:10 Arrive: Brisbane Airport (BNE) Thu 02 Apr 2026 05:55`,
        expectedMinSegments: 4,
        expectedTripType: 'ROUND_TRIP',
        expectedFlights: ['SQ256', 'TK55', 'TK54', 'SQ245'],
        expectedRoutes: ['BNE|SIN', 'SIN|IST', 'IST|SIN', 'SIN|BNE'],
    },
    {
        name: 'OTA-style itinerary',
        input: `Booking Confirmed
Total: EUR 840
From IST to CDG
Flight: TK1823
Departure: 14 Sep 2026 09:25
Arrival: 14 Sep 2026 12:10
Flight: AF7431
CDG -> LHR
Departure: 14 Sep 2026 14:05
Arrival: 14 Sep 2026 14:35`,
        expectedMinSegments: 2,
        expectedTripType: 'ONE_WAY',
        expectedFlights: ['TK1823', 'AF7431'],
        expectedRoutes: ['IST|CDG', 'CDG|LHR'],
    },
    {
        name: 'Mixed carrier route',
        input: `One-way | USD 910
Lufthansa LH400
JFK -> FRA | 2026-08-03 18:30 -> 2026-08-04 07:10
Swiss LX160
FRA -> ZRH | 2026-08-04 09:10 -> 2026-08-04 10:05
British Airways BA178
ZRH -> LHR | 2026-08-04 12:30 -> 2026-08-04 13:20`,
        expectedMinSegments: 3,
        expectedTripType: 'ONE_WAY',
        expectedFlights: ['LH400', 'LX160', 'BA178'],
        expectedRoutes: ['JFK|FRA', 'FRA|ZRH', 'ZRH|LHR'],
    },
    {
        name: 'Missing flight number first segment',
        input: `One-way | USD 700
IST -> SIN
Departure: 22 May 2026 02:00
Arrival: 22 May 2026 17:45
Singapore Airlines SQ245
SIN -> BNE | 2026-05-22 20:10 -> 2026-05-23 05:55`,
        expectedMinSegments: 2,
        expectedTripType: 'ONE_WAY',
        expectedFlights: [null, 'SQ245'],
        expectedRoutes: ['IST|SIN', 'SIN|BNE'],
    },
    {
        name: 'Missing price',
        input: istBneSample.replace('AUD 3500 total | ', ''),
        expectedMinSegments: 4,
        expectedTripType: 'ROUND_TRIP',
        expectedFlights: ['TK54', 'SQ245', 'SQ246', 'TK55'],
    },
    {
        name: 'Malformed partial input',
        input: `AUD 3200
Tue 10 Jun
Random text
IST -> SIN`,
        expectedMinSegments: 1,
        expectedTripType: 'ONE_WAY',
        expectedFlights: [null],
        allowFallback: true,
    },
];

const fail = (message: string) => {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
};

const containsFakeFlightArtifact = (segments: Array<{ flightNumber?: string }>): boolean => {
    const forbidden = new Set(FORBIDDEN_FAKE_FLIGHT_TOKENS);
    return segments.some((segment) => {
        const fn = (segment.flightNumber || '').toUpperCase();
        if (!fn) return false;
        return forbidden.has(fn)
            || /^(AUD|USD|EUR|GBP|CAD|TRY|TUE|WED|THU|FRI|SAT|SUN)\d{1,4}$/.test(fn)
            || /^UNKNOWN\d+$/.test(fn)
            || fn === 'UNKN';
    });
};

const printComparison = (
    fixture: Fixture,
    segments: Array<{ from: string; to: string; flightNumber?: string; tripDirection?: string; departure?: string; arrival?: string }>,
    tripType?: string,
) => {
    console.log(`\n=== ${fixture.name} ===`);
    console.log('Before (historical failure signature):');
    console.log('- Hallucinated flight numbers, collapsed routes, wrong trip grouping, stale manual data');
    console.log('After (current parser):');
    console.log(`- tripType: ${tripType || 'UNKNOWN'}`);
    segments.forEach((segment, index) => {
        console.log(`  [${index + 1}] ${segment.from} -> ${segment.to} | ${segment.flightNumber || 'NO_FLIGHT'} | ${segment.tripDirection || 'NO_DIR'} | ${segment.departure || 'NO_DEP'} -> ${segment.arrival || 'NO_ARR'}`);
    });
};

const assertFixture = (fixture: Fixture) => {
    const parsed = parseItineraryText(fixture.input);
    const normalizedTripType = parsed.meta.tripType || 'ONE_WAY';

    printComparison(fixture, parsed.segments, normalizedTripType);

    if (parsed.segments.length < fixture.expectedMinSegments) {
        fail(`${fixture.name}: expected at least ${fixture.expectedMinSegments} segments, got ${parsed.segments.length}`);
    }

    if (fixture.expectedTripType && normalizedTripType !== fixture.expectedTripType) {
        fail(`${fixture.name}: expected tripType ${fixture.expectedTripType}, got ${normalizedTripType}`);
    }

    if (containsFakeFlightArtifact(parsed.segments)) {
        fail(`${fixture.name}: detected fake flight number artifact`);
    }

    if (fixture.expectedFlights) {
        const gotFlights = parsed.segments.map((segment) => segment.flightNumber || null);
        for (let i = 0; i < fixture.expectedFlights.length; i += 1) {
            if (gotFlights[i] !== fixture.expectedFlights[i]) {
                fail(`${fixture.name}: segment ${i + 1} expected flight ${fixture.expectedFlights[i] || 'EMPTY'}, got ${gotFlights[i] || 'EMPTY'}`);
            }
        }
    }

    if (fixture.expectedRoutes) {
        const gotRoutes = parsed.segments.map((segment) => `${segment.from}|${segment.to}`);
        for (let i = 0; i < fixture.expectedRoutes.length; i += 1) {
            if (gotRoutes[i] !== fixture.expectedRoutes[i]) {
                fail(`${fixture.name}: segment ${i + 1} expected route ${fixture.expectedRoutes[i]}, got ${gotRoutes[i] || 'EMPTY'}`);
            }
        }
    }

    if (fixture.expectedDirections) {
        const gotDirections = parsed.segments.map((segment) => segment.tripDirection);
        for (let i = 0; i < fixture.expectedDirections.length; i += 1) {
            if (gotDirections[i] !== fixture.expectedDirections[i]) {
                fail(`${fixture.name}: segment ${i + 1} expected direction ${fixture.expectedDirections[i] || 'EMPTY'}, got ${gotDirections[i] || 'EMPTY'}`);
            }
        }
    }

    const result = itineraryInputToUnifiedFlight({
        mode: 'paste',
        itineraryText: fixture.input,
        adults: 1,
        children: 0,
        infants: 0,
    });

    if (fixture.expectedTripType && fixture.expectedTripType !== 'MULTI_CITY' && result.derived.tripType !== fixture.expectedTripType) {
        fail(`${fixture.name}: converter derived tripType ${result.derived.tripType}, expected ${fixture.expectedTripType}`);
    }

    const warnings = result.assessment.parseWarnings || [];
    if (!fixture.allowFallback && warnings.some((warning) => /FALLBACK_DATE|fallback timeline|deterministic fallback/i.test(warning))) {
        fail(`${fixture.name}: fallback timestamp usage detected despite explicit date context`);
    }

    if (fixture.name === 'Missing price' && result.assessment.priceSource !== 'UNAVAILABLE') {
        fail('Missing price: priceSource should be UNAVAILABLE');
    }
};

const assertEditedSegmentRescoreIntegrity = () => {
    const parsed = itineraryInputToUnifiedFlight({
        mode: 'paste',
        itineraryText: istBneSample,
        price: 3500,
        currency: 'AUD',
        adults: 1,
        children: 0,
        infants: 0,
    });

    const editedSegments = parsed.extractedSegments.map((segment, index) => ({
        ...segment,
        airline: index === 0 ? 'Qantas' : segment.airline,
        flightNumber: index === 0 ? 'QF4410' : segment.flightNumber,
        departureDateTime: index === 0 ? '2026-06-10T04:30:00.000Z' : segment.departureDateTime,
        arrivalDateTime: index === 0 ? '2026-06-10T19:30:00.000Z' : segment.arrivalDateTime,
    }));

    const rescored = itineraryInputToUnifiedFlight({
        mode: 'paste',
        source: 'manual_override',
        itineraryText: istBneSample,
        price: 4100,
        currency: 'AUD',
        adults: 1,
        children: 0,
        infants: 0,
        segments: editedSegments,
    });

    const first = rescored.extractedSegments[0];
    if (first.flightNumber !== 'QF4410') {
        fail(`Edited rescore: expected first flight QF4410, got ${first.flightNumber || 'EMPTY'}`);
    }
    if (first.departureDateTime !== '2026-06-10T04:30:00.000Z') {
        fail(`Edited rescore: edited departure not used, got ${first.departureDateTime}`);
    }
    if (rescored.unifiedFlight.price !== 4100) {
        fail(`Edited rescore: edited price not used, got ${rescored.unifiedFlight.price}`);
    }
    if (!rescored.assessment.parseWarnings?.some((warning) => /manually edited segments/i.test(warning))) {
        fail('Edited rescore: manual override provenance warning missing');
    }
};

for (const fixture of fixtures) {
    assertFixture(fixture);
}

assertEditedSegmentRescoreIntegrity();

if (process.exitCode && process.exitCode !== 0) {
    console.error('\nParser reliability regression: FAILED');
    process.exit(process.exitCode);
}

console.log('\nParser reliability regression: PASS');

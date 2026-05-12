import { parseItineraryText } from '../lib/itineraryTextParser';
import { itineraryInputToUnifiedFlight } from '../lib/manualFlightToUnifiedFlight';

type Fixture = {
    name: string;
    input: string;
    expectedMinSegments: number;
    expectedTripType?: 'ONE_WAY' | 'ROUND_TRIP' | 'MULTI_CITY';
    expectedFlights?: string[];
    expectedRoutes?: string[];
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
        name: 'Google Flights Round Trip (IST-BNE)',
        input: istBneSample,
        expectedMinSegments: 4,
        expectedTripType: 'ROUND_TRIP',
        expectedFlights: ['TK54', 'SQ245', 'SQ246', 'TK55'],
        expectedRoutes: ['IST|SIN', 'SIN|BNE', 'BNE|SIN', 'SIN|IST'],
    },
    {
        name: 'Mixed Carrier Round Trip',
        input: `Round trip\nLufthansa LH400\nJFK -> FRA | 2026-08-03 18:30 -> 2026-08-04 07:10\nSwiss LX160\nFRA -> ZRH | 2026-08-04 09:10 -> 2026-08-04 10:05\nINBOUND\nSwiss LX17\nZRH -> EWR | 2026-08-21 13:20 -> 2026-08-21 16:20`,
        expectedMinSegments: 3,
        expectedTripType: 'ROUND_TRIP',
    },
    {
        name: 'OTA Layout',
        input: `Booking Confirmed\nFrom IST to CDG\nFlight: TK1823\nDeparture: 14 Sep 2026 09:25\nArrival: 14 Sep 2026 12:10\nFlight: AF7431\nCDG -> LHR\nDeparture: 14 Sep 2026 14:05\nArrival: 14 Sep 2026 14:35`,
        expectedMinSegments: 2,
        expectedTripType: 'ONE_WAY',
    },
    {
        name: 'Airline Confirmation Email',
        input: `Outbound Flight:\n| TK 79\nDepart: Istanbul Airport (IST) Tue 10 Nov 2026 08:15\nArrive: San Francisco (SFO) Tue 10 Nov 2026 12:05\nAircraft: 787-9\nBaggage: 23kg`,
        expectedMinSegments: 1,
        expectedTripType: 'ONE_WAY',
    },
    {
        name: 'Malformed Partial Input',
        input: `AUD 3200\nTue 10 Jun\nRandom text\nIST -> SIN`,
        expectedMinSegments: 1,
    },
];

const fail = (message: string) => {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
};

const containsFakeFlightArtifact = (segments: Array<{ flightNumber?: string }>): boolean => {
    const badPrefixes = new Set(['AUD', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN', 'UTC', 'GMT']);
    return segments.some((segment) => {
        const fn = (segment.flightNumber || '').toUpperCase();
        const prefix = fn.match(/^([A-Z]{2,3})/)?.[1];
        return !!prefix && badPrefixes.has(prefix);
    });
};

const printComparison = (fixture: Fixture, segments: Array<{ from: string; to: string; flightNumber?: string; tripDirection?: string; departure?: string; arrival?: string }>, tripType?: string) => {
    console.log(`\n=== ${fixture.name} ===`);
    console.log('Before (historical failure signature):');
    console.log('- Hallucinated flight numbers (AUD3/TUE10), collapsed routes, wrong trip grouping');
    console.log('After (current parser):');
    console.log(`- tripType: ${tripType || 'UNKNOWN'}`);
    segments.forEach((segment, index) => {
        console.log(`  [${index + 1}] ${segment.from} -> ${segment.to} | ${segment.flightNumber || 'NO_FLIGHT'} | ${segment.tripDirection || 'NO_DIR'} | ${segment.departure || 'NO_DEP'} -> ${segment.arrival || 'NO_ARR'}`);
    });
};

for (const fixture of fixtures) {
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
        fail(`${fixture.name}: detected fake flight number artifact (currency/weekday/timezone prefix)`);
    }

    if (fixture.expectedFlights) {
        const gotFlights = parsed.segments.map((segment) => segment.flightNumber || '');
        for (let i = 0; i < fixture.expectedFlights.length; i += 1) {
            if (gotFlights[i] !== fixture.expectedFlights[i]) {
                fail(`${fixture.name}: segment ${i + 1} expected flight ${fixture.expectedFlights[i]}, got ${gotFlights[i] || 'EMPTY'}`);
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

    const result = itineraryInputToUnifiedFlight({
        mode: 'paste',
        itineraryText: fixture.input,
        adults: 1,
        children: 0,
        infants: 0,
    });

    if (fixture.expectedTripType && result.derived.tripType !== fixture.expectedTripType && fixture.expectedTripType !== 'MULTI_CITY') {
        fail(`${fixture.name}: converter derived tripType ${result.derived.tripType}, expected ${fixture.expectedTripType}`);
    }

    if (fixture.name === 'Google Flights Round Trip (IST-BNE)') {
        const hasFallbackTimelineWarning = (result.assessment.parseWarnings || []).some((warning) => /FALLBACK_DATE|fallback timeline|deterministic fallback/i.test(warning));
        if (hasFallbackTimelineWarning) {
            fail('IST-BNE: fallback timestamp usage detected even though explicit dates exist');
        }
    }
}

if (process.exitCode && process.exitCode !== 0) {
    console.error('\nParser reliability regression: FAILED');
    process.exit(process.exitCode);
}

console.log('\nParser reliability regression: PASS');

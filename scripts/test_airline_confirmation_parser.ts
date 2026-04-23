import { itineraryInputToUnifiedFlight } from '@/lib/manualFlightToUnifiedFlight';

const sample = `Singapore Airlines
Outbound Flight
Brisbane Arpt(BNE)
Depart:
12 Jun 2026 18:55
Arrive:
13 Jun 2026 00:55
Status:
Confirmed
Cabin Class:
Economy
Aircraft:
Airbus A350-900
Baggage: 30 K - NAME ONE
| SQ255
Changi Intl Arpt(SIN)
Stopover of 2 Hours 5 Mins in Changi Intl Arpt, Singapore, Singapore
Changi Intl Arpt(SIN)
Depart:
13 Jun 2026 03:00
Arrive:
13 Jun 2026 09:15
Status:
Confirmed
Cabin Class:
Economy
Aircraft:
Airbus A350-900
Baggage: 30 K - NAME ONE
| SQ392
Istanbul Airport(IST)

Inbound Flight
Istanbul Airport(IST)
Depart:
20 Jun 2026 14:10
Arrive:
20 Jun 2026 23:20
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
Changi Intl Arpt(SIN)
Depart:
21 Jun 2026 01:10
Arrive:
21 Jun 2026 10:40
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

console.log(JSON.stringify({
    extractedSegments: result.extractedSegments,
    parseWarnings: result.assessment.parseWarnings || [],
    parseConfidence: result.assessment.parseConfidence,
    tripDirectionDetected: {
        outbound: result.extractedSegments.filter((segment) => segment.from === 'BNE' || segment.from === 'SIN').length,
        inbound: result.extractedSegments.filter((segment) => segment.from === 'IST').length,
    },
}, null, 2));

if (result.extractedSegments.length !== 4) {
    throw new Error(`Expected 4 extracted segments, received ${result.extractedSegments.length}`);
}

const expectedRoutes = ['BNE-SIN-SQ255', 'SIN-IST-SQ392', 'IST-SIN-SQ391', 'SIN-BNE-SQ265'];
const actualRoutes = result.extractedSegments.map((segment) => `${segment.from}-${segment.to}-${segment.flightNumber}`);

for (const expectedRoute of expectedRoutes) {
    if (!actualRoutes.includes(expectedRoute)) {
        throw new Error(`Missing expected segment ${expectedRoute}`);
    }
}

console.log('Airline confirmation parser smoke test passed.');
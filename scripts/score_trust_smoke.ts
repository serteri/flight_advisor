import { POST } from '../app/api/score-flight/route';
import type { ItineraryScoreInput } from '../lib/manualFlightToUnifiedFlight';

type Scenario = {
    name: string;
    payload: ItineraryScoreInput;
    assert: (result: any, baseline: any) => string[];
};

const sampleItinerary = `Istanbul (IST) -> Brisbane (BNE)
Round trip | 1 adult | Economy | AUD 3200 total | Fare includes 30 kg checked baggage

OUTBOUND
Turkish Airlines TK54
IST -> SIN | Tue 10 Jun 2026 | Departs 02:00 -> Arrives 17:45

Singapore Airlines SQ245
SIN -> BNE | Tue 10 Jun 2026 | Departs 20:10 -> Arrives Wed 11 Jun 05:55

INBOUND
Singapore Airlines SQ246
BNE -> SIN | Wed 15 Jul 2026 | Departs 23:50 -> Arrives Thu 16 Jul 05:45

Turkish Airlines TK55
SIN -> IST | Thu 16 Jul 2026 | Departs 08:15 -> Arrives 14:10`;

const callScoreApi = async (payload: ItineraryScoreInput): Promise<any> => {
    const response = await POST({ json: async () => payload } as any);
    if (!response.ok) {
        const err = await response.text();
        throw new Error(`API call failed (${response.status}): ${err}`);
    }
    return response.json();
};

const assertChanged = (base: any, variant: any, path: string): string | null => {
    const left = path.split('.').reduce((acc, key) => (acc ? acc[key] : undefined), base);
    const right = path.split('.').reduce((acc, key) => (acc ? acc[key] : undefined), variant);
    if (JSON.stringify(left) === JSON.stringify(right)) {
        return `Expected change at ${path}, but value stayed the same (${JSON.stringify(left)}).`;
    }
    return null;
};

const scenarios: Scenario[] = [
    {
        name: 'Price Missing Should Stay Conservative',
        payload: {
            mode: 'paste',
            itineraryText: sampleItinerary.replace('AUD 3200 total | ', ''),
            adults: 1,
            children: 0,
            infants: 0,
        },
        assert: (result) => {
            const errors: string[] = [];
            if (result.confidenceInputs?.priceSource !== 'UNAVAILABLE') {
                errors.push('priceSource should be UNAVAILABLE when no price is provided.');
            }
            if (result.scoreTrust?.dataReliabilityLabel === 'HIGH') {
                errors.push('dataReliabilityLabel should not be HIGH when price is missing.');
            }
            if (result.decision === 'BUY') {
                errors.push('decision should not be BUY when price is missing.');
            }
            return errors;
        },
    },
    {
        name: 'Inferred Baggage Should Downgrade Trust',
        payload: {
            mode: 'paste',
            itineraryText: sampleItinerary.replace('Fare includes 30 kg checked baggage', 'Passenger baggage allowance listed as 30kg'),
            adults: 1,
            children: 0,
            infants: 0,
        },
        assert: (result, baseline) => {
            const errors: string[] = [];
            if (!['INFERRED_BAGGAGE', 'UNKNOWN_BAGGAGE'].includes(result.confidenceInputs?.baggageSource)) {
                errors.push(`baggageSource should be inferred/unknown, got ${result.confidenceInputs?.baggageSource}.`);
            }
            if (result.confidenceInputs?.baggageSource === baseline.confidenceInputs?.baggageSource) {
                errors.push('baggageSource should differ from baseline when baggage trust evidence changes.');
            }
            const baggageBreakdown = (result.scoreBreakdown || []).find((item: any) => item.component === 'baggage');
            const baselineBaggageBreakdown = (baseline.scoreBreakdown || []).find((item: any) => item.component === 'baggage');
            if (!baggageBreakdown || baggageBreakdown.sourceReliability === 'HIGH') {
                errors.push('baggage component sourceReliability should be MEDIUM/LOW when baggage is inferred.');
            }
            if (baselineBaggageBreakdown && baggageBreakdown && baggageBreakdown.sourceReliability === baselineBaggageBreakdown.sourceReliability) {
                errors.push('baggage component sourceReliability should change from baseline.');
            }
            return errors;
        },
    },
];

(async () => {
    const baselinePayload: ItineraryScoreInput = {
        mode: 'paste',
        itineraryText: sampleItinerary,
        adults: 1,
        children: 0,
        infants: 0,
        checkedBaggageKg: 30,
    };

    const baseline = await callScoreApi(baselinePayload);
    const baselineGuardErrors: string[] = [];

    if (!baseline.scoreTrust || typeof baseline.scoreTrust.finalScore !== 'number') {
        baselineGuardErrors.push('scoreTrust contract missing from baseline response.');
    }
    if (!Array.isArray(baseline.scoreBreakdown) || baseline.scoreBreakdown.some((item: any) => typeof item.maxPoints !== 'number' || !item.sourceReliability)) {
        baselineGuardErrors.push('scoreBreakdown items must include maxPoints and sourceReliability.');
    }

    if (baselineGuardErrors.length > 0) {
        console.error('Baseline validation failed:');
        baselineGuardErrors.forEach((error) => console.error(`- ${error}`));
        process.exit(1);
    }

    let hasFailure = false;

    for (const scenario of scenarios) {
        const result = await callScoreApi(scenario.payload);
        const errors = scenario.assert(result, baseline);

        const scoreDiffError = assertChanged(baseline, result, 'scoreTrust.finalScore');
        const reasonDiffError = assertChanged(baseline, result, 'scoreTrust.decisionReason');

        if (scoreDiffError && reasonDiffError) {
            errors.push('Neither final score nor decision reason changed for scenario variation.');
        }

        if (errors.length > 0) {
            hasFailure = true;
            console.error(`\nFAIL: ${scenario.name}`);
            errors.forEach((error) => console.error(`- ${error}`));
        } else {
            console.log(`\nPASS: ${scenario.name}`);
            console.log(`- decision: ${result.decision}`);
            console.log(`- finalScore: ${result.scoreTrust.finalScore}`);
            console.log(`- reliability: ${result.scoreTrust.dataReliabilityLabel} (${result.scoreTrust.dataReliabilityScore})`);
        }
    }

    if (hasFailure) {
        console.error('\nScore trust smoke: FAILED');
        process.exit(1);
    }

    console.log('\nScore trust smoke: PASS');
})();

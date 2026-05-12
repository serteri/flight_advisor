import { POST } from '../app/api/score-flight/route';
import type { ItineraryScoreInput } from '../lib/manualFlightToUnifiedFlight';

type ReliabilityTier = 'HIGH_RELIABILITY' | 'MODERATE_RELIABILITY' | 'LIMITED_RELIABILITY' | 'PRELIMINARY_ESTIMATE';

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

const expectedTierFromScore = (score: number): ReliabilityTier => {
    if (score >= 85) return 'HIGH_RELIABILITY';
    if (score >= 65) return 'MODERATE_RELIABILITY';
    if (score >= 45) return 'LIMITED_RELIABILITY';
    return 'PRELIMINARY_ESTIMATE';
};

const assertTierMapping = (result: any): string[] => {
    const errors: string[] = [];
    const score = Number(result?.scoreTrust?.dataReliabilityScore);
    const tier = result?.scoreTrust?.reliabilityTier as ReliabilityTier | undefined;
    if (!Number.isFinite(score) || !tier) {
        errors.push('Missing reliability score/tier in scoreTrust.');
        return errors;
    }
    const expected = expectedTierFromScore(score);
    if (tier !== expected) {
        errors.push(`Reliability tier mismatch: expected ${expected} for score ${score}, got ${tier}.`);
    }
    return errors;
};

const assertPremiumReportShape = (result: any): string[] => {
    const errors: string[] = [];
    const report = result?.premiumReport;
    if (!report || typeof report !== 'object') {
        errors.push('premiumReport is missing.');
        return errors;
    }

    const requiredKeys = [
        'executiveSummary',
        'tripOverview',
        'recommendationSummary',
        'reliabilityAndVerification',
        'routeAndConnectionAnalysis',
        'airlineAndAircraftAnalysis',
        'baggageAndFareConditions',
        'riskAndDisruptionExposure',
        'comfortAndFatigueAnalysis',
        'pricingContext',
        'keyRisks',
        'whatWouldImproveThisItinerary',
        'finalRecommendation',
    ];

    for (const key of requiredKeys) {
        if (!report[key]) {
            errors.push(`premiumReport.${key} is missing.`);
            continue;
        }
        if (typeof report[key].summary !== 'string' || report[key].summary.trim().length === 0) {
            errors.push(`premiumReport.${key}.summary is empty.`);
        }
        if (!Array.isArray(report[key].bullets)) {
            errors.push(`premiumReport.${key}.bullets must be an array.`);
        }
    }

    const serializedReport = JSON.stringify(report).toLowerCase();
    if (/\d+\.?\d*%\s*confidence/.test(serializedReport) || /confidence is\s*\d+/.test(serializedReport)) {
        errors.push('premiumReport contains confidence percentage spam language.');
    }

    return errors;
};

const scenarios: Scenario[] = [
    {
        name: 'Fully Verified Baseline Reliability Contract',
        payload: {
            mode: 'paste',
            itineraryText: sampleItinerary,
            adults: 1,
            children: 0,
            infants: 0,
            checkedBaggageKg: 30,
        },
        assert: (result) => {
            const errors: string[] = [];
            errors.push(...assertTierMapping(result));
            errors.push(...assertPremiumReportShape(result));
            if (!result.scoreTrust?.reliabilityLabel) {
                errors.push('reliabilityLabel must be present.');
            }
            if (!Array.isArray(result.scoreTrust?.verificationSummary?.verified)) {
                errors.push('verificationSummary.verified must be present.');
            }
            if ((Number(result.insights?.confidence) % 5) !== 0) {
                errors.push('Displayed confidence should be aggressively rounded to 5-point steps.');
            }
            return errors;
        },
    },
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
            errors.push(...assertTierMapping(result));
            if (result.confidenceInputs?.priceSource !== 'UNAVAILABLE') {
                errors.push('priceSource should be UNAVAILABLE when no price is provided.');
            }
            if (!['LIMITED_RELIABILITY', 'PRELIMINARY_ESTIMATE'].includes(result.scoreTrust?.reliabilityTier)) {
                errors.push('reliabilityTier should be LIMITED or PRELIMINARY when price is missing.');
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
            errors.push(...assertTierMapping(result));
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
    {
        name: 'Fallback Dates Must Lower Reliability',
        payload: {
            mode: 'paste',
            itineraryText: `IST -> SIN | TK54\nSIN -> BNE | SQ245\nRound trip | AUD 3200 total`,
            adults: 1,
            children: 0,
            infants: 0,
        },
        assert: (result) => {
            const errors: string[] = [];
            errors.push(...assertTierMapping(result));
            const warnings = result.parseWarnings || [];
            const hasFallbackHint = warnings.some((w: string) => /fallback_date|fallback timeline|inferred_date/i.test(w));
            if (!hasFallbackHint) {
                errors.push('Expected fallback/inferred date warning for missing explicit dates.');
            }
            if (result.scoreTrust?.whyReliabilityIsLimited?.length === 0) {
                errors.push('whyReliabilityIsLimited should list fallback-date uncertainty.');
            }
            return errors;
        },
    },
    {
        name: 'Partial Route Extraction Must Be Preliminary',
        payload: {
            mode: 'paste',
            itineraryText: 'IST -> SIN\nRandom notes without timing, airline, or pricing details.',
            adults: 1,
            children: 0,
            infants: 0,
        },
        assert: (result) => {
            const errors: string[] = [];
            errors.push(...assertTierMapping(result));
            if (!['PRELIMINARY_ESTIMATE', 'LIMITED_RELIABILITY'].includes(result.scoreTrust?.reliabilityTier)) {
                errors.push(`Expected low reliability tier, got ${result.scoreTrust?.reliabilityTier}.`);
            }
            return errors;
        },
    },
    {
        name: 'No Live Benchmark Must Be Explicitly Disclosed',
        payload: {
            mode: 'paste',
            itineraryText: sampleItinerary,
            adults: 1,
            children: 0,
            infants: 0,
            checkedBaggageKg: 30,
        },
        assert: (result) => {
            const errors: string[] = [];
            errors.push(...assertTierMapping(result));
            const source = result.scoreTrust?.dataSourceDisclosure?.marketData;
            if (!['HISTORICAL_ESTIMATE', 'INTERNAL_ESTIMATE'].includes(source)) {
                errors.push(`Expected market source disclosure to be estimated, got ${source}.`);
            }
            return errors;
        },
    },
    {
        name: 'Mixed Traveler Pricing Must Explain Comparable Fare',
        payload: {
            mode: 'paste',
            itineraryText: sampleItinerary.replace('1 adult', '2 adults, 1 child, 1 infant'),
            adults: 2,
            children: 1,
            infants: 1,
            checkedBaggageKg: 30,
        },
        assert: (result) => {
            const errors: string[] = [];
            errors.push(...assertTierMapping(result));
            const passengerContext = result.passengerPricingContext;
            if (!passengerContext || passengerContext.totalTravelers !== 4 || !passengerContext.mixedTravelerTypes) {
                errors.push('passengerPricingContext should identify mixed traveler pricing with 4 travelers.');
            }
            const serialized = JSON.stringify(result.scoreBreakdown || []);
            if (!/adult-equivalent fare/i.test(serialized)) {
                errors.push('scoreBreakdown should explain adult-equivalent fare comparison for mixed travelers.');
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
    baselineGuardErrors.push(...assertTierMapping(baseline));
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
        const tierDiffError = assertChanged(baseline, result, 'scoreTrust.reliabilityTier');

        const allowNoDrift = scenario.name === 'Fully Verified Baseline Reliability Contract'
            || scenario.name === 'No Live Benchmark Must Be Explicitly Disclosed';
        if (scoreDiffError && reasonDiffError && tierDiffError && !allowNoDrift) {
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
            console.log(`- reliability: ${result.scoreTrust.reliabilityTier} (${result.scoreTrust.dataReliabilityScore})`);
        }
    }

    if (hasFailure) {
        console.error('\nScore trust smoke: FAILED');
        process.exit(1);
    }

    console.log('\nScore trust smoke: PASS');
})();

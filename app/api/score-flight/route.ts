import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';

import {
    itineraryScoreInputSchema,
    itineraryInputToUnifiedFlight,
    type ItineraryScoreInput,
    type InputAssessment,
    type DerivedStructureMetrics,
} from '@/lib/manualFlightToUnifiedFlight';
import { applyAdvancedFlightScoring, applyRouteIntelligenceFeatures } from '@/lib/scoring/advancedFlightScoring';
import { buildParseAudit, runSelfCheckLayer, type ParseAudit } from '@/lib/audit/selfCheckLayer';
import { recordParserMetric } from '@/services/healthMetrics';
import type { ParserMetricEvent } from '@/types/operatorHealth';

type ManualDecision = 'BUY' | 'WAIT' | 'WATCH';
type ReliabilityTier = 'HIGH_RELIABILITY' | 'MODERATE_RELIABILITY' | 'LIMITED_RELIABILITY' | 'PRELIMINARY_ESTIMATE';
type ReliabilityBand = 'LOW' | 'MEDIUM' | 'HIGH';
type MarketDataSource = 'LIVE_PROVIDER_DATA' | 'HISTORICAL_ESTIMATE' | 'INTERNAL_ESTIMATE';
type InputDataSource = 'USER_PROVIDED_INPUT' | 'PARSED_TEXT' | 'INFERRED_TEXT' | 'UNAVAILABLE_INPUT';

type WarningSignals = {
    totalWarnings: number;
    missingBaggage: number;
    missingPrice: number;
    missingSegmentTimes: number;
    routeMismatch: number;
    unrealisticLayover: number;
    chronologyIssues: number;
    partialExtraction: number;
    severityPenalty: number;
};

type RecommendationExplanation = {
    primaryReason: string;
    supportingReasons: string[];
    missingDataWarnings: string[];
    actionHint: string;
    positiveFactors: string[];
    negativeFactors: string[];
    missingFactors: string[];
};

type ScoreBreakdownItem = {
    component: 'price' | 'duration' | 'connections' | 'airlineReliability' | 'baggage' | 'routeRealism' | 'comfort';
    label: string;
    points: number;
    maxPoints: number;
    reason: string;
    sourceReliability: 'HIGH' | 'MEDIUM' | 'LOW';
};

type ScoreTrustContract = {
    finalScore: number;
    scoreQualityLabel: 'PRELIMINARY' | 'ADVISORY' | 'STRONG';
    reliabilityTier: ReliabilityTier;
    reliabilityLabel: 'High Reliability' | 'Moderate Reliability' | 'Limited Reliability' | 'Preliminary Estimate';
    dataReliabilityLabel: ReliabilityBand;
    dataReliabilityScore: number;
    decision: ManualDecision;
    decisionReason: string;
    reliabilityExplanation: string;
    verificationSummary: {
        verified: string[];
        inferred: string[];
        estimated: string[];
        uncertain: string[];
    };
    dataSourceDisclosure: {
        marketData: MarketDataSource;
        priceInput: InputDataSource;
        baggageInput: InputDataSource;
    };
    scoreBreakdown: ScoreBreakdownItem[];
    penalties: string[];
    missingDataImpact: string[];
    whyReliabilityIsLimited: string[];
};

type PremiumReportSection = {
    title: string;
    summary: string;
    bullets: string[];
};

type PremiumReport = {
    executiveSummary: PremiumReportSection;
    tripOverview: PremiumReportSection;
    recommendationSummary: PremiumReportSection;
    reliabilityAndVerification: PremiumReportSection;
    routeAndConnectionAnalysis: PremiumReportSection;
    airlineAndAircraftAnalysis: PremiumReportSection;
    baggageAndFareConditions: PremiumReportSection;
    riskAndDisruptionExposure: PremiumReportSection;
    comfortAndFatigueAnalysis: PremiumReportSection;
    pricingContext: PremiumReportSection;
    keyRisks: PremiumReportSection;
    whatWouldImproveThisItinerary: PremiumReportSection;
    finalRecommendation: PremiumReportSection;
};

type PassengerPricingContext = NonNullable<InputAssessment['passengerPricingContext']>;

const normalizeDecision = (action?: string): ManualDecision => {
    if (action === 'BUY') return 'BUY';
    if (action === 'WAIT') return 'WAIT';
    return 'WATCH';
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const toOneDecimal = (value: number): number => Number(value.toFixed(1));

const toTenPoint = (value: number | undefined, max: number): number => {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric) || max <= 0) return 0;
    return toOneDecimal(clamp((numeric / max) * 10, 0, 10));
};

const toReliabilityTier = (score: number): ReliabilityTier => {
    if (score >= 85) return 'HIGH_RELIABILITY';
    if (score >= 65) return 'MODERATE_RELIABILITY';
    if (score >= 45) return 'LIMITED_RELIABILITY';
    return 'PRELIMINARY_ESTIMATE';
};

const toReliabilityLabel = (tier: ReliabilityTier): ScoreTrustContract['reliabilityLabel'] => {
    if (tier === 'HIGH_RELIABILITY') return 'High Reliability';
    if (tier === 'MODERATE_RELIABILITY') return 'Moderate Reliability';
    if (tier === 'LIMITED_RELIABILITY') return 'Limited Reliability';
    return 'Preliminary Estimate';
};

const toReliabilityBand = (tier: ReliabilityTier): ReliabilityBand => {
    if (tier === 'HIGH_RELIABILITY') return 'HIGH';
    if (tier === 'MODERATE_RELIABILITY') return 'MEDIUM';
    return 'LOW';
};

const toMarketDataSource = (assessment: InputAssessment): MarketDataSource => {
    if (assessment.livePriceBenchmarkAvailable) return 'LIVE_PROVIDER_DATA';
    if (assessment.priceMissing) return 'INTERNAL_ESTIMATE';
    return 'HISTORICAL_ESTIMATE';
};

const toPriceInputSource = (assessment: InputAssessment): InputDataSource => {
    if (assessment.priceSource === 'USER_PROVIDED') return 'USER_PROVIDED_INPUT';
    if (assessment.priceSource === 'PARSED_TEXT') return 'PARSED_TEXT';
    return 'UNAVAILABLE_INPUT';
};

const toBaggageInputSource = (assessment: InputAssessment): InputDataSource => {
    if (assessment.baggageSource === 'USER_PROVIDED_BAGGAGE') return 'USER_PROVIDED_INPUT';
    if (assessment.baggageSource === 'PARSED_BAGGAGE') return 'PARSED_TEXT';
    if (assessment.baggageSource === 'INFERRED_BAGGAGE') return 'INFERRED_TEXT';
    return 'UNAVAILABLE_INPUT';
};

const buildScoreBreakdown = (
    flight: any,
    derived: DerivedStructureMetrics,
    assessment: InputAssessment,
    passengerPricingContext?: PassengerPricingContext,
): ScoreBreakdownItem[] => {
    const breakdown = flight?.score?.breakdown || {};
    const comfortSignals = (flight?.score?.comfortNotes || []) as string[];
    const pricePoints = assessment.priceMissing ? 0 : toTenPoint(breakdown.priceScore, 20);
    const durationPoints = toTenPoint(breakdown.durationScore, 15);
    const connectionsPoints = toOneDecimal(clamp(((Number(breakdown.stopScore || 0) + Number(breakdown.connectionScore || 0)) / 2), 0, 10));
    const reliabilityPoints = toTenPoint(breakdown.reliabilityScore, 10);
    const baggagePoints = toTenPoint(breakdown.baggageScore, 10);
    const amenities = Number(breakdown.amenitiesScore || 0);
    const aircraft = Number(breakdown.airlineScore || 0);
    const comfortPoints = toOneDecimal(clamp((((amenities / 5) + (aircraft / 5)) / 2) * 10, 0, 10));

    const connectionReason = derived.tripType === 'ROUND_TRIP'
        ? `Outbound connections: ${derived.outboundConnectionCount}, inbound connections: ${derived.inboundConnectionCount}.`
        : `Total connections: ${derived.connectionCount}.`;
    const durationReason = derived.tripType === 'ROUND_TRIP'
        ? `Outbound duration ${derived.outboundDurationMinutes} min, inbound duration ${derived.inboundDurationMinutes} min.`
        : `Total duration ${derived.totalDurationMinutes} min.`;
    const hasUnknownAirline = /^(UNK|UNKN|UNKNOWN|MANUAL)/i.test(String(flight?.airline || ''));
    const segmentTimesIncomplete = (assessment.parseWarnings || []).some((warning) => /missing segment times|incomplete times|fallback_date|inferred_date/i.test(warning));
    const routeRealismPoints = (derived.routeRealism === 'REALISTIC' && !segmentTimesIncomplete) ? 9 : 5;

    return [
        {
            component: 'price',
            label: 'Price value',
            points: pricePoints,
            maxPoints: 10,
            reason: assessment.priceMissing
                ? 'Price not provided, so price value was not scored.'
                : passengerPricingContext
                    ? `${passengerPricingContext.totalPrice} total fare for ${passengerPricingContext.totalTravelers} traveler(s); adult-equivalent fare ${passengerPricingContext.comparablePerTravelerPrice.toFixed(2)}.`
                    : 'Manual fare was used for estimated comparison.',
            sourceReliability: assessment.priceMissing
                ? 'LOW'
                : assessment.livePriceBenchmarkAvailable
                    ? 'HIGH'
                    : 'MEDIUM',
        },
        {
            component: 'duration',
            label: 'Duration',
            points: durationPoints,
            maxPoints: 10,
            reason: durationReason,
            sourceReliability: segmentTimesIncomplete ? 'LOW' : 'HIGH',
        },
        {
            component: 'connections',
            label: 'Connections',
            points: connectionsPoints,
            maxPoints: 10,
            reason: connectionReason,
            sourceReliability: segmentTimesIncomplete ? 'LOW' : 'HIGH',
        },
        {
            component: 'airlineReliability',
            label: 'Airline reliability',
            points: reliabilityPoints,
            maxPoints: 10,
            reason: !hasUnknownAirline && comfortSignals.some((note) => /top-tier airline/i.test(note))
                ? 'Airline is treated as top-tier for reliability signals.'
                : hasUnknownAirline
                    ? 'Airline identity is uncertain, so reliability bonus is limited.'
                    : 'Reliability score is based on airline on-time and consistency signals.',
            sourceReliability: hasUnknownAirline ? 'LOW' : 'HIGH',
        },
        {
            component: 'baggage',
            label: 'Baggage',
            points: baggagePoints,
            maxPoints: 10,
            reason: assessment.baggageUnverified
                ? 'Baggage was detected from text but not fare-confirmed.'
                : 'Checked baggage details were included in scoring.',
            sourceReliability: assessment.baggageUnverified ? 'LOW' : 'HIGH',
        },
        {
            component: 'routeRealism',
            label: 'Route realism',
            points: routeRealismPoints,
            maxPoints: 10,
            reason: derived.routeRealism === 'REALISTIC' && !segmentTimesIncomplete
                ? 'Segment sequence and timing look realistic.'
                : segmentTimesIncomplete
                    ? 'Route realism is limited because some segment fields are inferred or incomplete.'
                    : 'Route structure has realism warnings.',
            sourceReliability: segmentTimesIncomplete ? 'LOW' : 'MEDIUM',
        },
        {
            component: 'comfort',
            label: 'Comfort',
            points: comfortPoints,
            maxPoints: 10,
            reason: comfortSignals.length > 0
                ? comfortSignals.slice(0, 2).join(' ')
                : 'Comfort score is based on aircraft and amenities signals.',
            sourceReliability: hasUnknownAirline ? 'MEDIUM' : 'HIGH',
        },
    ];
};

const buildPenalties = (
    assessment: InputAssessment,
    signals: WarningSignals,
): string[] => {
    const penalties: string[] = [];
    if (assessment.passengerPricingContext?.mixedTravelerTypes) penalties.push('mixed traveler pricing penalty');
    if (!assessment.livePriceBenchmarkAvailable && !assessment.priceMissing) penalties.push('missing live price benchmark penalty');
    if (signals.partialExtraction > 0) penalties.push('fallback/inferred extraction penalty');
    if (assessment.baggageUnverified) penalties.push('low baggage certainty penalty');
    if (signals.routeMismatch > 0) penalties.push('route mismatch penalty');
    if (signals.unrealisticLayover > 0) penalties.push('excessive layover penalty');
    if (assessment.airlineReliabilityMix === 'SINGLE_CARRIER') penalties.push('airline reliability bonus');
    return penalties;
};

const buildMissingDataImpact = (
    assessment: InputAssessment,
    signals: WarningSignals,
): string[] => {
    const impacts: string[] = [];
    if (assessment.priceMissing) impacts.push('Price benchmark is unavailable; recommendation strength is reduced.');
    if (!assessment.priceMissing && !assessment.livePriceBenchmarkAvailable) impacts.push('Price benchmark is estimated; live market comparison is unavailable.');
    if (assessment.baggageSource === 'INFERRED_BAGGAGE') impacts.push('Baggage was parsed from passenger lines and may not be fare-guaranteed.');
    if (assessment.baggageSource === 'UNKNOWN_BAGGAGE') impacts.push('Baggage data is unknown; baggage component confidence is reduced.');
    if (signals.missingSegmentTimes > 0) impacts.push('Some segment fields were inferred from partial timeline context.');
    if (signals.partialExtraction > 0) impacts.push('Some itinerary fields were inferred/fallback-derived due to partial extraction.');
    return impacts;
};

const computeDataReliability = (
    assessment: InputAssessment,
    signals: WarningSignals,
): { score: number; tier: ReliabilityTier; label: ScoreTrustContract['reliabilityLabel']; band: ReliabilityBand; explanation: string } => {
    let score = 85;
    if (assessment.priceMissing) score -= 30;
    else if (!assessment.livePriceBenchmarkAvailable) score -= 12;
    if (assessment.baggageUnverified) score -= 15;
    if (assessment.baggageSource === 'UNKNOWN_BAGGAGE') score -= 10;
    score -= Math.min(28, signals.severityPenalty);
    score = Math.round(clamp(score, 15, 95) / 5) * 5;

    const tier = toReliabilityTier(score);
    const label = toReliabilityLabel(tier);
    const band = toReliabilityBand(tier);
    const explanation = tier === 'HIGH_RELIABILITY'
        ? 'Based on verified itinerary structure with limited inference.'
        : tier === 'MODERATE_RELIABILITY'
            ? 'Some fields were inferred and price comparison may be estimated.'
            : tier === 'LIMITED_RELIABILITY'
                ? 'Several fields are inferred or estimated, so recommendation strength is limited.'
                : 'This is a preliminary estimate with material uncertainty in key inputs.';

    return { score, tier, label, band, explanation };
};

const computeScoreQualityLabel = (
    finalScore: number,
    reliabilityTier: ReliabilityTier,
): 'PRELIMINARY' | 'ADVISORY' | 'STRONG' => {
    if (reliabilityTier === 'PRELIMINARY_ESTIMATE' || reliabilityTier === 'LIMITED_RELIABILITY') return 'PRELIMINARY';
    if (finalScore >= 7.5 && reliabilityTier === 'HIGH_RELIABILITY') return 'STRONG';
    return 'ADVISORY';
};

const parseWarningSignals = (assessment: InputAssessment): WarningSignals => {
    const warnings = assessment.parseWarnings || [];
    const hasMatch = (warning: string, regex: RegExp): boolean => regex.test(warning);

    const missingBaggage = warnings.filter((warning) => hasMatch(warning, /missing baggage|baggage/i)).length;
    const missingPrice = warnings.filter((warning) => {
        const normalized = warning.toLowerCase();
        if (/manual price override used/i.test(normalized)) {
            return false;
        }
        return /price missing|price not detected/i.test(normalized);
    }).length;
    const missingSegmentTimes = warnings.filter((warning) => hasMatch(warning, /missing segment times|missing times/i)).length;
    const routeMismatch = warnings.filter((warning) => hasMatch(warning, /route mismatch/i)).length;
    const unrealisticLayover = warnings.filter((warning) => hasMatch(warning, /unrealistic layover|negative layover|chronology/i)).length;
    const chronologyIssues = warnings.filter((warning) => hasMatch(warning, /chronology|negative layover/i)).length;
    const partialExtraction = warnings.filter((warning) => hasMatch(warning, /could not parse any route segment|inferred|fallback|placeholder/i)).length;

    const severityPenalty =
        (missingBaggage * 1.2)
        + (missingPrice * 5)
        + (missingSegmentTimes * 4)
        + (routeMismatch * 5)
        + (unrealisticLayover * 4)
        + (chronologyIssues * 5)
        + (partialExtraction * 10);

    return {
        totalWarnings: warnings.length,
        missingBaggage,
        missingPrice,
        missingSegmentTimes,
        routeMismatch,
        unrealisticLayover,
        chronologyIssues,
        partialExtraction,
        severityPenalty,
    };
};

const computeConfidenceCap = (
    mode: 'quick' | 'detailed',
    signals: WarningSignals,
    derived: DerivedStructureMetrics,
    assessment: InputAssessment,
): number => {
    let cap = mode === 'quick' ? 60 : 90;

    if (signals.chronologyIssues > 0 || signals.routeMismatch > 0) {
        cap = Math.min(cap, 66);
    }
    if (signals.missingSegmentTimes > 0) {
        cap = Math.min(cap, 68);
    }
    if (signals.partialExtraction > 0) {
        cap = Math.min(cap, 70);
    }
    if (signals.missingPrice > 0) {
        cap = Math.min(cap, 65);
    }
    if (derived.routeRealism === 'QUESTIONABLE') {
        cap = Math.min(cap, 72);
    }
    if (derived.connectionFeasibility === 'RISKY') {
        cap = Math.min(cap, 74);
    }
    if (assessment.priceMissing || assessment.baggageUnverified || signals.partialExtraction > 0) {
        cap = Math.min(cap, 65);
    }
    if (!assessment.priceMissing && !assessment.livePriceBenchmarkAvailable) {
        const veryComplete = (assessment.completenessScore >= 0.9)
            && (assessment.realismScore >= 0.9)
            && ((assessment.parseConfidence ?? 0.7) >= 0.85)
            && derived.routeRealism === 'REALISTIC'
            && derived.connectionFeasibility !== 'RISKY';
        if (!veryComplete) {
            cap = Math.min(cap, 75);
        }
    }

    return cap;
};

const computeModeConfidence = (
    mode: 'quick' | 'detailed',
    baseConfidence: number,
    assessment: InputAssessment,
    derived: DerivedStructureMetrics,
    signals: WarningSignals,
): number => {
    const parseConfidence = assessment.parseConfidence ?? (mode === 'quick' ? 0.5 : 0.65);
    const warningPenalty = signals.severityPenalty + (signals.totalWarnings * 0.8);
    const confidenceCap = computeConfidenceCap(mode, signals, derived, assessment);
    const passengerContext = assessment.passengerPricingContext;
    const passengerPenalty = passengerContext?.mixedTravelerTypes
        ? 8
        : (passengerContext && passengerContext.totalTravelers > 1 ? 4 : 0);

    if (mode === 'quick') {
        const quickRaw =
            40
            + (assessment.completenessScore * 14)
            + (assessment.realismScore * 6)
            + (parseConfidence * 10)
            - warningPenalty
            - passengerPenalty;
        const blended = (quickRaw * 0.7) + (baseConfidence * 0.3);
        return Number(clamp(Math.min(blended, confidenceCap), 35, 62).toFixed(1));
    }

    const detailedConfidenceRaw =
        48
        + (assessment.completenessScore * 20)
        + (assessment.realismScore * 17)
        + (assessment.baggageConfidenceScore * 9)
        + (parseConfidence * 12)
        - (assessment.priceContextAvailable ? 0 : 4);

    const realismPenalty = derived.routeRealism === 'QUESTIONABLE' ? 6 : 0;
    const baggagePenalty = assessment.baggageConfidenceScore < 0.7 ? 5 : 0;
    const feasibilityPenalty = derived.connectionFeasibility === 'RISKY'
        ? 6
        : derived.connectionFeasibility === 'TIGHT'
            ? 2
            : 0;

    const blended = ((detailedConfidenceRaw - realismPenalty - baggagePenalty - feasibilityPenalty - warningPenalty - passengerPenalty) * 0.65)
        + (baseConfidence * 0.35);

    return Number(clamp(Math.min(blended, confidenceCap), 44, 90).toFixed(1));
};

const buildModeDecision = (
    mode: 'quick' | 'detailed',
    initialDecision: ManualDecision,
    confidence: number,
    derived: DerivedStructureMetrics,
    signals: WarningSignals,
): ManualDecision => {
    if (mode === 'quick') return 'WATCH';

    if (signals.chronologyIssues > 0 || signals.routeMismatch > 0 || signals.missingSegmentTimes > 0) {
        return 'WATCH';
    }

    if (derived.routeRealism === 'QUESTIONABLE' && confidence < 70) {
        return 'WATCH';
    }

    if (confidence < 60) return 'WATCH';

    if (initialDecision === 'BUY') {
        if (confidence < 72) return 'WAIT';
        if (signals.totalWarnings >= 3 || signals.missingPrice > 0 || signals.partialExtraction > 0) return 'WAIT';
        if (derived.connectionFeasibility === 'RISKY') return 'WAIT';
    }

    if (initialDecision === 'WAIT' && confidence < 64) {
        return 'WATCH';
    }

    return initialDecision;
};

const buildWatchLabel = (
    confidence: number,
    signals: WarningSignals,
    assessment: InputAssessment,
): string => {
    if (confidence >= 75) {
        if (signals.missingPrice > 0) {
            return 'Watch closely — no live price benchmark available; confirm fare before booking';
        }
        if (!assessment.priceMissing && !assessment.livePriceBenchmarkAvailable) {
            return 'Watch closely — price is provided, but live market benchmark is estimated.';
        }
        if (!assessment.priceContextAvailable) {
            return 'Watch closely — price context unavailable; verify fare and availability first';
        }
        if (assessment.passengerPricingContext?.mixedTravelerTypes) {
            return 'Watch closely — mixed traveler pricing reduces direct fare comparability';
        }
        return 'Watch closely — verify fare and availability before committing';
    }
    return 'Watch closely — key inputs are incomplete or inferred; verify full itinerary details first';
};

const buildModeExplanation = (
    mode: 'quick' | 'detailed',
    baseReason: string,
    confidence: number,
    assessment: InputAssessment,
    derived: DerivedStructureMetrics,
): string => {
    const notes: string[] = [];

    if (mode === 'quick') {
        notes.push('QUICK SCORE: rough recommendation only.');
        notes.push('Add detailed itinerary segments for stronger connection and transfer realism.');
    }

    if (mode === 'detailed' && confidence < 62) {
        notes.push('Detailed itinerary still has realism gaps, so recommendation is softened.');
    }

    if (derived.routeRealism === 'QUESTIONABLE') {
        notes.push('Route realism check flagged this itinerary as questionable.');
    }

    if (assessment.baggageConfidenceScore < 0.7) {
        notes.push('Baggage confidence is limited because exact allowance details are incomplete.');
    }

    if (assessment.passengerPricingContext) {
        const passengerContext = assessment.passengerPricingContext;
        if (passengerContext.totalTravelers > 1) {
            notes.push(`Price reflects ${passengerContext.totalTravelers} travelers; benchmark comparison uses an estimated per-traveler amount.`);
        }
        if (passengerContext.mixedTravelerTypes) {
            notes.push('Child/infant pricing reduces direct comparability to standard adult fare benchmarks.');
        }
    }

    if (!assessment.priceMissing && !assessment.livePriceBenchmarkAvailable) {
        notes.push('Price is provided, but live market benchmark is estimated.');
    } else if (!assessment.priceContextAvailable) {
        notes.push('No external route-price context is available; timing certainty is limited.');
    }

    if ((assessment.parseWarnings?.length || 0) > 0) {
        notes.push(`Parser raised ${assessment.parseWarnings?.length || 0} warning(s), reducing certainty.`);
    }

    return [baseReason, ...notes, ...assessment.riskFlags.slice(0, 2)]
        .filter(Boolean)
        .join(' ')
        .trim();
};

const buildRecommendationExplanation = (
    decision: ManualDecision,
    reliability: ReturnType<typeof computeDataReliability>,
    assessment: InputAssessment,
    derived: DerivedStructureMetrics,
    signals: WarningSignals,
): RecommendationExplanation => {
    const positiveFactors: string[] = [];
    const negativeFactors: string[] = [];
    const missingFactors: string[] = [];

    if (derived.routeRealism === 'REALISTIC') {
        positiveFactors.push('Route structure appears realistic.');
    } else {
        negativeFactors.push('Route realism is questionable.');
    }

    if (derived.connectionFeasibility === 'GOOD') {
        positiveFactors.push('Connection timing looks safe.');
    }
    if (derived.connectionFeasibility === 'TIGHT') {
        negativeFactors.push('At least one connection is tight.');
    }
    if (derived.connectionFeasibility === 'RISKY') {
        negativeFactors.push('Connection structure is risky.');
    }

    if (assessment.baggageConfidenceScore >= 0.8) {
        positiveFactors.push('Baggage details are mostly complete.');
    } else {
        missingFactors.push('Baggage details are incomplete.');
    }

    if ((assessment.parseConfidence ?? 0.5) >= 0.7) {
        positiveFactors.push('Parsed itinerary structure is mostly consistent.');
    } else {
        negativeFactors.push('Parsed itinerary structure is partially inferred.');
    }

    if (signals.missingPrice > 0) {
        missingFactors.push('Price is missing and price value scoring is disabled.');
    }
    if (signals.missingSegmentTimes > 0) {
        missingFactors.push('Some segment departure/arrival times are missing.');
    }
    if (signals.routeMismatch > 0) {
        negativeFactors.push('Segment sequence has route mismatch issues.');
    }
    if (signals.unrealisticLayover > 0 || signals.chronologyIssues > 0) {
        negativeFactors.push('Chronology or layover consistency has warning flags.');
    }
    if (signals.partialExtraction > 0) {
        missingFactors.push('Only partial segment extraction was possible from pasted text.');
    }
    if (assessment.passengerPricingContext?.totalTravelers && assessment.passengerPricingContext.totalTravelers > 1) {
        missingFactors.push('Price reflects multiple travelers.');
    }
    if (assessment.passengerPricingContext?.mixedTravelerTypes) {
        negativeFactors.push('Child/infant pricing reduces direct comparability to standard adult fare benchmarks.');
    }

    const parserWarnings = (assessment.parseWarnings || []).slice(0, 4);
    const missingDataWarnings = [
        ...missingFactors,
        ...parserWarnings,
    ].filter((value, index, array) => array.indexOf(value) === index);

    let primaryReason = '';
    let actionHint = '';

    if (decision === 'BUY') {
        primaryReason = 'BUY is recommended because itinerary signals are favorable and reliability is sufficient for action.';
        actionHint = reliability.tier === 'HIGH_RELIABILITY'
            ? 'Booking now is reasonable. Keep monitoring only for major fare drops.'
            : 'Buy is acceptable, but verify any remaining missing details before final payment.';
    } else if (decision === 'WAIT') {
        primaryReason = 'WAIT is recommended because there are mixed signals and buying now is not clearly safer yet.';
        actionHint = 'Wait for better price/context clarity, then rescore with complete itinerary details.';
    } else {
        primaryReason = 'WATCH is recommended because uncertainty is still too high for a strong action.';
        actionHint = 'Add full segment times, baggage allowance, and confirmed price to improve confidence.';
    }

    const supportingReasons = [
        `Reliability tier: ${reliability.label}. ${reliability.explanation}`,
        ...positiveFactors.slice(0, 2),
        ...negativeFactors.slice(0, 2),
    ].filter(Boolean);

    return {
        primaryReason,
        supportingReasons,
        missingDataWarnings,
        actionHint,
        positiveFactors,
        negativeFactors,
        missingFactors,
    };
};

const describeRiskLevel = (warningSignals: WarningSignals, derived: DerivedStructureMetrics): 'LOW' | 'MODERATE' | 'HIGH' => {
    const riskScore =
        (warningSignals.routeMismatch * 2)
        + (warningSignals.unrealisticLayover * 2)
        + (warningSignals.chronologyIssues * 2)
        + (warningSignals.partialExtraction * 2)
        + (derived.connectionFeasibility === 'RISKY' ? 3 : derived.connectionFeasibility === 'TIGHT' ? 1 : 0);
    if (riskScore >= 6) return 'HIGH';
    if (riskScore >= 3) return 'MODERATE';
    return 'LOW';
};

const buildPremiumReport = (params: {
    finalDecision: ManualDecision;
    scoreTrust: ScoreTrustContract;
    derived: DerivedStructureMetrics;
    unifiedFlight: any;
    extractedSegments: any[];
    assessment: InputAssessment;
    recommendationExplanation: RecommendationExplanation;
    passengerPricingContext?: PassengerPricingContext;
}): PremiumReport => {
    const {
        finalDecision,
        scoreTrust,
        derived,
        unifiedFlight,
        extractedSegments,
        assessment,
        recommendationExplanation,
        passengerPricingContext,
    } = params;

    const carriers = Array.from(new Set((extractedSegments || []).map((segment) => segment.marketedAirline || segment.airline).filter(Boolean)));
    const aircraft = Array.from(new Set((extractedSegments || []).map((segment) => segment.aircraft).filter(Boolean)));
    const airports = Array.from(new Set((extractedSegments || []).flatMap((segment) => [segment.from, segment.to]).filter(Boolean)));
    const totalTravelers = passengerPricingContext?.totalTravelers ?? 1;
    const marketData = scoreTrust.dataSourceDisclosure.marketData;
    const riskLevel = describeRiskLevel(
        {
            totalWarnings: assessment.parseWarnings?.length || 0,
            missingBaggage: 0,
            missingPrice: assessment.priceMissing ? 1 : 0,
            missingSegmentTimes: (assessment.parseWarnings || []).filter((warning) => /missing segment times|missing times/i.test(warning)).length,
            routeMismatch: (assessment.parseWarnings || []).filter((warning) => /route mismatch/i.test(warning)).length,
            unrealisticLayover: (assessment.parseWarnings || []).filter((warning) => /unrealistic layover|negative layover/i.test(warning)).length,
            chronologyIssues: (assessment.parseWarnings || []).filter((warning) => /chronology|negative layover/i.test(warning)).length,
            partialExtraction: (assessment.parseWarnings || []).filter((warning) => /inferred|fallback|placeholder/i.test(warning)).length,
            severityPenalty: 0,
        },
        derived,
    );

    const overnightSegments = (extractedSegments || []).filter((segment) => {
        const dep = Date.parse(segment.departureDateTime || '');
        const arr = Date.parse(segment.arrivalDateTime || '');
        if (!Number.isFinite(dep) || !Number.isFinite(arr)) return false;
        const depHour = new Date(dep).getUTCHours();
        const arrHour = new Date(arr).getUTCHours();
        return depHour <= 5 || depHour >= 22 || arrHour <= 5 || arrHour >= 22;
    }).length;

    const executiveSummaryLabel = scoreTrust.reliabilityTier === 'HIGH_RELIABILITY'
        ? 'Strong itinerary with reliable structure'
        : scoreTrust.reliabilityTier === 'MODERATE_RELIABILITY'
            ? 'Moderate-value itinerary with limited certainty'
            : scoreTrust.reliabilityTier === 'LIMITED_RELIABILITY'
                ? 'Limited-reliability itinerary requiring caution'
                : 'Preliminary itinerary assessment due to missing verification context';

    const keyRisks = [
        ...scoreTrust.whyReliabilityIsLimited,
        ...(recommendationExplanation.negativeFactors || []),
    ].filter((value, index, array) => value && array.indexOf(value) === index).slice(0, 5);

    const improvements = [
        derived.connectionFeasibility !== 'GOOD' ? 'Target safer connection windows at major hubs.' : '',
        scoreTrust.dataSourceDisclosure.marketData !== 'LIVE_PROVIDER_DATA' ? 'Validate fare with a live provider quote before payment.' : '',
        scoreTrust.dataSourceDisclosure.baggageInput !== 'USER_PROVIDED_INPUT' && scoreTrust.dataSourceDisclosure.baggageInput !== 'PARSED_TEXT'
            ? 'Confirm baggage allowance directly from fare rules.'
            : '',
        carriers.length > 1 ? 'Prefer fewer carrier transitions to reduce disruption propagation risk.' : '',
        overnightSegments > 0 ? 'Reduce overnight segments to improve sleep continuity and recovery.' : '',
    ].filter(Boolean).slice(0, 5);

    return {
        executiveSummary: {
            title: 'Executive Summary',
            summary: `${executiveSummaryLabel}. Recommendation: ${finalDecision}. Reliability: ${scoreTrust.reliabilityLabel}.`,
            bullets: [
                `Trip type: ${derived.tripType === 'ROUND_TRIP' ? 'Round-trip' : 'One-way'}.`,
                `Traveler count: ${totalTravelers}.`,
                `Journey structure: ${derived.totalSegments} segment(s), ${derived.connectionCount} connection(s).`,
            ],
        },
        tripOverview: {
            title: 'Trip Overview',
            summary: `Route covers ${airports.join(' -> ')} with ${carriers.length || 1} operating carrier pattern(s).`,
            bullets: [
                `Airlines: ${carriers.length > 0 ? carriers.join(', ') : unifiedFlight.airline || 'Unknown airline'}.`,
                `Aircraft: ${aircraft.length > 0 ? aircraft.join(', ') : 'Not specified in source itinerary'}.`,
                `Duration: ${derived.totalDurationMinutes} min total, layovers ${derived.totalLayoverMinutes} min.`,
                `Baggage: ${assessment.baggageSource.replace(/_/g, ' ')}.`,
            ],
        },
        recommendationSummary: {
            title: 'Recommendation Summary',
            summary: recommendationExplanation.primaryReason,
            bullets: [
                `Strongest positive: ${recommendationExplanation.positiveFactors[0] || 'No dominant positive signal.'}`,
                `Strongest negative: ${recommendationExplanation.negativeFactors[0] || 'No dominant negative signal.'}`,
                `Biggest uncertainty: ${scoreTrust.whyReliabilityIsLimited[0] || 'No major unresolved uncertainty was detected.'}`,
            ],
        },
        reliabilityAndVerification: {
            title: 'Reliability & Verification',
            summary: `${scoreTrust.reliabilityLabel}. ${scoreTrust.reliabilityExplanation}`,
            bullets: [
                `Verified: ${scoreTrust.verificationSummary.verified.length > 0 ? scoreTrust.verificationSummary.verified.join('; ') : 'No high-certainty verified block detected'}.`,
                `User provided: ${scoreTrust.dataSourceDisclosure.priceInput === 'USER_PROVIDED_INPUT' || scoreTrust.dataSourceDisclosure.baggageInput === 'USER_PROVIDED_INPUT' ? 'Present' : 'Not dominant in current assessment'}.`,
                `Inferred: ${scoreTrust.verificationSummary.inferred.length > 0 ? scoreTrust.verificationSummary.inferred.join('; ') : 'None detected'}.`,
                `Unavailable/uncertain: ${scoreTrust.verificationSummary.uncertain.length > 0 ? scoreTrust.verificationSummary.uncertain.join('; ') : 'No major unavailable field flagged'}.`,
            ],
        },
        routeAndConnectionAnalysis: {
            title: 'Route & Connection Analysis',
            summary: `Connection feasibility is ${derived.connectionFeasibility}; route realism is ${derived.routeRealism}.`,
            bullets: [
                `Outbound connections: ${derived.outboundConnectionCount}; inbound connections: ${derived.inboundConnectionCount}.`,
                `Layover profile: outbound ${derived.outboundLayoverMinutes} min, inbound ${derived.inboundLayoverMinutes} min.`,
                `Self-transfer risk: ${assessment.selfTransferRisk}.`,
                `Operational continuity: ${assessment.airlineReliabilityMix === 'SINGLE_CARRIER' ? 'Higher continuity from single-carrier flow.' : 'Mixed-carrier flow may increase handoff risk.'}`,
            ],
        },
        airlineAndAircraftAnalysis: {
            title: 'Airline & Aircraft Analysis',
            summary: carriers.length > 1
                ? 'Mixed-carrier operation introduces coordination and re-protection complexity.'
                : 'Single-carrier pattern supports more consistent operational handling.',
            bullets: [
                `Carrier mix: ${assessment.airlineReliabilityMix}.`,
                `Aircraft detail coverage: ${aircraft.length > 0 ? 'Available from itinerary text.' : 'Limited; aircraft comfort cannot be deeply verified.'}`,
                `Long-haul suitability view: ${derived.totalDurationMinutes > 900 ? 'Long-haul itinerary; transfer quality becomes critical.' : 'Shorter total travel duration profile.'}`,
            ],
        },
        baggageAndFareConditions: {
            title: 'Baggage & Fare Conditions',
            summary: `Baggage certainty is ${scoreTrust.dataSourceDisclosure.baggageInput}; fare context source is ${scoreTrust.dataSourceDisclosure.priceInput}.`,
            bullets: [
                `Baggage source: ${scoreTrust.dataSourceDisclosure.baggageInput}.`,
                `Refundability signal: ${typeof unifiedFlight.policies?.refundable === 'boolean' ? (unifiedFlight.policies.refundable ? 'Refundable indicated' : 'Non-refundable indicated') : 'Not explicitly provided'}.`,
                `Traveler pricing complexity: ${passengerPricingContext?.mixedTravelerTypes ? 'Mixed traveler types reduce direct benchmark comparability.' : 'Standard traveler profile.'}`,
            ],
        },
        riskAndDisruptionExposure: {
            title: 'Risk & Disruption Exposure',
            summary: `Overall disruption exposure: ${riskLevel}.`,
            bullets: [
                `Tight/fragile transfer signals: ${derived.connectionFeasibility}.`,
                `Carrier fragmentation risk: ${assessment.airlineReliabilityMix === 'MIXED' ? 'MODERATE' : 'LOW'}.`,
                `Propagation sensitivity: ${carriers.length > 1 ? 'Delays may cascade across carriers.' : 'Lower propagation across same-carrier chain.'}`,
                `Live operational feed: ${marketData === 'LIVE_PROVIDER_DATA' ? 'Available' : 'Unavailable in this assessment context'}.`,
            ],
        },
        comfortAndFatigueAnalysis: {
            title: 'Comfort & Fatigue Analysis',
            summary: `Total journey burden is ${derived.totalDurationMinutes} minutes with ${overnightSegments} overnight-sensitive segment(s).`,
            bullets: [
                `Seated travel burden: approximately ${derived.totalDurationMinutes - derived.totalLayoverMinutes} minutes in-segment time.`,
                `Overnight burden: ${overnightSegments > 0 ? `${overnightSegments} segment(s) cross late-night windows.` : 'No major overnight segment detected.'}`,
                `Transfer exhaustion profile: ${derived.totalLayoverMinutes > 360 ? 'High layover burden may reduce comfort.' : 'Moderate transfer burden.'}`,
                `Family complexity: ${totalTravelers > 1 ? 'Multi-traveler planning may increase fatigue coordination needs.' : 'Single-traveler complexity baseline.'}`,
            ],
        },
        pricingContext: {
            title: 'Pricing Context',
            summary: marketData === 'LIVE_PROVIDER_DATA'
                ? 'Pricing context uses live provider benchmark data.'
                : marketData === 'HISTORICAL_ESTIMATE'
                    ? 'Pricing context is estimated from historical baseline, not live market data.'
                    : 'Pricing context is internally estimated due to missing direct fare anchors.',
            bullets: [
                `Total fare input: ${unifiedFlight.price} ${unifiedFlight.currency}.`,
                `Benchmark source: ${marketData}.`,
                `Traveler pricing logic: ${passengerPricingContext ? `Adult-equivalent comparison uses ${passengerPricingContext.comparablePerTravelerPrice.toFixed(2)} ${unifiedFlight.currency}.` : 'No traveler-adjusted benchmark available.'}`,
                `${marketData !== 'LIVE_PROVIDER_DATA' ? 'This section should be interpreted as estimated context, not live quote certainty.' : 'Live benchmark context is available for this assessment.'}`,
            ],
        },
        keyRisks: {
            title: 'Key Risks',
            summary: keyRisks.length > 0 ? 'Top risk drivers detected for this itinerary:' : 'No dominant risk driver exceeded reporting threshold.',
            bullets: keyRisks.length > 0 ? keyRisks : ['No major risk beyond baseline itinerary variability.'],
        },
        whatWouldImproveThisItinerary: {
            title: 'What Would Improve This Itinerary',
            summary: 'Practical changes that would materially improve confidence and execution quality.',
            bullets: improvements.length > 0 ? improvements : ['Current itinerary is already structurally strong under available data.'],
        },
        finalRecommendation: {
            title: 'Final Recommendation',
            summary: `${finalDecision} with ${scoreTrust.reliabilityLabel}. ${scoreTrust.decisionReason}`,
            bullets: [
                `Advisor conclusion: ${finalDecision} is aligned with current reliability and risk profile.`,
                `Data honesty note: ${scoreTrust.dataSourceDisclosure.marketData} market context; unresolved uncertainty is explicitly listed above.`,
            ],
        },
    };
};

export async function POST(request: NextRequest) {
    try {
        const payload = itineraryScoreInputSchema.parse((await request.json()) as ItineraryScoreInput);
        const { unifiedFlight, assessment, derived, extractedSegments } = itineraryInputToUnifiedFlight(payload);
        const passengerPricingContext = assessment.passengerPricingContext;
        const scoringComparablePrice = passengerPricingContext && passengerPricingContext.totalTravelers > 1
            ? passengerPricingContext.comparablePerTravelerPrice
            : unifiedFlight.price;
        const scoringFlight = scoringComparablePrice !== unifiedFlight.price
            ? {
                ...unifiedFlight,
                price: scoringComparablePrice,
            }
            : unifiedFlight;

        // Record parser metrics
        try {
            recordParserMetric({
                mode: payload.mode,
                success: !assessment.parseWarnings || assessment.parseWarnings.length === 0,
                completenessScore: assessment.completenessScore,
                realismScore: assessment.realismScore,
                baggageConfidence: assessment.baggageConfidenceScore,
                warnings: assessment.parseWarnings,
                errorMessage: undefined,
                timestamp: new Date(),
            });
        } catch (err) {
            console.debug('[ParserMetrics] Error recording metric:', err);
        }

        // For round trips, unifiedFlight.to === unifiedFlight.from (same origin),
        // which collapses great-circle distance to 0 and breaks duration scoring.
        // Use the last outbound segment's destination as the scoring reference point.
        const scoringOrigin = unifiedFlight.from;
        const scoringDestination: string = (() => {
            if (derived.tripType !== 'ROUND_TRIP') return unifiedFlight.to;
            const outbound = extractedSegments.filter((s) => s.tripDirection !== 'INBOUND');
            return outbound.length > 0 ? outbound[outbound.length - 1].to : unifiedFlight.to;
        })();

        // For round trips score only the outbound leg duration so the expected-route
        // comparison is apples-to-apples (one-way expected vs one-way actual).
        const scoringDuration = derived.tripType === 'ROUND_TRIP'
            ? derived.outboundDurationMinutes
            : unifiedFlight.duration;

        const scoringFlightForEngine = {
            ...scoringFlight,
            duration: scoringDuration,
        };

        console.debug(
            `[SCORING_INPUT] origin=${scoringOrigin} dest=${scoringDestination} ` +
            `price=${scoringFlight.price} ${unifiedFlight.currency} cabin=${unifiedFlight.cabinClass} ` +
            `duration=${scoringDuration}min tripType=${derived.tripType}`
        );

        const [scoredComparableFlight] = await applyAdvancedFlightScoring([scoringFlightForEngine], {
            origin: scoringOrigin,
            destination: scoringDestination,
            departureDate: scoringFlight.departureTime,
            useHistoricalMedian: true,
            disablePriceScoring: assessment.priceMissing,
        });

        const scoredFlight = scoredComparableFlight
            ? {
                ...unifiedFlight,
                score: scoredComparableFlight.score,
            }
            : null;

        if (!scoredFlight) {
            return NextResponse.json({ error: 'Unable to score itinerary input' }, { status: 500 });
        }

        const [enrichedFlight] = applyRouteIntelligenceFeatures(
            [scoredFlight],
            null,
            unifiedFlight.departureTime,
        );

        if (!enrichedFlight) {
            return NextResponse.json({ error: 'Unable to enrich scored itinerary' }, { status: 500 });
        }

        const initialDecision = normalizeDecision(enrichedFlight.score.buyWaitSignal?.action);
        const baseConfidence = enrichedFlight.score.decisionConfidence ?? enrichedFlight.score.confidence ?? 60;
        const effectiveMode = payload.mode === 'paste' ? assessment.mode : payload.mode;
        const warningSignals = parseWarningSignals(assessment);
        const adjustedConfidence = computeModeConfidence(effectiveMode, baseConfidence, assessment, derived, warningSignals);
        const presentedConfidence = Math.round(clamp(adjustedConfidence, 0, 100) / 5) * 5;
        const decision = buildModeDecision(effectiveMode, initialDecision, adjustedConfidence, derived, warningSignals);
        const reliability = computeDataReliability(assessment, warningSignals);

        const mergedRiskFlags = [
            ...(enrichedFlight.score.riskFlags || []),
            ...assessment.riskFlags,
        ].filter((value, index, array) => array.indexOf(value) === index);
        const filteredRiskFlags = mergedRiskFlags.filter((flag) => {
            if (flag !== 'Multiple connections') return true;
            if (derived.tripType !== 'ROUND_TRIP') return true;
            return !(derived.outboundConnectionCount <= 1 && derived.inboundConnectionCount <= 1);
        });

        const mergedComfortNotes = [
            ...(enrichedFlight.score.comfortNotes || []),
            ...assessment.comfortNotes,
        ].filter((value, index, array) => array.indexOf(value) === index);

        const explanation = buildModeExplanation(
            effectiveMode,
            enrichedFlight.score.decisionReason || enrichedFlight.score.explanation || '',
            adjustedConfidence,
            assessment,
            derived,
        );
        const recommendationExplanation = buildRecommendationExplanation(
            decision,
            reliability,
            assessment,
            derived,
            warningSignals,
        );

        const buyWaitAction: 'BUY' | 'WAIT' | 'MONITOR' = decision === 'BUY'
            ? 'BUY'
            : decision === 'WAIT'
                ? 'WAIT'
                : 'MONITOR';

        const provisionalFlight = {
            ...enrichedFlight,
            score: {
                ...enrichedFlight.score,
                confidence: presentedConfidence,
                decisionConfidence: presentedConfidence,
                decisionReason: explanation,
                riskFlags: filteredRiskFlags,
                comfortNotes: mergedComfortNotes,
                buyWaitSignal: {
                    action: buyWaitAction,
                    label: payload.mode === 'quick'
                        ? 'Rough signal only - add detailed itinerary for high-accuracy scoring'
                        : decision === 'WATCH'
                            ? buildWatchLabel(presentedConfidence, warningSignals, assessment)
                            : enrichedFlight.score.buyWaitSignal?.label || 'Action signal available',
                    urgencyDays: enrichedFlight.score.buyWaitSignal?.urgencyDays,
                    variant: enrichedFlight.score.buyWaitSignal?.variant,
                },
            },
        };

        const parseAuditBase = buildParseAudit(unifiedFlight);
        const parseAuditFromParser: ParseAudit = {
            ...parseAuditBase,
            warnings: [
                ...parseAuditBase.warnings,
                ...(assessment.parseWarnings || []),
            ].filter((value, index, array) => array.indexOf(value) === index),
            hardErrors: parseAuditBase.hardErrors,
            completenessScore: Math.round(Math.min(parseAuditBase.completenessScore, Math.max(0, assessment.completenessScore * 100))),
        };

        const selfChecked = runSelfCheckLayer(provisionalFlight, parseAuditFromParser);
        let finalDecision: ManualDecision = selfChecked.flight.score.decisionRecommendation === 'BUY_NOW'
            ? 'BUY'
            : selfChecked.flight.score.decisionRecommendation === 'WAIT'
                ? 'WAIT'
                : 'WATCH';

        if (reliability.score < 50 && finalDecision === 'BUY') {
            finalDecision = 'WAIT';
        }
        if (reliability.score < 40 && finalDecision !== 'WATCH') {
            finalDecision = 'WATCH';
        }

        // Rebuild recommendation explanation using the post-self-check decision so all
        // fields are consistent: decision, recommendationExplanation, and trackingPayload.
        const finalRecommendationExplanation = buildRecommendationExplanation(
            finalDecision,
            reliability,
            assessment,
            derived,
            warningSignals,
        );

        const inputSource = payload.mode === 'paste' && payload.source === 'manual_override'
            ? 'MANUAL_SEGMENTS'
            : 'PARSED_TEXT';

        const finalBuyWaitAction: 'BUY' | 'WAIT' | 'MONITOR' = finalDecision === 'BUY'
            ? 'BUY'
            : finalDecision === 'WAIT'
                ? 'WAIT'
                : 'MONITOR';

        const trustAdjustedComposite = reliability.score < 50
            ? Number(Math.min(selfChecked.flight.score.composite, 8.4).toFixed(1))
            : selfChecked.flight.score.composite;

        const enforcedFlight = {
            ...selfChecked.flight,
            score: {
                ...selfChecked.flight.score,
                composite: trustAdjustedComposite,
                buyWaitSignal: {
                    ...(selfChecked.flight.score.buyWaitSignal || {}),
                    action: finalBuyWaitAction,
                    label: finalDecision === 'WATCH'
                        ? buildWatchLabel(presentedConfidence, warningSignals, assessment)
                        : selfChecked.flight.score.buyWaitSignal?.label || 'Action signal available',
                },
            },
        };

        const breakdown = buildScoreBreakdown(enforcedFlight, derived, assessment, passengerPricingContext);
        const penalties = buildPenalties(assessment, warningSignals);
        const missingDataImpact = buildMissingDataImpact(assessment, warningSignals);
        const marketDataSource = toMarketDataSource(assessment);
        const priceInputSource = toPriceInputSource(assessment);
        const baggageInputSource = toBaggageInputSource(assessment);
        const verificationSummary = {
            verified: [
                derived.routeRealism === 'REALISTIC' ? 'Itinerary route structure' : '',
                assessment.priceSource === 'USER_PROVIDED' ? 'Price input provided by user' : '',
                assessment.baggageSource === 'USER_PROVIDED_BAGGAGE' ? 'Baggage provided by user' : '',
                assessment.baggageSource === 'PARSED_BAGGAGE' ? 'Baggage parsed from explicit fare allowance' : '',
            ].filter(Boolean),
            inferred: [
                assessment.baggageSource === 'INFERRED_BAGGAGE' ? 'Baggage inferred from passenger text' : '',
                warningSignals.missingSegmentTimes > 0 ? 'Some segment times inferred' : '',
                warningSignals.partialExtraction > 0 ? 'Partial itinerary extraction required inference' : '',
            ].filter(Boolean),
            estimated: [
                !assessment.priceMissing && !assessment.livePriceBenchmarkAvailable ? 'Price comparison uses estimated benchmark' : '',
                marketDataSource !== 'LIVE_PROVIDER_DATA' ? `Market context source: ${marketDataSource}` : '',
            ].filter(Boolean),
            uncertain: [
                assessment.priceMissing ? 'Price is missing' : '',
                assessment.baggageSource === 'UNKNOWN_BAGGAGE' ? 'Baggage allowance unavailable' : '',
                warningSignals.routeMismatch > 0 ? 'Route consistency warnings detected' : '',
                warningSignals.unrealisticLayover > 0 ? 'Layover/chronology warnings detected' : '',
            ].filter(Boolean),
        };

        const scoreTrust: ScoreTrustContract = {
            finalScore: enforcedFlight.score.composite,
            scoreQualityLabel: computeScoreQualityLabel(enforcedFlight.score.composite, reliability.tier),
            reliabilityTier: reliability.tier,
            reliabilityLabel: reliability.label,
            dataReliabilityLabel: reliability.band,
            dataReliabilityScore: reliability.score,
            decision: finalDecision,
            decisionReason: enforcedFlight.score.decisionReason || explanation,
            reliabilityExplanation: reliability.explanation,
            verificationSummary,
            dataSourceDisclosure: {
                marketData: marketDataSource,
                priceInput: priceInputSource,
                baggageInput: baggageInputSource,
            },
            scoreBreakdown: breakdown,
            penalties,
            missingDataImpact,
            whyReliabilityIsLimited: [
                ...missingDataImpact,
                ...verificationSummary.uncertain,
            ].filter((value, index, array) => array.indexOf(value) === index),
        };

        const premiumReport = buildPremiumReport({
            finalDecision,
            scoreTrust,
            derived,
            unifiedFlight,
            extractedSegments,
            assessment,
            recommendationExplanation: finalRecommendationExplanation,
            passengerPricingContext,
        });

        return NextResponse.json({
            ...enforcedFlight,
            inputSource,
            selfCheckWarnings: selfChecked.userWarnings,
            decision: finalDecision,
            insights: {
                decision: finalDecision,
                confidence: enforcedFlight.score.confidence,
                riskFlags: enforcedFlight.score.riskFlags,
                comfortNotes: enforcedFlight.score.comfortNotes,
                explanation: enforcedFlight.score.decisionReason || explanation,
            },
            recommendationExplanation: finalRecommendationExplanation,
            scoreBreakdown: breakdown,
            scoreTrust,
            trackingPayload: {
                trackingType: 'ITINERARY_CANDIDATE',
                trip: {
                    origin: unifiedFlight.from,
                    destination: unifiedFlight.to,
                    departureDate: unifiedFlight.departureTime,
                    price: unifiedFlight.price,
                    currency: unifiedFlight.currency,
                    cabin: unifiedFlight.cabinClass,
                    baggage: {
                        checkedBaggageKg: unifiedFlight.baggage?.checked?.kg ?? null,
                        cabinBaggageKg: unifiedFlight.baggage?.cabin?.kg ?? null,
                        included: unifiedFlight.baggage?.included ?? null,
                    },
                    refundable: unifiedFlight.policies?.refundable ?? null,
                    totalDurationMinutes: unifiedFlight.duration,
                    stops: unifiedFlight.stops,
                },
                scoreSnapshot: {
                    recommendation: finalDecision,
                    confidence: presentedConfidence,
                    primaryReason: `[${scoreTrust.reliabilityLabel}] ${finalRecommendationExplanation.primaryReason}`,
                    positiveFactor: finalRecommendationExplanation.positiveFactors[0] ?? null,
                    negativeFactor: finalRecommendationExplanation.negativeFactors[0] ?? null,
                    missingFactor: scoreTrust.whyReliabilityIsLimited[0] ?? finalRecommendationExplanation.missingFactors[0] ?? null,
                    actionHint: `${finalRecommendationExplanation.actionHint} Data source: ${marketDataSource}.`,
                    dataSourceType: 'USER_PASTED_ITINERARY',
                    realTimeDataAvailable: false,
                },
                segments: unifiedFlight.segments.map((segment) => ({
                    from: segment.from,
                    to: segment.to,
                    departureDateTime: segment.departureTime,
                    arrivalDateTime: segment.arrivalTime,
                    airline: segment.marketingCarrier || segment.carrier,
                    flightNumber: segment.flightNumber,
                    aircraft: segment.aircraft,
                })),
            },
            scoringMode: payload.mode,
            derivedMetrics: derived,
            extractedSegments,
            parseWarnings: assessment.parseWarnings || [],
            parseConfidence: assessment.parseConfidence,
            passengerPricingContext,
            _selfCheck: selfChecked.debug,
            confidenceInputs: {
                baseConfidence,
                adjustedConfidence,
                presentedConfidence,
                mode: effectiveMode,
                completenessScore: assessment.completenessScore,
                realismScore: assessment.realismScore,
                baggageConfidenceScore: assessment.baggageConfidenceScore,
                parseConfidence: assessment.parseConfidence,
                priceContextAvailable: assessment.priceContextAvailable,
                livePriceBenchmarkAvailable: assessment.livePriceBenchmarkAvailable,
                connectionFeasibility: derived.connectionFeasibility,
                routeRealism: derived.routeRealism,
                warningSignals,
                passengerPricingContext,
                priceSource: assessment.priceSource,
                baggageSource: assessment.baggageSource,
                dataReliabilityScore: reliability.score,
                dataReliabilityLabel: reliability.band,
                reliabilityTier: reliability.tier,
                marketDataSource,
            },
            reportSummary: {
                headline: `${scoreTrust.reliabilityLabel} - ${scoreTrust.scoreQualityLabel}`,
                reliabilityExplanation: scoreTrust.reliabilityExplanation,
                verificationSummary: scoreTrust.verificationSummary,
                dataSourceDisclosure: scoreTrust.dataSourceDisclosure,
                whyReliabilityIsLimited: scoreTrust.whyReliabilityIsLimited,
            },
            premiumReport,
            needsReview: assessment.promptForDetails || (assessment.parseWarnings?.length || 0) > 0,
            accuracyHint: payload.mode === 'quick'
                ? 'Switch to Detailed Itinerary Score to improve reliability and verification coverage.'
                : assessment.promptForDetails
                    ? 'Parsing was incomplete. Review and edit extracted segments for better scoring accuracy.'
                : undefined,
        });
    } catch (error) {
        if (error instanceof ZodError) {
            return NextResponse.json(
                {
                    error: 'Invalid itinerary scoring payload',
                    issues: error.issues.map((issue) => ({
                        path: issue.path.join('.'),
                        message: issue.message,
                    })),
                },
                { status: 400 },
            );
        }

        console.error('[SCORE_FLIGHT] Failed to score itinerary:', error);
        return NextResponse.json({ error: 'Failed to score itinerary' }, { status: 500 });
    }
}

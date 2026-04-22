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

type ManualDecision = 'BUY' | 'WAIT' | 'WATCH';

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

const normalizeDecision = (action?: string): ManualDecision => {
    if (action === 'BUY') return 'BUY';
    if (action === 'WAIT') return 'WAIT';
    return 'WATCH';
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const parseWarningSignals = (assessment: InputAssessment): WarningSignals => {
    const warnings = assessment.parseWarnings || [];
    const hasMatch = (warning: string, regex: RegExp): boolean => regex.test(warning);

    const missingBaggage = warnings.filter((warning) => hasMatch(warning, /missing baggage|baggage/i)).length;
    const missingPrice = warnings.filter((warning) => hasMatch(warning, /price missing|price not detected/i)).length;
    const missingSegmentTimes = warnings.filter((warning) => hasMatch(warning, /missing segment times|missing times/i)).length;
    const routeMismatch = warnings.filter((warning) => hasMatch(warning, /route mismatch/i)).length;
    const unrealisticLayover = warnings.filter((warning) => hasMatch(warning, /unrealistic layover|negative layover|chronology/i)).length;
    const chronologyIssues = warnings.filter((warning) => hasMatch(warning, /chronology|negative layover/i)).length;
    const partialExtraction = warnings.filter((warning) => hasMatch(warning, /could not parse any route segment|inferred|fallback|placeholder/i)).length;

    const severityPenalty =
        (missingBaggage * 1.2)
        + (missingPrice * 2)
        + (missingSegmentTimes * 4)
        + (routeMismatch * 5)
        + (unrealisticLayover * 4)
        + (chronologyIssues * 5)
        + (partialExtraction * 2);

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
    if (signals.missingPrice > 0 && signals.missingBaggage > 0) {
        cap = Math.min(cap, 69);
    }
    if (derived.routeRealism === 'QUESTIONABLE') {
        cap = Math.min(cap, 72);
    }
    if (derived.connectionFeasibility === 'RISKY') {
        cap = Math.min(cap, 74);
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
    const confidenceCap = computeConfidenceCap(mode, signals, derived);

    if (mode === 'quick') {
        const quickRaw =
            40
            + (assessment.completenessScore * 14)
            + (assessment.realismScore * 6)
            + (parseConfidence * 10)
            - warningPenalty;
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

    const blended = ((detailedConfidenceRaw - realismPenalty - baggagePenalty - feasibilityPenalty - warningPenalty) * 0.65)
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

    if (!assessment.priceContextAvailable) {
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

export async function POST(request: NextRequest) {
    try {
        const payload = itineraryScoreInputSchema.parse((await request.json()) as ItineraryScoreInput);
        const { unifiedFlight, assessment, derived, extractedSegments } = itineraryInputToUnifiedFlight(payload);

        const [scoredFlight] = await applyAdvancedFlightScoring([unifiedFlight], {
            origin: unifiedFlight.from,
            destination: unifiedFlight.to,
            departureDate: unifiedFlight.departureTime,
        });

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
        const decision = buildModeDecision(effectiveMode, initialDecision, adjustedConfidence, derived, warningSignals);

        const mergedRiskFlags = [
            ...(enrichedFlight.score.riskFlags || []),
            ...assessment.riskFlags,
        ].filter((value, index, array) => array.indexOf(value) === index);

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

        return NextResponse.json({
            ...enrichedFlight,
            score: {
                ...enrichedFlight.score,
                confidence: adjustedConfidence,
                decisionConfidence: adjustedConfidence,
                decisionReason: explanation,
                riskFlags: mergedRiskFlags,
                comfortNotes: mergedComfortNotes,
                buyWaitSignal: {
                    action: decision === 'BUY' ? 'BUY' : decision === 'WAIT' ? 'WAIT' : 'MONITOR',
                    label: payload.mode === 'quick'
                        ? 'Rough signal only - add detailed itinerary for high-accuracy scoring'
                        : decision === 'WATCH'
                            ? 'Watch closely - itinerary context still limited'
                            : enrichedFlight.score.buyWaitSignal?.label || 'Action signal available',
                    urgencyDays: enrichedFlight.score.buyWaitSignal?.urgencyDays,
                    variant: enrichedFlight.score.buyWaitSignal?.variant,
                },
            },
            decision,
            insights: {
                decision,
                confidence: adjustedConfidence,
                riskFlags: mergedRiskFlags,
                comfortNotes: mergedComfortNotes,
                explanation,
            },
            scoringMode: payload.mode,
            derivedMetrics: derived,
            extractedSegments,
            parseWarnings: assessment.parseWarnings || [],
            parseConfidence: assessment.parseConfidence,
            confidenceInputs: {
                baseConfidence,
                mode: effectiveMode,
                completenessScore: assessment.completenessScore,
                realismScore: assessment.realismScore,
                baggageConfidenceScore: assessment.baggageConfidenceScore,
                parseConfidence: assessment.parseConfidence,
                priceContextAvailable: assessment.priceContextAvailable,
                connectionFeasibility: derived.connectionFeasibility,
                routeRealism: derived.routeRealism,
                warningSignals,
            },
            needsReview: assessment.promptForDetails || (assessment.parseWarnings?.length || 0) > 0,
            accuracyHint: payload.mode === 'quick'
                ? 'Switch to Detailed Itinerary Score to improve realism and confidence.'
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

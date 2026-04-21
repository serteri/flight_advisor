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

const normalizeDecision = (action?: string): ManualDecision => {
    if (action === 'BUY') return 'BUY';
    if (action === 'WAIT') return 'WAIT';
    return 'WATCH';
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const computeModeConfidence = (
    mode: 'quick' | 'detailed',
    baseConfidence: number,
    assessment: InputAssessment,
    derived: DerivedStructureMetrics,
): number => {
    if (mode === 'quick') {
        const quickConfidence = 40 + Math.round(assessment.completenessScore * 14);
        return clamp(Math.min(baseConfidence, quickConfidence), 40, 58);
    }

    const detailedConfidenceRaw =
        52
        + Math.round(assessment.completenessScore * 20)
        + Math.round(assessment.realismScore * 16)
        + Math.round(assessment.baggageConfidenceScore * 8)
        - (assessment.priceContextAvailable ? 0 : 4);

    const realismPenalty = derived.routeRealism === 'QUESTIONABLE' ? 6 : 0;
    const baggagePenalty = assessment.baggageConfidenceScore < 0.7 ? 6 : 0;

    return clamp(Math.min(baseConfidence, detailedConfidenceRaw - realismPenalty - baggagePenalty), 52, 88);
};

const buildModeDecision = (
    mode: 'quick' | 'detailed',
    initialDecision: ManualDecision,
    confidence: number,
    derived: DerivedStructureMetrics,
): ManualDecision => {
    if (mode === 'quick') return 'WATCH';
    if (derived.routeRealism === 'QUESTIONABLE') return 'WATCH';
    if (confidence < 62) return 'WATCH';
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

    return [baseReason, ...notes, ...assessment.riskFlags.slice(0, 2)]
        .filter(Boolean)
        .join(' ')
        .trim();
};

export async function POST(request: NextRequest) {
    try {
        const payload = itineraryScoreInputSchema.parse((await request.json()) as ItineraryScoreInput);
        const { unifiedFlight, assessment, derived } = itineraryInputToUnifiedFlight(payload);

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
        const adjustedConfidence = computeModeConfidence(payload.mode, baseConfidence, assessment, derived);
        const decision = buildModeDecision(payload.mode, initialDecision, adjustedConfidence, derived);

        const mergedRiskFlags = [
            ...(enrichedFlight.score.riskFlags || []),
            ...assessment.riskFlags,
        ].filter((value, index, array) => array.indexOf(value) === index);

        const mergedComfortNotes = [
            ...(enrichedFlight.score.comfortNotes || []),
            ...assessment.comfortNotes,
        ].filter((value, index, array) => array.indexOf(value) === index);

        const explanation = buildModeExplanation(
            payload.mode,
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
            accuracyHint: payload.mode === 'quick'
                ? 'Switch to Detailed Itinerary Score to improve realism and confidence.'
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

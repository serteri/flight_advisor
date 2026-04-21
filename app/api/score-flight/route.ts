import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { manualFlightInputSchema, manualFlightToUnifiedFlight, type ManualFlightInput, isUnrealisticLongHaulDuration } from '@/lib/manualFlightToUnifiedFlight';
import { applyAdvancedFlightScoring, applyRouteIntelligenceFeatures } from '@/lib/scoring/advancedFlightScoring';
import type { ScoredFlight } from '@/types/unifiedFlight';

type ManualDecision = 'BUY' | 'WAIT' | 'WATCH';

const normalizeDecision = (action?: string): ManualDecision => {
    if (action === 'BUY') return 'BUY';
    if (action === 'WAIT') return 'WAIT';
    return 'WATCH';
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const evaluateManualInputQuality = (payload: ManualFlightInput, scoredFlight: ScoredFlight) => {
    const penalties: string[] = [];
    let dataPoints = 0;
    let providedPoints = 0;

    const check = (condition: boolean, penaltyMessage: string) => {
        dataPoints += 1;
        if (condition) {
            providedPoints += 1;
        } else {
            penalties.push(penaltyMessage);
        }
    };

    check(Boolean(payload.arrivalDateTime), 'Arrival time missing: duration confidence reduced.');
    check(typeof payload.totalDurationMinutes === 'number', 'Total duration missing: route realism confidence reduced.');

    const stops = payload.stops ?? scoredFlight.stops ?? 0;
    if (stops > 0) {
        check(typeof payload.layoverDurationMinutes === 'number', 'Layover duration missing for connecting itinerary.');
        check(Boolean(payload.layoverAirport || payload.layoverAirports?.length), 'Layover airport missing for connecting itinerary.');
    }

    check(Boolean(payload.checkedBaggageKg ?? payload.baggageKg), 'Checked baggage weight missing.');
    check(typeof payload.cabinBaggageKg === 'number', 'Cabin baggage weight missing.');
    check(Boolean(payload.aircraftType || payload.aircraft), 'Aircraft type missing.');
    check(Boolean(payload.fareFlexibility), 'Fare flexibility policy missing.');

    const hasUnrealisticLongHaulDuration = isUnrealisticLongHaulDuration(
        payload.origin,
        payload.destination,
        payload.totalDurationMinutes,
    );

    if (hasUnrealisticLongHaulDuration) {
        penalties.push('Declared duration is unrealistic for this long-haul route.');
    }

    const completenessRatio = dataPoints > 0 ? providedPoints / dataPoints : 0;
    const priceContextAvailable = Boolean(scoredFlight.score.routeIntelligence?.searchCount && scoredFlight.score.routeIntelligence.searchCount > 0);
    const baseConfidence = scoredFlight.score.decisionConfidence ?? scoredFlight.score.confidence ?? 60;

    let adjustedConfidence = Math.round(baseConfidence);
    adjustedConfidence = Math.min(adjustedConfidence, Math.round(40 + completenessRatio * 35));

    if (!payload.totalDurationMinutes && !payload.arrivalDateTime) {
        adjustedConfidence = Math.min(adjustedConfidence, 55);
    }

    if (hasUnrealisticLongHaulDuration) {
        adjustedConfidence = Math.min(adjustedConfidence, 50);
        adjustedConfidence -= 8;
    }

    if (payload.baggageIncluded && !(payload.checkedBaggageKg || payload.baggageKg)) {
        penalties.push('Checked baggage was estimated from baseline allowance.');
        adjustedConfidence -= 6;
    }

    if (!priceContextAvailable) {
        penalties.push('No live route price context available for timing precision.');
        adjustedConfidence = Math.min(adjustedConfidence, 65);
        adjustedConfidence -= 5;
    }

    if (penalties.length >= 4) {
        adjustedConfidence = Math.min(adjustedConfidence, 55);
    }

    if (penalties.length >= 6) {
        adjustedConfidence = Math.min(adjustedConfidence, 48);
    }

    adjustedConfidence = clamp(Math.round(adjustedConfidence), 40, 95);

    return {
        adjustedConfidence,
        completenessRatio,
        priceContextAvailable,
        penalties,
    };
};

const buildSoftenedDecision = (
    decision: ManualDecision,
    confidence: number,
    priceContextAvailable: boolean,
): ManualDecision => {
    if (!priceContextAvailable || confidence <= 55) return 'WATCH';
    return decision;
};

export async function POST(request: NextRequest) {
    try {
        const payload = manualFlightInputSchema.parse((await request.json()) as ManualFlightInput);
        const unifiedFlight = manualFlightToUnifiedFlight(payload);

        const [scoredFlight] = await applyAdvancedFlightScoring([unifiedFlight], {
            origin: unifiedFlight.from,
            destination: unifiedFlight.to,
            departureDate: unifiedFlight.departureTime,
        });

        if (!scoredFlight) {
            return NextResponse.json({ error: 'Unable to score manual flight input' }, { status: 500 });
        }

        const [enrichedFlight] = applyRouteIntelligenceFeatures(
            [scoredFlight],
            null,
            unifiedFlight.departureTime,
        );

        if (!enrichedFlight) {
            return NextResponse.json({ error: 'Unable to enrich scored flight' }, { status: 500 });
        }

        const initialDecision = normalizeDecision(enrichedFlight.score.buyWaitSignal?.action);
        const quality = evaluateManualInputQuality(payload, enrichedFlight);
        const decision = buildSoftenedDecision(initialDecision, quality.adjustedConfidence, quality.priceContextAvailable);

        const baseReason = enrichedFlight.score.decisionReason || enrichedFlight.score.explanation || '';
        const lowConfidenceReason = quality.adjustedConfidence <= 55
            ? 'LOW CONFIDENCE: route structure is incomplete or partially inferred.'
            : '';
        const noPriceContextReason = !quality.priceContextAvailable
            ? 'INSUFFICIENT DATA: no route-level price context for high-confidence timing call.'
            : '';
        const qualityReason = [lowConfidenceReason, noPriceContextReason, ...quality.penalties.slice(0, 2)]
            .filter(Boolean)
            .join(' ')
            .trim();

        const mergedRiskFlags = [
            ...(enrichedFlight.score.riskFlags || []),
            ...quality.penalties,
        ].filter((value, index, array) => array.indexOf(value) === index);

        const explanation = [baseReason, qualityReason]
            .filter(Boolean)
            .join(' ')
            .trim();

        return NextResponse.json({
            ...enrichedFlight,
            score: {
                ...enrichedFlight.score,
                confidence: quality.adjustedConfidence,
                decisionConfidence: quality.adjustedConfidence,
                decisionReason: explanation,
                riskFlags: mergedRiskFlags,
                buyWaitSignal: {
                    action: decision === 'BUY' ? 'BUY' : decision === 'WAIT' ? 'WAIT' : 'MONITOR',
                    label: decision === 'BUY'
                        ? 'Buy signal is available'
                        : quality.adjustedConfidence <= 55
                            ? 'Low-confidence structure — monitor and refine inputs'
                            : 'Monitor price — timing confidence limited',
                    urgencyDays: enrichedFlight.score.buyWaitSignal?.urgencyDays,
                    variant: enrichedFlight.score.buyWaitSignal?.variant,
                },
            },
            decision,
            insights: {
                decision,
                confidence: quality.adjustedConfidence,
                riskFlags: mergedRiskFlags,
                comfortNotes: enrichedFlight.score.comfortNotes || [],
                explanation,
            },
        });
    } catch (error) {
        if (error instanceof ZodError) {
            return NextResponse.json(
                {
                    error: 'Invalid manual flight payload',
                    issues: error.issues.map((issue) => ({
                        path: issue.path.join('.'),
                        message: issue.message,
                    })),
                },
                { status: 400 },
            );
        }

        console.error('[SCORE_FLIGHT] Failed to score manual flight:', error);
        return NextResponse.json({ error: 'Failed to score manual flight' }, { status: 500 });
    }
}
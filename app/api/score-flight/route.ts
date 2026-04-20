import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { manualFlightInputSchema, manualFlightToUnifiedFlight, type ManualFlightInput } from '@/lib/manualFlightToUnifiedFlight';
import { applyAdvancedFlightScoring, applyRouteIntelligenceFeatures } from '@/lib/scoring/advancedFlightScoring';

type ManualDecision = 'BUY' | 'WAIT' | 'WATCH';

const normalizeDecision = (action?: string): ManualDecision => {
    if (action === 'BUY') return 'BUY';
    if (action === 'WAIT') return 'WAIT';
    return 'WATCH';
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

        const decision = normalizeDecision(enrichedFlight.score.buyWaitSignal?.action);

        return NextResponse.json({
            ...enrichedFlight,
            decision,
            insights: {
                decision,
                confidence: enrichedFlight.score.decisionConfidence ?? enrichedFlight.score.confidence,
                riskFlags: enrichedFlight.score.riskFlags || [],
                comfortNotes: enrichedFlight.score.comfortNotes || [],
                explanation: enrichedFlight.score.decisionReason || enrichedFlight.score.explanation || '',
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
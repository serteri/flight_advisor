import { NextResponse } from 'next/server';
import { applyAdvancedFlightScoring } from '@/lib/scoring/advancedFlightScoring';
import { scoreFlightV3 } from '@/lib/scoring/flightScoreEngine';
import { FlightResult } from '@/types/hybridFlight';
import { UnifiedFlight } from '@/types/unifiedFlight';
import { runSelfCheckLayer } from '@/lib/audit/selfCheckLayer';
import { auth } from '@/lib/auth';
import { withFreemiumGate } from '@/lib/freemium/gate';
import { prisma } from '@/lib/prisma';

const isUnifiedFlight = (value: unknown): value is UnifiedFlight => {
    if (!value || typeof value !== 'object') return false;

    const flight = value as Partial<UnifiedFlight>;
    return typeof flight.id === 'string'
        && typeof flight.source === 'string'
        && typeof flight.from === 'string'
        && typeof flight.to === 'string'
        && typeof flight.departureTime === 'string'
        && typeof flight.arrivalTime === 'string'
        && Array.isArray(flight.segments)
        && flight.segments.length > 0;
};

export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const user = await prisma.user.upsert({
            where: { email: session.user.email },
            create: {
                email: session.user.email,
                name: session.user.name || 'User',
            },
            update: {
                name: session.user.name || undefined,
            },
            select: { id: true },
        });

        // 1. Auth Gate (Mock for now, replace with real Auth later)
        // const session = await getServerSession(authOptions);
        // if (!session || !session.user.isPremium) return new NextResponse("Premium Required", { status: 403 });

        // For now, we assume if they hit this endpoint, they are authorized 
        // (Frontend handles the "Lock" UI, and we will add real auth later)

        const payload: UnifiedFlight | FlightResult = await request.json();

        return withFreemiumGate(user.id, 'itinerary_analysis', async () => {
            if (isUnifiedFlight(payload)) {
                const [scoredFlight] = await applyAdvancedFlightScoring([payload], {
                    origin: payload.from,
                    destination: payload.to,
                });

                if (!scoredFlight) {
                    return NextResponse.json({ error: 'Failed to score unified flight' }, { status: 500 });
                }

                const selfChecked = runSelfCheckLayer(scoredFlight);

                return NextResponse.json({
                    ...selfChecked.flight,
                    selfCheckWarnings: selfChecked.userWarnings,
                    _selfCheck: selfChecked.debug,
                });
            }

            const flight: FlightResult = payload;

            // 2. Re-Analyze (The Scoring Engine runs here, securely on the server)
            // We calculate Min Price based on the flight itself for now (simplification),
            // IN REALITY: We should re-fetch the market context or pass it in.
            // For this V1, we trust the flight data but re-run the V3 scoring logic.
            const { score, penalties, pros } = scoreFlightV3(flight, {
                minPrice: flight.price * 0.8, // Assume market min is slightly lower for penalty check
                hasChild: false
            });

            // 3. Return Full Intelligence
            const premiumAnalysis = {
                ...flight,
                agentScore: score,
                scoreDetails: {
                    total: score,
                    penalties,
                    pros
                },
                // Ensure amenities are passed through if they exist, or enhanced here
                amenities: flight.amenities,
                legal: flight.legal,
                baggageSummary: flight.baggageSummary
            };

            return NextResponse.json(premiumAnalysis);
        });
    } catch (error) {
        console.error('Analysis API Error:', error);
        return NextResponse.json({ error: 'Failed to analyze flight' }, { status: 500 });
    }
}

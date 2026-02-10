import { NextResponse } from 'next/server';
import { scoreFlightV3 } from '@/lib/scoring/flightScoreEngine';
import { FlightResult } from '@/types/hybridFlight';

export async function POST(request: Request) {
    try {
        // 1. Auth Gate (Mock for now, replace with real Auth later)
        // const session = await getServerSession(authOptions);
        // if (!session || !session.user.isPremium) return new NextResponse("Premium Required", { status: 403 });

        // For now, we assume if they hit this endpoint, they are authorized 
        // (Frontend handles the "Lock" UI, and we will add real auth later)

        const flight: FlightResult = await request.json();

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
    } catch (error) {
        console.error('Analysis API Error:', error);
        return NextResponse.json({ error: 'Failed to analyze flight' }, { status: 500 });
    }
}

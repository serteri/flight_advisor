import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST: Add flight to watchlist
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        const body = await request.json();

        const {
            flightNumber,
            airline,
            origin,
            destination,
            departureDate,
            price,
            currency = 'TRY',
            // NEW: Flight details
            totalDuration,
            stops,
            segments,
            layovers,
            baggageWeight,
            cabin,
        } = body;

        // Validate required fields
        if (!flightNumber || !airline || !origin || !destination || !departureDate || !price) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Create watched flight with full details
        const watchedFlight = await prisma.watchedFlight.create({
            data: {
                userId: session?.user?.id || null,
                flightNumber,
                airline,
                origin,
                destination,
                departureDate: new Date(departureDate),
                initialPrice: price,
                currentPrice: price,
                currency,
                priceHistory: [{ date: new Date().toISOString(), price }],
                status: 'ACTIVE',
                // NEW: Flight details
                totalDuration: totalDuration || null,
                stops: stops || 0,
                segments: segments || null,
                layovers: layovers || null,
                baggageWeight: baggageWeight || null,
                cabin: cabin || 'ECONOMY',
            },
        });

        return NextResponse.json({
            success: true,
            id: watchedFlight.id,
            message: 'Flight added to watchlist'
        });

    } catch (error) {
        console.error('[TRACK_FLIGHT] Error:', error);
        return NextResponse.json(
            { error: 'Failed to save flight' },
            { status: 500 }
        );
    }
}

// GET: Get user's watched flights
export async function GET(request: NextRequest) {
    try {
        const session = await auth();

        // Get flights - if logged in, get user's flights; otherwise get all (for demo)
        const whereClause = session?.user?.id
            ? { userId: session.user.id }
            : {};

        const watchedFlights = await prisma.watchedFlight.findMany({
            where: {
                ...whereClause,
                status: 'ACTIVE',
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({
            success: true,
            flights: watchedFlights
        });

    } catch (error) {
        console.error('[TRACK_FLIGHT] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch watched flights' },
            { status: 500 }
        );
    }
}

// DELETE: Remove flight from watchlist
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { error: 'Flight ID required' },
                { status: 400 }
            );
        }

        await prisma.watchedFlight.delete({
            where: { id },
        });

        return NextResponse.json({
            success: true,
            message: 'Flight removed from watchlist'
        });

    } catch (error) {
        console.error('[TRACK_FLIGHT] Error:', error);
        return NextResponse.json(
            { error: 'Failed to remove flight' },
            { status: 500 }
        );
    }
}

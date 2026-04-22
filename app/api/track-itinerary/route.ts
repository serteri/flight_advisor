import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const segmentSchema = z.object({
    from: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
    to: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
    departureDateTime: z.string().datetime({ offset: true }),
    arrivalDateTime: z.string().datetime({ offset: true }),
    airline: z.string().trim().min(1),
    flightNumber: z.string().trim().min(1),
    aircraft: z.string().trim().min(1).optional(),
});

const payloadSchema = z.object({
    trackingType: z.literal('ITINERARY_CANDIDATE'),
    trip: z.object({
        origin: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
        destination: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
        departureDate: z.string().datetime({ offset: true }),
        price: z.number().positive(),
        currency: z.string().trim().toUpperCase().length(3),
        cabin: z.enum(['economy', 'premium', 'business', 'first']),
        baggage: z.object({
            checkedBaggageKg: z.number().min(0).nullable(),
            cabinBaggageKg: z.number().min(0).nullable(),
            included: z.boolean().nullable(),
        }),
        refundable: z.boolean().nullable(),
        totalDurationMinutes: z.number().int().min(0),
        stops: z.number().int().min(0),
    }),
    scoreSnapshot: z.object({
        recommendation: z.enum(['BUY', 'WAIT', 'WATCH']),
        confidence: z.number().min(0).max(100),
        primaryReason: z.string().trim().min(1),
        positiveFactor: z.string().trim().min(1).nullable(),
        negativeFactor: z.string().trim().min(1).nullable(),
        missingFactor: z.string().trim().min(1).nullable(),
        actionHint: z.string().trim().min(1),
        dataSourceType: z.literal('USER_PASTED_ITINERARY'),
        realTimeDataAvailable: z.boolean(),
    }),
    segments: z.array(segmentSchema).min(1).max(8),
});

const roundMinutes = (startIso: string, endIso: string): number => {
    const diffMs = new Date(endIso).getTime() - new Date(startIso).getTime();
    return Math.max(0, Math.round(diffMs / 60000));
};

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const payload = payloadSchema.parse(await request.json());

        const user = await prisma.user.upsert({
            where: { email: session.user.email },
            create: {
                email: session.user.email,
                name: session.user.name || 'User',
            },
            update: {
                name: session.user.name || undefined,
            },
        });

        const layovers = payload.segments.slice(0, -1).map((segment, index) => ({
            airport: segment.to,
            duration: roundMinutes(segment.arrivalDateTime, payload.segments[index + 1].departureDateTime),
        }));

        const firstSegment = payload.segments[0];
        const lastSegment = payload.segments[payload.segments.length - 1];
        const airlineLabel = new Set(payload.segments.map((segment) => segment.airline)).size === 1
            ? firstSegment.airline
            : `${firstSegment.airline} +${payload.segments.length - 1}`;
        const flightLabel = payload.segments.length === 1
            ? firstSegment.flightNumber
            : `${firstSegment.flightNumber} +${payload.segments.length - 1}`;

        const watchedFlight = await prisma.watchedFlight.create({
            data: {
                userId: user.id,
                flightNumber: flightLabel,
                airline: airlineLabel,
                origin: payload.trip.origin,
                destination: payload.trip.destination,
                departureDate: new Date(payload.trip.departureDate),
                initialPrice: payload.trip.price,
                currentPrice: payload.trip.price,
                currency: payload.trip.currency,
                priceHistory: [{
                    date: new Date().toISOString(),
                    price: payload.trip.price,
                    source: 'score_handoff',
                    trackingType: payload.trackingType,
                    scoreSnapshot: payload.scoreSnapshot,
                    trackingState: {
                        status: 'ACTIVE',
                        waitingForNextSnapshot: true,
                        limitedData: true,
                        realTimeDataUnavailable: !payload.scoreSnapshot.realTimeDataAvailable,
                        importantChanged: false,
                    },
                }],
                status: 'ACTIVE',
                lastChecked: new Date(),
                totalDuration: payload.trip.totalDurationMinutes,
                stops: payload.trip.stops,
                segments: payload.segments,
                layovers,
                baggageWeight: payload.trip.baggage.checkedBaggageKg ?? payload.trip.baggage.cabinBaggageKg ?? null,
                cabin: payload.trip.cabin.toUpperCase(),
            },
        });

        return NextResponse.json({
            success: true,
            trackingType: 'ITINERARY_CANDIDATE',
            id: watchedFlight.id,
            status: watchedFlight.status,
            message: 'Itinerary tracking created',
        }, { status: 201 });
    } catch (error) {
        if (error instanceof ZodError) {
            return NextResponse.json({
                error: 'Invalid itinerary tracking payload',
                issues: error.issues.map((issue) => ({
                    path: issue.path.join('.'),
                    message: issue.message,
                })),
            }, { status: 400 });
        }

        console.error('[TRACK_ITINERARY] Failed to create itinerary tracking:', error);
        return NextResponse.json({ error: 'Failed to create itinerary tracking' }, { status: 500 });
    }
}
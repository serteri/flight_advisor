import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createRouteWatch, getRouteWatchDetails } from '@/lib/routeTracking';

const isoOrDateSchema = z.string().refine(
    (value) => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return true;
        return Number.isFinite(Date.parse(value));
    },
    { message: 'Must be a valid date (YYYY-MM-DD or ISO datetime)' },
);

const createRouteWatchSchema = z.object({
    origin: z.string().trim().regex(/^[A-Za-z]{3}$/),
    destination: z.string().trim().regex(/^[A-Za-z]{3}$/),
    departureDate: isoOrDateSchema,
    returnDate: isoOrDateSchema.optional(),
    maxStops: z.number().int().min(0).max(3).optional(),
    targetPrice: z.number().positive().optional(),
    cabin: z.enum(['economy', 'premium', 'business', 'first', 'ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST']).optional(),
    baggageRequired: z.boolean().optional(),
    preferredAirlines: z.array(z.string().trim().min(2).max(3)).max(6).optional(),
    tripType: z.enum(['ONE_WAY', 'ROUND_TRIP']).optional(),
});

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const payload = createRouteWatchSchema.parse(await request.json());

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

        const route = await createRouteWatch(user.id, {
            origin: payload.origin,
            destination: payload.destination,
            departureDate: payload.departureDate,
            returnDate: payload.returnDate,
            maxStops: payload.maxStops,
            targetPrice: payload.targetPrice,
            cabin: payload.cabin,
            baggageRequired: payload.baggageRequired,
            preferredAirlines: payload.preferredAirlines?.map((a) => a.toUpperCase()),
            tripType: payload.tripType,
        });

        const details = await getRouteWatchDetails(route.id, user.id, false);

        return NextResponse.json(
            {
                id: route.id,
                status: 'ACTIVE',
                message: 'Route watch created',
                details,
            },
            { status: 201 },
        );
    } catch (error) {
        if (error instanceof ZodError) {
            return NextResponse.json(
                {
                    error: 'Invalid route watch payload',
                    issues: error.issues.map((issue) => ({
                        path: issue.path.join('.'),
                        message: issue.message,
                    })),
                },
                { status: 400 },
            );
        }

        console.error('[TRACK_ROUTE] Failed to create route watch:', error);
        return NextResponse.json({ error: 'Failed to create route watch' }, { status: 500 });
    }
}

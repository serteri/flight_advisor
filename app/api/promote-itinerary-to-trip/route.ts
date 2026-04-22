import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { Prisma } from '@prisma/client';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type WatchedSegment = {
    from?: string;
    to?: string;
    origin?: string;
    destination?: string;
    departureDateTime?: string;
    arrivalDateTime?: string;
    departure?: string;
    arrival?: string;
    airline?: string;
    carrier?: string;
    flightNumber?: string;
    aircraft?: string;
    cabin?: string;
};

type PromotionHistoryEntry = {
    date?: string;
    price?: number;
    source?: string;
    trackingType?: string;
    scoreSnapshot?: unknown;
    trackingState?: {
        status?: string;
        promotedTripId?: string;
        promotedAt?: string;
        bookingDataEstimated?: boolean;
        missingBookingFields?: string[];
        [key: string]: unknown;
    };
};

const payloadSchema = z.object({
    trackedItineraryId: z.string().trim().min(1),
});

const toSafeDate = (value?: string | Date | null): Date | null => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
};

const toIata = (value?: string | null): string | null => {
    if (!value) return null;
    const cleaned = value.trim().toUpperCase();
    return /^[A-Z]{3}$/.test(cleaned) ? cleaned : null;
};

const normalizeTicketClass = (value?: string | null): string => {
    const raw = (value || 'ECONOMY').toUpperCase().replace(/\s+/g, '_');
    if (raw === 'PREMIUM') return 'PREMIUM_ECONOMY';
    if (raw === 'PREMIUM_ECONOMY') return 'PREMIUM_ECONOMY';
    if (raw === 'BUSINESS') return 'BUSINESS';
    if (raw === 'FIRST') return 'FIRST';
    return 'ECONOMY';
};

const deriveAirlineCode = (flightNumber?: string, airline?: string): string => {
    const fromFlight = (flightNumber || '').toUpperCase().match(/^([A-Z0-9]{2,3})/)?.[1];
    if (fromFlight) return fromFlight;

    const fromAirline = (airline || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
    return fromAirline || 'XX';
};

const buildTripSegments = (params: {
    watchedFlight: {
        origin: string;
        destination: string;
        departureDate: Date;
        airline: string;
        flightNumber: string;
        cabin: string | null;
        segments: unknown;
    };
}) => {
    const { watchedFlight } = params;

    const rawSegments = Array.isArray(watchedFlight.segments)
        ? watchedFlight.segments as unknown as WatchedSegment[]
        : [];

    const fallbackDeparture = watchedFlight.departureDate;
    const fallbackArrival = new Date(fallbackDeparture.getTime() + 2 * 60 * 60 * 1000);

    const mapped = rawSegments.map((segment, index) => {
        const origin = toIata(segment.from || segment.origin) || watchedFlight.origin;
        const destination = toIata(segment.to || segment.destination) || watchedFlight.destination;

        const departure =
            toSafeDate(segment.departureDateTime) ||
            toSafeDate(segment.departure) ||
            (index === 0 ? fallbackDeparture : null) ||
            fallbackDeparture;

        const arrival =
            toSafeDate(segment.arrivalDateTime) ||
            toSafeDate(segment.arrival) ||
            new Date(departure.getTime() + 2 * 60 * 60 * 1000);

        const flightNumber = (segment.flightNumber || watchedFlight.flightNumber || `SEG${index + 1}`)
            .toUpperCase()
            .replace(/\s+/g, '');

        const airline = segment.airline || segment.carrier || watchedFlight.airline;

        return {
            segmentOrder: index,
            airlineCode: deriveAirlineCode(flightNumber, airline),
            flightNumber,
            origin,
            destination,
            departureDate: departure,
            arrivalDate: arrival,
            aircraftType: segment.aircraft || null,
            cabinClass: normalizeTicketClass(segment.cabin || watchedFlight.cabin),
        };
    });

    if (mapped.length > 0) return mapped;

    const fallbackFlightNumber = watchedFlight.flightNumber.toUpperCase().replace(/\s+/g, '') || 'UNKNOWN';
    return [
        {
            segmentOrder: 0,
            airlineCode: deriveAirlineCode(fallbackFlightNumber, watchedFlight.airline),
            flightNumber: fallbackFlightNumber,
            origin: watchedFlight.origin,
            destination: watchedFlight.destination,
            departureDate: fallbackDeparture,
            arrivalDate: fallbackArrival,
            aircraftType: null,
            cabinClass: normalizeTicketClass(watchedFlight.cabin),
        },
    ];
};

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const payload = payloadSchema.parse(await request.json());

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const watchedFlight = await prisma.watchedFlight.findFirst({
            where: {
                id: payload.trackedItineraryId,
                userId: user.id,
            },
        });

        if (!watchedFlight) {
            return NextResponse.json({ error: 'Tracked itinerary not found' }, { status: 404 });
        }

        const linkTag = `PROMOTED_FROM_WATCHED:${watchedFlight.id}`;

        let monitoredTrip = await prisma.monitoredTrip.findFirst({
            where: {
                userId: user.id,
                fareBasis: linkTag,
            },
            select: { id: true },
        });

        if (!monitoredTrip) {
            const segments = buildTripSegments({ watchedFlight });
            const syntheticPnr = `UNCONFIRMED-${watchedFlight.id.slice(-8).toUpperCase()}`;

            monitoredTrip = await prisma.monitoredTrip.create({
                data: {
                    userId: user.id,
                    pnr: syntheticPnr,
                    routeLabel: `${watchedFlight.origin} → ${watchedFlight.destination}`,
                    originalPrice: watchedFlight.currentPrice ?? watchedFlight.initialPrice,
                    currency: watchedFlight.currency || 'AUD',
                    ticketClass: normalizeTicketClass(watchedFlight.cabin),
                    fareBasis: linkTag,
                    isRefundable: false,
                    watchPrice: false,
                    watchDelay: true,
                    watchUpgrade: false,
                    watchSeat: false,
                    watchSchedule: true,
                    status: 'ACTIVE',
                    nextCheckAt: new Date(),
                    checkFrequency: 60,
                    segments: {
                        create: segments,
                    },
                    snapshot: {
                        create: {
                            delayMinutes: 0,
                            status: 'scheduled',
                            dataQuality: 'UNKNOWN',
                            eu261Eligible: false,
                        },
                    },
                },
                select: { id: true },
            });
        }

        const history = Array.isArray(watchedFlight.priceHistory)
            ? watchedFlight.priceHistory as unknown as PromotionHistoryEntry[]
            : [];

        const alreadyLinked = history.some(
            (entry) => entry?.trackingState?.promotedTripId === monitoredTrip.id,
        );

        if (!alreadyLinked) {
            const nowIso = new Date().toISOString();
            const latest = history[history.length - 1] || null;

            const nextHistory: PromotionHistoryEntry[] = [
                ...history,
                {
                    date: nowIso,
                    price: watchedFlight.currentPrice ?? watchedFlight.initialPrice,
                    source: 'promotion_to_booked_trip',
                    trackingType: 'ITINERARY_CANDIDATE',
                    scoreSnapshot: latest?.scoreSnapshot,
                    trackingState: {
                        ...(latest?.trackingState || {}),
                        status: 'PROMOTED_TO_BOOKED_TRIP',
                        promotedTripId: monitoredTrip.id,
                        promotedAt: nowIso,
                        bookingDataEstimated: true,
                        missingBookingFields: ['pnr_confirmation', 'ticket_number'],
                        importantChanged: true,
                    },
                },
            ];

            await prisma.watchedFlight.update({
                where: { id: watchedFlight.id },
                data: {
                    status: 'BOUGHT',
                    lastChecked: new Date(),
                    priceHistory: nextHistory as Prisma.InputJsonValue,
                },
            });
        }

        return NextResponse.json({
            success: true,
            trackedItineraryId: watchedFlight.id,
            monitoredTripId: monitoredTrip.id,
            linked: true,
            bookingDataEstimated: true,
            missingBookingFields: ['pnr_confirmation', 'ticket_number'],
            message: 'Tracked itinerary promoted to booked trip monitoring',
        });
    } catch (error) {
        if (error instanceof ZodError) {
            return NextResponse.json({
                error: 'Invalid promotion payload',
                issues: error.issues.map((issue) => ({
                    path: issue.path.join('.'),
                    message: issue.message,
                })),
            }, { status: 400 });
        }

        console.error('[PROMOTE_ITINERARY_TO_TRIP] Failed:', error);
        return NextResponse.json({ error: 'Failed to promote itinerary to booked trip' }, { status: 500 });
    }
}

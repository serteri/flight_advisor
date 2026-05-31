
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { withFreemiumGate } from '@/lib/freemium/gate';

// TODO: Keep this endpoint as the Guardian manual-monitoring entry point until
// all remaining legacy callers are either migrated or deleted.

type MonitoredSegmentInput = {
    carrierCode?: string;
    number?: string;
    departure?: { iataCode?: string; at?: string };
    arrival?: { iataCode?: string; at?: string };
    aircraft?: { code?: string };
};

type ManualAddTripPayload = {
    airlineCode?: string;
    flightNumber?: string;
    date?: string;
    origin?: string;
    departureTime?: string;
    destination?: string;
    arrivalTime?: string;
    pnr?: string;
};

const toDateTime = (date?: string, time?: string, fallback?: Date) => {
    if (date && time) {
        const parsed = new Date(`${date}T${time}:00`);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed;
        }
    }
    return fallback || new Date();
};

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const { pnr, flightData } = body as { pnr?: string; flightData?: any };
        const manualPayload = body as ManualAddTripPayload;

        const normalizedFlightData = flightData || (manualPayload.origin && manualPayload.destination
            ? {
                origin: manualPayload.origin,
                destination: manualPayload.destination,
                travelClass: 'ECONOMY',
                price: null,
                segments: [
                    {
                        carrierCode: manualPayload.airlineCode,
                        number: manualPayload.flightNumber,
                        departure: {
                            iataCode: manualPayload.origin,
                            at: toDateTime(manualPayload.date, manualPayload.departureTime).toISOString(),
                        },
                        arrival: {
                            iataCode: manualPayload.destination,
                            at: toDateTime(
                                manualPayload.date,
                                manualPayload.arrivalTime,
                                toDateTime(manualPayload.date, manualPayload.departureTime, new Date(Date.now() + 2 * 60 * 60 * 1000))
                            ).toISOString(),
                        },
                        aircraft: { code: '738' },
                    },
                ],
            }
            : null);

        console.info('[TRIPS_MONITOR] Received monitor request', {
            userId: session.user.id,
            pnr,
            hasFlightData: Boolean(flightData),
            hasManualPayload: Boolean(manualPayload.origin && manualPayload.destination),
        });

        if (!normalizedFlightData) {
            console.warn('[TRIPS_MONITOR] Missing required fields', { pnr, normalizedFlightData });
            return NextResponse.json({ error: 'Uçuş verisi gereklidir.' }, { status: 400 });
        }

        return withFreemiumGate(session.user.id!, 'monitored_trip', async () => {
            const segments = Array.isArray(normalizedFlightData.segments) ? normalizedFlightData.segments : [];
            const trip = await prisma.monitoredTrip.create({
                data: {
                    userId: session.user.id!,
                    pnr: pnr || null,
                    routeLabel: `${normalizedFlightData.origin} ➝ ${normalizedFlightData.destination}`,
                    originalPrice: normalizedFlightData.price?.total || normalizedFlightData.price || 0,
                    currency: normalizedFlightData.price?.currency || "AUD",
                    ticketClass: normalizedFlightData.travelClass || "ECONOMY",
                    nextCheckAt: new Date(Date.now() + 60 * 60 * 1000), // Check in 1 hour
                    snapshot: {
                        create: {
                            delayMinutes: 0,
                            status: 'scheduled',
                            dataQuality: 'UNKNOWN',
                            eu261Eligible: false,
                        }
                    },

                    // 2. Segmentleri İçine Göm (Nested Write)
                    segments: {
                        create: (segments as MonitoredSegmentInput[]).map((seg, index) => ({
                            segmentOrder: index, // 0: İlk uçak, 1: İkinci uçak
                            airlineCode: seg.carrierCode || 'XX',   // SQ
                            flightNumber: seg.number || `SEG${index + 1}`,       // 236
                            origin: seg.departure?.iataCode || normalizedFlightData.origin,
                            destination: seg.arrival?.iataCode || normalizedFlightData.destination,
                            departureDate: seg.departure?.at ? new Date(seg.departure.at) : new Date(),
                            arrivalDate: seg.arrival?.at ? new Date(seg.arrival.at) : new Date(),
                            aircraftType: seg.aircraft?.code || '738' // Default
                        }))
                    }
                }
            });

            console.info('[TRIPS_MONITOR] Monitored trip created', {
                tripId: trip.id,
                userId: session.user.id,
                pnr,
                routeLabel: trip.routeLabel,
            });

            return NextResponse.json({ success: true, tripId: trip.id });
        });
    } catch (error) {
        console.error('[TRIPS_MONITOR] Trip creation error', error);
        return NextResponse.json({ error: 'Uçuş takibi başlatılamadı.' }, { status: 500 });
    }
}

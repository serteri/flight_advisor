
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { withFreemiumGate } from '@/lib/freemium/gate';

type MonitoredSegmentInput = {
    carrierCode?: string;
    number?: string;
    departure?: { iataCode?: string; at?: string };
    arrival?: { iataCode?: string; at?: string };
    aircraft?: { code?: string };
};

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { pnr, flightData } = await req.json();

        // Basic validation
        if (!pnr || !flightData) {
            return NextResponse.json({ error: 'PNR ve uçuş verisi gereklidir.' }, { status: 400 });
        }

        return withFreemiumGate(session.user.id!, 'monitored_trip', async () => {
            // 1. Önce Ana Yolculuğu Yarat
            const trip = await prisma.monitoredTrip.create({
                data: {
                    userId: session.user.id!,
                    pnr: pnr,
                    routeLabel: `${flightData.origin} ➝ ${flightData.destination}`, // BNE -> IST
                    originalPrice: flightData.price?.total || 0, // Fallback if not provided
                    currency: flightData.price?.currency || "AUD",
                    ticketClass: flightData.travelClass || "ECONOMY",
                    nextCheckAt: new Date(Date.now() + 60 * 60 * 1000), // Check in 1 hour

                    // 2. Segmentleri İçine Göm (Nested Write)
                    segments: {
                        create: (flightData.segments as MonitoredSegmentInput[]).map((seg, index) => ({
                            segmentOrder: index, // 0: İlk uçak, 1: İkinci uçak
                            airlineCode: seg.carrierCode || 'XX',   // SQ
                            flightNumber: seg.number || `SEG${index + 1}`,       // 236
                            origin: seg.departure?.iataCode || flightData.origin, // BNE
                            destination: seg.arrival?.iataCode || flightData.destination, // SIN
                            departureDate: seg.departure?.at ? new Date(seg.departure.at) : new Date(),
                            arrivalDate: seg.arrival?.at ? new Date(seg.arrival.at) : new Date(),
                            aircraftType: seg.aircraft?.code || '738' // Default
                        }))
                    }
                }
            });

            return NextResponse.json({ success: true, tripId: trip.id });
        });
    } catch (error) {
        console.error("Trip creation error:", error);
        return NextResponse.json({ error: 'Uçuş takibi başlatılamadı.' }, { status: 500 });
    }
}

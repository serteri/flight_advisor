
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { pnr, flightData } = await req.json();

        // Basic validation
        if (!pnr || !flightData) {
            return NextResponse.json({ error: 'PNR ve uçuş verisi gereklidir.' }, { status: 400 });
        }

        // 1. Önce Ana Yolculuğu Yarat
        const trip = await prisma.monitoredTrip.create({
            data: {
                userId: session.user.id,
                pnr: pnr,
                routeLabel: `${flightData.origin} ➝ ${flightData.destination}`, // BNE -> IST
                originalPrice: flightData.price?.total || 0, // Fallback if not provided
                currency: flightData.price?.currency || "AUD",
                ticketClass: flightData.travelClass || "ECONOMY",
                nextCheckAt: new Date(Date.now() + 60 * 60 * 1000), // Check in 1 hour

                // 2. Segmentleri İçine Göm (Nested Write)
                segments: {
                    create: flightData.segments.map((seg: any, index: number) => ({
                        segmentOrder: index, // 0: İlk uçak, 1: İkinci uçak
                        airlineCode: seg.carrierCode,   // SQ
                        flightNumber: seg.number,       // 236
                        origin: seg.departure.iataCode, // BNE
                        destination: seg.arrival.iataCode, // SIN
                        departureDate: new Date(seg.departure.at),
                        arrivalDate: new Date(seg.arrival.at),
                        aircraftType: seg.aircraft?.code || '738' // Default
                    }))
                }
            }
        });

        return NextResponse.json({ success: true, tripId: trip.id });
    } catch (error) {
        console.error("Trip creation error:", error);
        return NextResponse.json({ error: 'Uçuş takibi başlatılamadı.' }, { status: 500 });
    }
}

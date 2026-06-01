import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

const isDelayEvent = (eventType: string) => /delay/i.test(eventType || '');

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const trips = await prisma.monitoredTrip.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: 'desc' },
        include: {
            segments: {
                orderBy: { segmentOrder: 'asc' },
                select: {
                    id: true,
                    segmentOrder: true,
                    airlineCode: true,
                    flightNumber: true,
                    origin: true,
                    destination: true,
                    departureDate: true,
                    arrivalDate: true,
                },
            },
            snapshot: {
                select: {
                    status: true,
                    delayMinutes: true,
                    eu261Eligible: true,
                    snapshotAt: true,
                },
            },
            alertEvents: {
                orderBy: { detectedAt: 'desc' },
                select: {
                    id: true,
                    eventType: true,
                    severity: true,
                    title: true,
                    message: true,
                    detectedAt: true,
                },
            },
        },
    });

    const totalTripsMonitored = trips.length;
    const allAlertEvents = trips.flatMap((trip) =>
        trip.alertEvents.map((event) => ({
            ...event,
            tripId: trip.id,
            routeLabel: trip.routeLabel,
        })),
    );
    const totalDelaysDetected = allAlertEvents.filter((event) => isDelayEvent(event.eventType)).length;
    const totalHoursDelayed = trips.reduce((sum, trip) => sum + ((trip.snapshot?.delayMinutes || 0) / 60), 0);
    const eu261ClaimsGenerated = trips.filter((trip) => trip.snapshot?.eu261Eligible).length;

    return NextResponse.json({
        summary: {
            totalTripsMonitored,
            totalDelaysDetected,
            totalHoursDelayed,
            eu261ClaimsGenerated,
        },
        trips,
        timeline: allAlertEvents.sort(
            (a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime(),
        ),
    });
}

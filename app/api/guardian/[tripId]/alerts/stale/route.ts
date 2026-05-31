import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(_: Request, { params }: { params: Promise<{ tripId: string }> }) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tripId } = await params;
    if (!tripId) {
        return NextResponse.json({ error: 'Missing tripId' }, { status: 400 });
    }

    const trip = await prisma.monitoredTrip.findFirst({
        where: {
            id: tripId,
            userId: session.user.id,
        },
        select: { id: true },
    });

    if (!trip) {
        return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    const [deletedAlertEvents, deletedLegacyAlerts] = await prisma.$transaction([
        prisma.alertEvent.deleteMany({
            where: {
                tripId,
                OR: [
                    { eventType: 'MONITORING_STALE' },
                    { eventType: 'STATUS_UNAVAILABLE' },
                    { title: { contains: 'DATA_ISSUE', mode: 'insensitive' } },
                    { message: { contains: 'DATA_ISSUE', mode: 'insensitive' } },
                ],
            },
        }),
        prisma.guardianAlert.deleteMany({
            where: {
                tripId,
                OR: [
                    { type: 'MONITORING_STALE' },
                    { type: 'DATA_ISSUE' },
                ],
            },
        }),
    ]);

    return NextResponse.json({
        ok: true,
        deleted: {
            alertEvents: deletedAlertEvents.count,
            legacyAlerts: deletedLegacyAlerts.count,
        },
    });
}
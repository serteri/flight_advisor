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

    await prisma.$transaction(async (tx) => {
        await tx.alertEvent.deleteMany({ where: { tripId } });
        await tx.notificationDelivery.deleteMany({ where: { tripId } });
        await tx.tripSnapshot.deleteMany({ where: { tripId } });
        await tx.flightSegment.deleteMany({ where: { tripId } });
        await tx.monitoredTrip.delete({ where: { id: tripId } });
    });

    return NextResponse.json({ ok: true, tripId });
}
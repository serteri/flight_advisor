import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getRouteWatchDetails } from '@/lib/routeTracking';

type Params = {
    params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: Params) {
    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const refresh = request.nextUrl.searchParams.get('refresh') === '1';

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
    });

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    try {
        const details = await getRouteWatchDetails(id, user.id, refresh);

        if (!details) {
            return NextResponse.json({ error: 'Route watch not found' }, { status: 404 });
        }

        return NextResponse.json(details);
    } catch (error) {
        console.error('[TRACK_ROUTE] Failed to fetch route watch details:', error);
        return NextResponse.json({ error: 'Failed to fetch route watch details' }, { status: 500 });
    }
}

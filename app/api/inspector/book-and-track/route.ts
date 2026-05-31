import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { withFreemiumGate } from '@/lib/freemium/gate';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { flightNumber, date, origin, destination, price, pnr, offer } =
      await request.json();

    if (!flightNumber || !date || !origin || !destination) {
      return NextResponse.json(
        { error: 'Missing required flight data' },
        { status: 400 }
      );
    }

    console.log(
      `[Book & Track] Creating MonitoredTrip for user ${session.user.email}:`,
      { flightNumber, date, origin, destination, pnr }
    );

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const response = await withFreemiumGate(user.id, 'monitored_trip', async () => {
      const trip = await prisma.monitoredTrip.create({
        data: {
          userId: user.id,
          pnr: pnr || `AUTO-${flightNumber}-${Date.now()}`,
          routeLabel: `${origin} → ${destination}`,
          originalPrice: price || 0,
          currency: offer?.currency || 'USD',
          ticketClass: offer?.cabinClass || 'economy',
          fareBasis: offer?.fareType || 'standard',
          isRefundable: false,
          watchPrice: true,
          watchDelay: true,
          watchUpgrade: false,
          watchSeat: false,
          watchSchedule: true,
          status: 'ACTIVE',
          checkFrequency: 360, // Check every 6 hours
          nextCheckAt: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours from now

          // Create nested flight segment
          segments: {
            create: [
              {
                segmentOrder: 1,
                airlineCode: flightNumber.substring(0, 2).toUpperCase(),
                flightNumber,
                origin: origin.toUpperCase(),
                destination: destination.toUpperCase(),
                departureDate: new Date(date),
                arrivalDate: new Date(
                  new Date(date).getTime() +
                    24 * 60 * 60 * 1000
                ), // Assume next day, will be updated by Guardian
                aircraftType: offer?.segments?.[0]?.aircraft || 'N/A',
                userSeat: null,
                cabinClass:
                  offer?.segments?.[0]?.cabinClass || 'economy',
              },
            ],
          },
        },
        include: {
          segments: true,
        },
      });

      console.log('[Book & Track] MonitoredTrip created:', trip.id);

      // Log creation event
      console.log(
        `[Guardian] Trip ${trip.id} created from Flight Inspector. Guardian worker should pick it up.`
      );

      return NextResponse.json({
        success: true,
        tripId: trip.id,
        message:
          'Flight is now being monitored. You will receive alerts for delays and price changes.',
      });
    });

    return response;
  } catch (error) {
    console.error('[Book & Track] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

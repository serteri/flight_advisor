import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { evaluateCompensation } from '@/lib/compensation/engine';
import { getAirlineAcceptanceRate } from '@/lib/compensation/airlineZones';
import { getCurrentUserId } from '@/lib/auth/currentUser';

const calculateSchema = z.object({
  tripId: z.string().min(1).optional(),
  flightNumber: z.string().min(2).max(12),
  origin: z.string().length(3),
  // Final destination of the journey (not the first connection).
  destination: z.string().length(3),
  carrier: z.string().min(2).max(3),
  scheduledDep: z.coerce.date(),
  scheduledArr: z.coerce.date().optional(),
  actualArr: z.coerce.date().optional(),
  isCancellation: z.boolean().optional(),
  cancellationNoticeDate: z.coerce.date().optional(),
});

export async function POST(req: Request) {
  try {
    const input = calculateSchema.parse(await req.json());
    const origin = input.origin.toUpperCase();
    const destination = input.destination.toUpperCase();
    const carrier = input.carrier.toUpperCase();

    const result = evaluateCompensation({
      disruption: input.isCancellation ? 'CANCELLATION' : 'DELAY',
      carrierIata: carrier,
      originIata: origin,
      finalDestinationIata: destination,
      scheduledDepartureUtc: input.scheduledDep.toISOString(),
      scheduledArrivalUtc: input.scheduledArr?.toISOString() ?? null,
      actualArrivalUtc: input.actualArr?.toISOString() ?? null,
      cancellationNoticeUtc: input.cancellationNoticeDate?.toISOString() ?? null,
    });

    let claimId: string | null = null;
    let flightLegId: string | null = null;

    // Persisting is only allowed on the caller's own trip.
    if (input.tripId && input.scheduledArr) {
      const userId = await getCurrentUserId();
      const trip = userId
        ? await prisma.monitoredTrip.findUnique({ where: { id: input.tripId }, select: { userId: true } })
        : null;
      if (!trip || trip.userId !== userId) {
        return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
      }

      const delayMinutes = input.actualArr
        ? Math.max(0, Math.round((input.actualArr.getTime() - input.scheduledArr.getTime()) / 60000))
        : null;

      const flightLeg = await prisma.flightLeg.create({
        data: {
          tripId: input.tripId,
          flightNumber: input.flightNumber.toUpperCase(),
          origin,
          destination,
          scheduledDep: input.scheduledDep,
          scheduledArr: input.scheduledArr,
          actualArr: input.actualArr,
          carrier,
          distanceKm: result.distanceKm ?? undefined,
          regulationZone: result.regime,
        },
      });
      flightLegId = flightLeg.id;

      const claim = await prisma.compensationClaim.create({
        data: {
          flightLegId: flightLeg.id,
          eligibilityStatus: result.status,
          regulation: result.regime,
          estimatedAmount: result.amount ?? undefined,
          amount: result.amount ?? undefined,
          currency: result.currency ?? 'EUR',
          delayMinutes: delayMinutes ?? undefined,
          details: { reasons: result.reasons },
        },
      });
      claimId = claim.id;
    }

    return NextResponse.json({
      ...result,
      airlineClaimHistory: {
        carrier,
        acceptanceRate: getAirlineAcceptanceRate(carrier),
      },
      claimId,
      flightLegId,
      dataNotice: 'Estimate based on the supplied flight data. This is not legal advice; the airline may claim extraordinary circumstances.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid compensation calculation input', issues: error.issues }, { status: 400 });
    }

    console.error('Compensation calculation failed:', error);
    return NextResponse.json({ error: 'Unable to calculate compensation estimate' }, { status: 500 });
  }
}

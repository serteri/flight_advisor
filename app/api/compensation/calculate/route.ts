import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { calculateAirportDistanceKm } from '@/lib/compensation/haversine';
import { assessCompensation, type DisruptionCause } from '@/lib/compensation/regulations';
import { getAirlineAcceptanceRate } from '@/lib/compensation/airlineZones';

const calculateSchema = z.object({
  tripId: z.string().min(1).optional(),
  flightNumber: z.string().min(2).max(12),
  origin: z.string().length(3),
  destination: z.string().length(3),
  carrier: z.string().min(2).max(3),
  scheduledDep: z.coerce.date(),
  scheduledArr: z.coerce.date().optional(),
  actualArr: z.coerce.date().optional(),
  disruptionCause: z.enum(['OPERATIONAL', 'WEATHER', 'ATC_STRIKE', 'SECURITY_RISK', 'UNKNOWN']).optional(),
  cancellationNoticeDays: z.number().int().min(0).max(365).optional(),
  isCancellation: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const input = calculateSchema.parse(await req.json());
    const origin = input.origin.toUpperCase();
    const destination = input.destination.toUpperCase();
    const carrier = input.carrier.toUpperCase();
    const distanceKm = calculateAirportDistanceKm(origin, destination);
    const scheduledArr = input.scheduledArr ?? null;

    const assessment = assessCompensation({
      origin,
      destination,
      carrier,
      distanceKm,
      scheduledArr: scheduledArr ?? input.scheduledDep,
      actualArr: input.actualArr,
      disruptionCause: input.disruptionCause as DisruptionCause | undefined,
      cancellationNoticeDays: input.cancellationNoticeDays,
      isCancellation: input.isCancellation,
    });

    let claimId: string | null = null;
    let flightLegId: string | null = null;

    if (input.tripId && scheduledArr) {
      const flightLeg = await prisma.flightLeg.create({
        data: {
          tripId: input.tripId,
          flightNumber: input.flightNumber.toUpperCase(),
          origin,
          destination,
          scheduledDep: input.scheduledDep,
          scheduledArr,
          actualArr: input.actualArr,
          carrier,
          distanceKm: distanceKm ?? undefined,
          regulationZone: assessment.regulation,
        },
      });

      flightLegId = flightLeg.id;

      const claim = await prisma.compensationClaim.create({
        data: {
          flightLegId: flightLeg.id,
          eligibilityStatus: assessment.currentStatus.eligibilityStatus,
          regulation: assessment.regulation,
          estimatedAmount: assessment.currentStatus.estimatedAmount ?? undefined,
          amount: assessment.currentStatus.estimatedAmount ?? undefined,
          currency: assessment.currentStatus.currency ?? 'EUR',
          delayMinutes: assessment.currentStatus.delayMinutes ?? undefined,
          details: {
            basedOn: input.actualArr ? 'reported_actual_arrival' : 'scheduled_times_and_possible_delay_scenarios',
            reason: assessment.currentStatus.reason,
            compensationTiers: assessment.compensationTiers,
          },
        },
      });

      claimId = claim.id;
    }

    return NextResponse.json({
      regulation: assessment.regulation,
      distanceKm,
      compensationTiers: assessment.compensationTiers,
      currentStatus: assessment.currentStatus,
      airlineClaimHistory: {
        carrier,
        acceptanceRate: getAirlineAcceptanceRate(carrier),
      },
      claimId,
      flightLegId,
      dataNotice: input.actualArr
        ? 'Estimated based on reported delay data supplied by the user.'
        : 'Estimated from scheduled times and possible delay scenarios; no live airline status is implied.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid compensation calculation input', issues: error.issues }, { status: 400 });
    }

    console.error('Compensation calculation failed:', error);
    return NextResponse.json({ error: 'Unable to calculate compensation estimate' }, { status: 500 });
  }
}

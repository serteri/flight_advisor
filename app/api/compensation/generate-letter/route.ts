import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { withFreemiumGate } from '@/lib/freemium/gate';
import { prisma } from '@/lib/prisma';
import { isOwnedBy } from '@/lib/auth/ownership';
import { evaluateCompensation, type CompensationInput } from '@/lib/compensation/engine';
import {
  buildClaimLetter,
  compensationInputFromFlight,
  isRealPassengerName,
} from '@/lib/compensation/claimLetter';

// Client-sent amount/currency/regulation are intentionally not accepted:
// the amount always comes from the compensation engine.
const flightDetailsSchema = z.object({
  flightNumber: z.string().min(2).max(12),
  origin: z.string().length(3),
  destination: z.string().length(3),
  scheduledDate: z.string().optional(),
  delayHours: z.number().min(0).optional(),
  cancelled: z.boolean().optional(),
});

const letterSchema = z.object({
  tripId: z.string().min(1).optional(),
  claimId: z.string().min(1).optional(),
  passengerName: z.string().max(120).optional(),
  flightDetails: flightDetailsSchema.optional(),
});

const formatDate = (date: Date) => new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
}).format(date);

interface LetterSource {
  flightNumber: string;
  origin: string;
  destination: string;
  scheduledDate: string;
  disruption: 'DELAY' | 'CANCELLATION';
  arrivalDelayMinutes: number | null;
  engineInput: CompensationInput;
  storedName: string | null;
}

async function loadSource(input: z.infer<typeof letterSchema>, userId: string): Promise<LetterSource | null | 'not_found'> {
  if (input.tripId) {
    const trip = await prisma.monitoredTrip.findUnique({
      where: { id: input.tripId },
      include: {
        segments: { orderBy: { segmentOrder: 'asc' } },
        snapshot: true,
        passengers: true,
        user: { select: { name: true } },
      },
    });
    if (!trip || !isOwnedBy(trip, userId)) return 'not_found';
    const first = trip.segments[0];
    const last = trip.segments[trip.segments.length - 1];
    if (!first || !last) return null;
    const disruption = trip.snapshot?.status?.toUpperCase() === 'CANCELLED' ? 'CANCELLATION' : 'DELAY';
    const arrivalDelayMinutes = trip.snapshot?.delayMinutes ?? null;
    return {
      flightNumber: `${first.airlineCode}${first.flightNumber}`,
      origin: first.origin,
      destination: last.destination,
      scheduledDate: formatDate(first.departureDate),
      disruption,
      arrivalDelayMinutes,
      engineInput: {
        disruption,
        carrierIata: first.airlineCode,
        originIata: first.origin,
        finalDestinationIata: last.destination,
        scheduledDepartureUtc: first.scheduledDepartureUtc?.toISOString() ?? null,
        arrivalDelayMinutes,
      },
      storedName: trip.passengers.find((p) => isRealPassengerName(p.name))?.name ?? trip.user?.name ?? null,
    };
  }

  if (input.claimId) {
    const claim = await prisma.compensationClaim.findUnique({
      where: { id: input.claimId },
      include: {
        flightLeg: { include: { trip: { select: { userId: true } } } },
        monitor: { select: { userId: true } },
      },
    });
    const ownerId = claim?.flightLeg?.trip.userId ?? claim?.monitor?.userId ?? null;
    if (!claim || !isOwnedBy({ userId: ownerId }, userId)) return 'not_found';
    const leg = claim.flightLeg;
    if (!leg) return null;
    const arrivalDelayMinutes = claim.delayMinutes ?? null;
    return {
      flightNumber: leg.flightNumber,
      origin: leg.origin,
      destination: leg.destination,
      scheduledDate: leg.scheduledDep ? formatDate(leg.scheduledDep) : 'the scheduled date',
      disruption: 'DELAY',
      arrivalDelayMinutes,
      engineInput: compensationInputFromFlight({
        flightNumber: leg.flightNumber,
        origin: leg.origin,
        destination: leg.destination,
        disruption: 'DELAY',
        arrivalDelayMinutes,
      }),
      storedName: null,
    };
  }

  const details = input.flightDetails;
  if (!details) return null;
  const disruption = details.cancelled ? 'CANCELLATION' : 'DELAY';
  const arrivalDelayMinutes = details.delayHours !== undefined ? Math.round(details.delayHours * 60) : null;
  return {
    flightNumber: details.flightNumber.toUpperCase(),
    origin: details.origin.toUpperCase(),
    destination: details.destination.toUpperCase(),
    scheduledDate: details.scheduledDate ?? 'the scheduled date',
    disruption,
    arrivalDelayMinutes,
    engineInput: compensationInputFromFlight({ ...details, disruption, arrivalDelayMinutes }),
    storedName: null,
  };
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const input = letterSchema.parse(await req.json());

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return withFreemiumGate(user.id, 'compensation_letter', async () => {
      const source = await loadSource(input, user.id);
      if (source === 'not_found') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      if (!source) {
        return NextResponse.json({ error: 'Flight details are required' }, { status: 400 });
      }

      const passengerName = isRealPassengerName(input.passengerName) ? input.passengerName : source.storedName;
      if (!isRealPassengerName(passengerName)) {
        return NextResponse.json(
          { error: 'passenger_name_required', message: 'Enter the passenger name as it appears on the booking.' },
          { status: 422 },
        );
      }

      const compensation = evaluateCompensation(source.engineInput);
      const letter = buildClaimLetter({
        passengerName,
        flightNumber: source.flightNumber,
        origin: source.origin,
        destination: source.destination,
        scheduledDate: source.scheduledDate,
        disruption: source.disruption,
        arrivalDelayMinutes: source.arrivalDelayMinutes,
        compensation,
        today: new Date(),
      });

      if (!letter) {
        return NextResponse.json(
          { error: 'not_likely_eligible', status: compensation.status, reasons: compensation.reasons },
          { status: 422 },
        );
      }

      return new NextResponse(letter, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid claim letter input', issues: error.issues }, { status: 400 });
    }

    console.error('Claim letter generation failed:', error);
    return NextResponse.json({ error: 'Unable to generate claim letter' }, { status: 500 });
  }
}

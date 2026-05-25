import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { withFreemiumGate } from '@/lib/freemium/gate';
import { prisma } from '@/lib/prisma';

const flightDetailsSchema = z.object({
  flightNumber: z.string().min(2).max(12).optional(),
  origin: z.string().length(3).optional(),
  destination: z.string().length(3).optional(),
  scheduledDate: z.string().optional(),
  delayHours: z.number().min(0).optional(),
  compensationAmount: z.number().int().positive().optional(),
  currency: z.enum(['EUR', 'GBP', 'AUD']).optional(),
  regulation: z.string().optional(),
});

const letterSchema = z.object({
  claimId: z.string().min(1).optional(),
  passengerName: z.string().min(2).max(120),
  flightDetails: flightDetailsSchema.optional(),
});

const formatDate = (date: Date) => new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
}).format(date);

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
      const claim = input.claimId
        ? await prisma.compensationClaim.findUnique({
          where: { id: input.claimId },
          include: { flightLeg: true },
        })
        : null;

      const flightLeg = claim?.flightLeg;
      const regulation = input.flightDetails?.regulation ?? claim?.regulation ?? 'EU261/2004';
      const amount = input.flightDetails?.compensationAmount ?? claim?.estimatedAmount ?? null;
      const currency = input.flightDetails?.currency ?? claim?.currency ?? (regulation === 'UK261' ? 'GBP' : 'EUR');
      const delayHours = input.flightDetails?.delayHours
        ?? (claim?.delayMinutes ? Math.round((claim.delayMinutes / 60) * 10) / 10 : null);

      const flightNumber = input.flightDetails?.flightNumber ?? flightLeg?.flightNumber ?? '[FLIGHT_NUMBER]';
      const origin = input.flightDetails?.origin ?? flightLeg?.origin ?? '[ORIGIN]';
      const destination = input.flightDetails?.destination ?? flightLeg?.destination ?? '[DESTINATION]';
      const scheduledDate = input.flightDetails?.scheduledDate
        ?? (flightLeg?.scheduledDep ? formatDate(flightLeg.scheduledDep) : '[SCHEDULED_DATE]');

      const regulationReference = regulation === 'UK261'
        ? 'UK261, the post-Brexit equivalent passenger-rights framework'
        : regulation === 'DGCA'
          ? 'the Australian consumer and airline care framework'
          : 'Regulation (EC) No 261/2004 Article 7';

      const letter = [
        formatDate(new Date()),
        '',
        `Passenger: ${input.passengerName}`,
        '',
        'Dear Customer Relations Team,',
        '',
        `I am writing regarding flight ${flightNumber} from ${origin} to ${destination}, scheduled for ${scheduledDate}.`,
        '',
        `Based on the information currently available, the arrival delay was ${delayHours ?? '[DELAY_HOURS]'} hours. I am therefore requesting compensation of ${amount ? `${currency} ${amount}` : `[COMPENSATION_AMOUNT]`} under ${regulationReference}.`,
        '',
        'This claim is based on reported timing information and the applicable distance band for the journey. If you believe extraordinary circumstances apply, please provide the specific operational evidence relied upon.',
        '',
        'Please arrange payment within 14 days of this letter, or provide a written explanation of your position within the same period.',
        '',
        'If the matter cannot be resolved directly, I reserve the right to escalate the claim to the relevant national enforcement body or alternative dispute resolution body.',
        '',
        'Yours faithfully,',
        input.passengerName,
      ].join('\n');

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

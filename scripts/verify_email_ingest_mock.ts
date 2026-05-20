import { NextRequest } from 'next/server';

import { prisma } from '@/lib/prisma';
import { POST as ingestEmail } from '@/app/api/notifications/email-ingest/route';

async function main() {
  const user = await prisma.user.findFirst({
    select: { id: true, email: true },
    orderBy: { createdAt: 'asc' },
  });

  if (!user?.id) {
    throw new Error('No user found to run mock ingest verification');
  }

  const secret = process.env.EMAIL_INGEST_SECRET || process.env.CRON_SECRET;
  if (!secret) {
    throw new Error('EMAIL_INGEST_SECRET or CRON_SECRET is required for mock verification');
  }

  const rawText = [
    'Subject: Booking confirmation TK23',
    'Passenger: Mock Traveler',
    'PNR: A1B2C3',
    'Flight: TK23',
    'Route: SYD -> IST',
    'Departure: 2026-06-15 21:40',
    'Arrival: 2026-06-16 05:30',
  ].join('\n');

  const request = new NextRequest('http://localhost/api/notifications/email-ingest', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-email-ingest-secret': secret,
    },
    body: JSON.stringify({
      from: user.email,
      rawText,
      userId: user.id,
    }),
  });

  const response = await ingestEmail(request);
  const payload = await response.json();

  console.log('[verify_email_ingest_mock] HTTP', response.status);
  console.log(JSON.stringify(payload, null, 2));

  const tripId = payload?.autoTrack?.tripId as string | undefined;
  if (!tripId) {
    throw new Error('Endpoint did not return tripId in autoTrack payload');
  }

  const trip = await prisma.monitoredTrip.findUnique({
    where: { id: tripId },
    include: { segments: true },
  });

  if (!trip) {
    throw new Error(`Created trip not found in DB: ${tripId}`);
  }

  if (!trip.nextCheckAt || trip.nextCheckAt.getTime() > Date.now() + 5000) {
    throw new Error('nextCheckAt was not set to immediate scheduling window');
  }

  if (!trip.segments.length) {
    throw new Error('No FlightSegment was created for ingested trip');
  }

  console.log('[verify_email_ingest_mock] Created trip and segment successfully');
  console.log('[verify_email_ingest_mock] Worker-ready nextCheckAt:', trip.nextCheckAt.toISOString());
}

main()
  .catch((error) => {
    console.error('[verify_email_ingest_mock] FAILED:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

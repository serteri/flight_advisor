import { prisma } from '../lib/prisma';
import { createSessionCookieValue } from '../lib/auth/magicLinkSession';

const BASE_URL = 'http://localhost:3000';

const run = async () => {
  const trip = await prisma.monitoredTrip.findFirst({
    where: { user: { email: { not: '' } } },
    include: {
      user: true,
      claimRequests: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!trip || !trip.user) {
    throw new Error('No suitable monitored trip with user found for locale verification.');
  }

  if (trip.claimRequests.length > 0) {
    await prisma.claimRequest.update({
      where: { id: trip.claimRequests[0].id },
      data: { status: 'LEGAL_REVIEW' },
    });
  } else {
    await prisma.claimRequest.create({
      data: {
        tripId: trip.id,
        userId: trip.userId,
        fullName: 'Locale QA User',
        email: trip.user.email,
        consentGiven: true,
        status: 'LEGAL_REVIEW',
      },
    });
  }

  const authCookie = `auth_session=${createSessionCookieValue(trip.userId)}`;

  const checks = [
    { locale: 'en', path: '/my-trips', expected: ['Legal review', 'Current stage'] },
    { locale: 'tr', path: '/tr/my-trips', expected: ['Hukuki inceleme', 'Mevcut'] },
    { locale: 'de', path: '/de/my-trips', expected: ['Juristische', 'Aktueller Schritt'] },
  ];

  const results: Array<{ locale: string; status: number; pass: boolean; details: string[] }> = [];

  for (const check of checks) {
    const response = await fetch(`${BASE_URL}${check.path}`, {
      headers: { Cookie: authCookie },
    });

    const html = await response.text();
    const details: string[] = [];
    let pass = response.ok;

    for (const snippet of check.expected) {
      const found = html.includes(snippet);
      details.push(`${snippet}: ${found ? 'found' : 'missing'}`);
      if (!found) pass = false;
    }

    results.push({ locale: check.locale, status: response.status, pass, details });
  }

  console.log(JSON.stringify({ tripId: trip.id, results }, null, 2));

  const allPass = results.every((r) => r.pass);
  await prisma.$disconnect();

  if (!allPass) {
    process.exit(1);
  }
};

run().catch(async (error) => {
  console.error(error.message || error);
  await prisma.$disconnect();
  process.exit(1);
});

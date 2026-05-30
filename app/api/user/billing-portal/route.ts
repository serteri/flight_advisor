import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';

const resolveBaseUrl = () => {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000'
  );
};

const resolveSessionUserId = async () => {
  const session = await auth();
  if (!session?.user) return null;

  if (session.user.id) return session.user.id;
  if (!session.user.email) return null;

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  return user?.id || null;
};

export async function POST() {
  try {
    const userId = await resolveSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        stripeCustomerId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No Stripe customer found for this account' },
        { status: 400 }
      );
    }

    const returnUrl = `${resolveBaseUrl()}/dashboard/settings`;
    const portal = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl,
    });

    return NextResponse.json({ url: portal.url }, { status: 200 });
  } catch (error) {
    console.error('[USER_BILLING_PORTAL] Failed:', error);
    return NextResponse.json({ error: 'Failed to create billing portal session' }, { status: 500 });
  }
}

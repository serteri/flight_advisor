import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';

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

export async function DELETE() {
  try {
    const userId = await resolveSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        stripeSubscriptionId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.stripeSubscriptionId) {
      try {
        await stripe.subscriptions.cancel(user.stripeSubscriptionId);
      } catch (error) {
        console.error('[USER_ACCOUNT_DELETE] Failed to cancel subscription:', error);
        return NextResponse.json(
          { error: 'Failed to cancel active subscription' },
          { status: 502 }
        );
      }
    }

    await prisma.user.delete({
      where: { id: user.id },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[USER_ACCOUNT_DELETE] Failed:', error);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}

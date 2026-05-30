import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

export async function GET() {
  try {
    const userId = await resolveSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        stripeCurrentPeriodEnd: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(
      {
        name: user.name,
        email: user.email,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionStatus: user.subscriptionStatus,
        nextBillingDate: user.stripeCurrentPeriodEnd ? user.stripeCurrentPeriodEnd.toISOString() : null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[USER_PROFILE_GET] Failed:', error);
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await resolveSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json().catch(() => null);
    const name = typeof payload?.name === 'string' ? payload.name.trim() : '';

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { name },
      select: { id: true, name: true, email: true },
    });

    return NextResponse.json(
      {
        success: true,
        user: updated,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[USER_PROFILE_PATCH] Failed:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}

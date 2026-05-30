import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const defaultPreferences = {
  priceDropAlerts: true,
  disruptionAlerts: true,
  weeklySummary: false,
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

export async function GET() {
  try {
    const userId = await resolveSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const prefs = await prisma.notificationPreference.findUnique({
      where: { userId },
      select: {
        priceDropAlerts: true,
        disruptionAlerts: true,
        weeklySummary: true,
      },
    });

    return NextResponse.json(prefs || defaultPreferences, { status: 200 });
  } catch (error) {
    console.error('[USER_PREFERENCES_GET] Failed:', error);
    return NextResponse.json({ error: 'Failed to load preferences' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await resolveSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const parsed = {
      priceDropAlerts: Boolean(payload.priceDropAlerts),
      disruptionAlerts: Boolean(payload.disruptionAlerts),
      weeklySummary: Boolean(payload.weeklySummary),
    };

    const preferences = await prisma.notificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        ...parsed,
      },
      update: parsed,
      select: {
        priceDropAlerts: true,
        disruptionAlerts: true,
        weeklySummary: true,
      },
    });

    return NextResponse.json({ success: true, preferences }, { status: 200 });
  } catch (error) {
    console.error('[USER_PREFERENCES_PATCH] Failed:', error);
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
  }
}

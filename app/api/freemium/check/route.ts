import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { checkLimit } from '@/lib/freemium/usage';
import { FREEMIUM_FEATURES, type FreemiumFeature } from '@/lib/freemium/limits';

export async function GET(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const featureParam = url.searchParams.get('feature');

  if (!featureParam || !FREEMIUM_FEATURES.includes(featureParam as FreemiumFeature)) {
    return NextResponse.json({ error: 'Invalid feature' }, { status: 400 });
  }

  const sessionUser = session.user as {
    isPremium?: boolean;
    plan?: string;
    subscriptionPlan?: string;
  };

  const access = await checkLimit(
    session.user.id,
    featureParam as FreemiumFeature,
    {
      isPremium: sessionUser.isPremium,
      plan: sessionUser.plan,
      subscriptionPlan: sessionUser.subscriptionPlan,
    },
  );

  if (!access.allowed) {
    return NextResponse.json(
      {
        error: 'LIMIT_REACHED',
        feature: featureParam,
        current: access.current,
        limit: access.limit,
        isPro: access.isPro,
        upgradeUrl: '/pricing',
      },
      { status: 402 },
    );
  }

  return NextResponse.json({
    allowed: true,
    feature: featureParam,
    current: access.current,
    limit: access.limit,
    isPro: access.isPro,
  });
}

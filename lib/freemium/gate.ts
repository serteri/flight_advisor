import { NextResponse } from 'next/server';

import type { FreemiumFeature } from '@/lib/freemium/limits';
import { checkLimit, incrementUsage, isMeteredFeature } from '@/lib/freemium/usage';

export async function withFreemiumGate(
  userId: string,
  feature: FreemiumFeature,
  handler: () => Promise<Response>,
): Promise<Response> {
  const access = await checkLimit(userId, feature);

  if (!access.allowed) {
    return NextResponse.json(
      {
        error: 'LIMIT_REACHED',
        feature,
        current: access.current,
        limit: access.limit,
        upgradeUrl: '/pricing',
      },
      { status: 402 },
    );
  }

  const response = await handler();

  if (response.ok && isMeteredFeature(feature)) {
    // Keep usage accounting write failures from breaking successful business actions.
    void incrementUsage(userId, feature).catch((error) => {
      console.error('[FREEMIUM] Failed to increment usage:', { userId, feature, error });
    });
  }

  return response;
}

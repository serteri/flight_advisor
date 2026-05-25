import { prisma } from '@/lib/prisma';
import {
  FEATURE_TO_LIMIT_KEY,
  FREE_TIER_LIMITS,
  PRO_TIER,
  type FreemiumFeature,
} from '@/lib/freemium/limits';

const getCurrentMonthKey = (date = new Date()): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

type FeatureLimit = number | boolean;

const getFeatureLimitForPlan = (
  feature: FreemiumFeature,
  plan: 'free' | 'pro',
): FeatureLimit => {
  const limitKey = FEATURE_TO_LIMIT_KEY[feature];
  return plan === 'pro' ? PRO_TIER[limitKey] : FREE_TIER_LIMITS[limitKey];
};

const toLimitNumber = (limit: FeatureLimit): number => {
  if (typeof limit === 'boolean') {
    return limit ? -1 : 0;
  }

  return limit;
};

export const isMeteredFeature = (feature: FreemiumFeature): boolean => {
  const limit = FREE_TIER_LIMITS[FEATURE_TO_LIMIT_KEY[feature]];
  return typeof limit === 'number';
};

export async function getUserPlan(userId: string): Promise<'free' | 'pro'> {
  const record = await prisma.userPlan.findUnique({
    where: { userId },
    select: {
      plan: true,
      validUntil: true,
    },
  });

  if (!record) return 'free';
  if (record.plan.toLowerCase() !== 'pro') return 'free';
  if (!record.validUntil) return 'free';

  return record.validUntil.getTime() > Date.now() ? 'pro' : 'free';
}

export async function getCurrentUsage(userId: string, feature: FreemiumFeature): Promise<number> {
  const month = getCurrentMonthKey();
  const usage = await prisma.usageRecord.findUnique({
    where: {
      userId_feature_month: {
        userId,
        feature,
        month,
      },
    },
    select: { count: true },
  });

  return usage?.count ?? 0;
}

export async function incrementUsage(userId: string, feature: FreemiumFeature): Promise<number> {
  const month = getCurrentMonthKey();
  const updated = await prisma.usageRecord.upsert({
    where: {
      userId_feature_month: {
        userId,
        feature,
        month,
      },
    },
    create: {
      userId,
      feature,
      month,
      count: 1,
    },
    update: {
      count: {
        increment: 1,
      },
    },
    select: { count: true },
  });

  return updated.count;
}

export async function checkLimit(userId: string, feature: FreemiumFeature): Promise<{
  allowed: boolean;
  current: number;
  limit: number;
  isPro: boolean;
}> {
  const plan = await getUserPlan(userId);
  const isPro = plan === 'pro';

  if (isPro) {
    return {
      allowed: true,
      current: await getCurrentUsage(userId, feature),
      limit: toLimitNumber(getFeatureLimitForPlan(feature, 'pro')),
      isPro: true,
    };
  }

  const current = await getCurrentUsage(userId, feature);
  const rawLimit = getFeatureLimitForPlan(feature, 'free');

  if (typeof rawLimit === 'boolean') {
    return {
      allowed: rawLimit,
      current,
      limit: toLimitNumber(rawLimit),
      isPro: false,
    };
  }

  if (rawLimit === -1) {
    return {
      allowed: true,
      current,
      limit: rawLimit,
      isPro: false,
    };
  }

  return {
    allowed: current < rawLimit,
    current,
    limit: rawLimit,
    isPro: false,
  };
}

export async function isFeatureAllowed(userId: string, feature: FreemiumFeature): Promise<boolean> {
  const result = await checkLimit(userId, feature);
  return result.allowed;
}

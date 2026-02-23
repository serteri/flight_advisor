import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import type Stripe from 'stripe';

const PRICE_TO_PLAN: Record<string, 'PRO' | 'ELITE'> = {};
const registerPrice = (priceId: string | undefined, plan: 'PRO' | 'ELITE') => {
  if (priceId) {
    PRICE_TO_PLAN[priceId] = plan;
  }
};

registerPrice(process.env.STRIPE_PRO_MONTHLY_PRICE_ID, 'PRO');
registerPrice(process.env.STRIPE_PRO_YEARLY_PRICE_ID, 'PRO');
registerPrice(process.env.STRIPE_PRO_TEST_MONTHLY_PRICE_ID, 'PRO');
registerPrice(process.env.STRIPE_PRO_TEST_YEARLY_PRICE_ID, 'PRO');
registerPrice(process.env.STRIPE_ELITE_MONTHLY_PRICE_ID, 'ELITE');
registerPrice(process.env.STRIPE_ELITE_YEARLY_PRICE_ID, 'ELITE');
registerPrice(process.env.STRIPE_ELITE_TEST_MONTHLY_PRICE_ID, 'ELITE');
registerPrice(process.env.STRIPE_ELITE_TEST_YEARLY_PRICE_ID, 'ELITE');

const resolvePlanFromSubscription = (subscription: Stripe.Subscription) => {
  const metadataPlan = subscription.metadata?.plan;
  if (metadataPlan === 'PRO' || metadataPlan === 'ELITE') {
    return metadataPlan;
  }

  const priceItem = subscription.items.data[0]?.price;
  const priceId = typeof priceItem === 'string' ? priceItem : priceItem?.id;
  if (!priceId) {
    return null;
  }

  return PRICE_TO_PLAN[priceId] || null;
};

const pickActiveSubscription = (subscriptions: Stripe.Subscription[]) => {
  const preferredStatuses = new Set(['trialing', 'active', 'past_due']);
  return subscriptions.find((sub) => preferredStatuses.has(sub.status)) || subscriptions[0] || null;
};

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return Response.json(
        { subscriptionPlan: 'FREE', isPremium: false },
        { status: 200 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { subscriptionPlan: true, stripeCustomerId: true, id: true }
    });

    if (!user) {
      return Response.json(
        { subscriptionPlan: 'FREE', isPremium: false },
        { status: 200 }
      );
    }

    const subscriptionPlan = (user.subscriptionPlan as string) || 'FREE';
    if (subscriptionPlan === 'PRO' || subscriptionPlan === 'ELITE') {
      return Response.json(
        { subscriptionPlan, isPremium: true },
        { status: 200 }
      );
    }

    if (!user.stripeCustomerId) {
      return Response.json(
        { subscriptionPlan: 'FREE', isPremium: false },
        { status: 200 }
      );
    }

    const subscriptionList = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: 'all',
      limit: 5
    });

    const subscription = pickActiveSubscription(subscriptionList.data || []);
    if (!subscription) {
      return Response.json(
        { subscriptionPlan: 'FREE', isPremium: false },
        { status: 200 }
      );
    }

    const resolvedPlan = resolvePlanFromSubscription(subscription);
    if (!resolvedPlan) {
      return Response.json(
        { subscriptionPlan: 'FREE', isPremium: false },
        { status: 200 }
      );
    }

    const priceItem = subscription.items.data[0]?.price;
    const priceId = typeof priceItem === 'string' ? priceItem : priceItem?.id;
    const periodEnd = (subscription as any).current_period_end
      ? new Date((subscription as any).current_period_end * 1000)
      : null;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        stripeCurrentPeriodEnd: periodEnd,
        subscriptionPlan: resolvedPlan,
        isPremium: true
      }
    });

    return Response.json(
      { subscriptionPlan: resolvedPlan, isPremium: true },
      { status: 200 }
    );
  } catch (error) {
    console.error('[user-tier] Error:', error);
    return Response.json(
      { subscriptionPlan: 'FREE', isPremium: false },
      { status: 200 }
    );
  }
}

import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

const PRICE_TO_PLAN: Record<string, 'PRO' | 'ELITE'> = {
    [process.env.STRIPE_PRO_MONTHLY_PRICE_ID || '']: 'PRO',
    [process.env.STRIPE_PRO_YEARLY_PRICE_ID || '']: 'PRO',
    [process.env.STRIPE_PRO_TEST_MONTHLY_PRICE_ID || '']: 'PRO',
    [process.env.STRIPE_PRO_TEST_YEARLY_PRICE_ID || '']: 'PRO',
    [process.env.STRIPE_ELITE_MONTHLY_PRICE_ID || '']: 'ELITE',
    [process.env.STRIPE_ELITE_YEARLY_PRICE_ID || '']: 'ELITE',
    [process.env.STRIPE_ELITE_TEST_MONTHLY_PRICE_ID || '']: 'ELITE',
    [process.env.STRIPE_ELITE_TEST_YEARLY_PRICE_ID || '']: 'ELITE',
    [process.env.STRIPE_PRO_PRICE_ID || '']: 'PRO',
    [process.env.STRIPE_ELITE_PRICE_ID || '']: 'ELITE',
};

const resolveCustomerProfile = async (customerId: string | null) => {
    if (!customerId) {
        return null;
    }

    const customer = await stripe.customers.retrieve(customerId);
    if (typeof customer === 'string') {
        return null;
    }

    if ('deleted' in customer && customer.deleted) {
        return null;
    }

    return {
        email: customer.email || null,
        name: customer.name || null,
    };
};

const resolvePlan = (priceId?: string | null, metadataPlan?: string | null) => {
    if (metadataPlan === 'PRO' || metadataPlan === 'ELITE') {
        return metadataPlan;
    }

    if (!priceId) {
        return null;
    }

    return PRICE_TO_PLAN[priceId] || null;
};

const getPriceId = (subscription: Stripe.Subscription) => {
    const priceItem = subscription.items.data[0]?.price;
    if (!priceItem) {
        return null;
    }

    return typeof priceItem === 'string' ? priceItem : priceItem.id;
};

const resolveUserId = async (userId: string | null | undefined, customerId: string | null) => {
    if (userId) {
        return userId;
    }

    if (!customerId) {
        return null;
    }

    const user = await prisma.user.findFirst({
        where: { stripeCustomerId: customerId },
        select: { id: true },
    });

    return user?.id || null;
};

const syncSubscriptionToUser = async (
    subscription: Stripe.Subscription,
    userId: string | null | undefined,
    metadataPlan: string | null
) => {
    const priceId = getPriceId(subscription);
    const plan = resolvePlan(priceId, metadataPlan);

    if (!plan) {
        console.error('[STRIPE_WEBHOOK] Unknown plan for price', priceId);
        throw new Error('Unknown plan');
    }

    const customerId = typeof subscription.customer === 'string' ? subscription.customer : null;
    const customerProfile = await resolveCustomerProfile(customerId);
    const customerEmail = customerProfile?.email || null;

    const updateData = {
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: customerId,
        stripePriceId: priceId,
        stripeCurrentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
        isPremium: true,
        subscriptionPlan: plan,
        subscriptionStatus: subscription.status,
        trialEndsAt: (subscription as any).trial_end
            ? new Date((subscription as any).trial_end * 1000)
            : null,
    };

    if (customerEmail) {
        await prisma.user.upsert({
            where: { email: customerEmail },
            update: {
                ...updateData,
                name: customerProfile?.name || undefined,
            },
            create: {
                email: customerEmail,
                name: customerProfile?.name || null,
                ...updateData,
            },
        });
        return;
    }

    const resolvedUserId = await resolveUserId(userId, customerId);

    if (!resolvedUserId) {
        console.error('[STRIPE_WEBHOOK] User not found for subscription', subscription.id);
        throw new Error('User not found');
    }

    await prisma.user.update({
        where: { id: resolvedUserId },
        data: updateData,
    });
};

export async function POST(req: Request) {
    const body = await req.text();
    const headersList = await headers();
    const signature = headersList.get('Stripe-Signature') as string;

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
    } catch (error: any) {
        return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId = session.subscription as string;

        if (!subscriptionId) {
            return new NextResponse('Subscription ID is missing', { status: 400 });
        }

        try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            await syncSubscriptionToUser(
                subscription,
                session.metadata?.userId || null,
                session.metadata?.plan || null
            );
        } catch (error) {
            console.error('[STRIPE_WEBHOOK] checkout.session.completed update failed', error);
            return new NextResponse('Webhook update failed', { status: 500 });
        }
    }

    if (event.type === 'customer.subscription.created') {
        const subscription = event.data.object as Stripe.Subscription;

        try {
            await syncSubscriptionToUser(
                subscription,
                subscription.metadata?.userId || null,
                subscription.metadata?.plan || null
            );
        } catch (error) {
            console.error('[STRIPE_WEBHOOK] customer.subscription.created update failed', error);
            return new NextResponse('Webhook update failed', { status: 500 });
        }
    }

    if (event.type === 'invoice.paid') {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as any).subscription as string;

        if (!subscriptionId) {
            return new NextResponse('Subscription ID is missing', { status: 400 });
        }

        try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            await syncSubscriptionToUser(subscription, null, null);
        } catch (error) {
            console.error('[STRIPE_WEBHOOK] invoice.paid update failed', error);
            return new NextResponse('Webhook update failed', { status: 500 });
        }
    }

    if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object as Stripe.Subscription;

        await prisma.user.updateMany({
            where: { stripeSubscriptionId: subscription.id },
            data: {
                isPremium: false,
                subscriptionPlan: 'FREE',
                stripeCurrentPeriodEnd: null,
                subscriptionStatus: 'canceled',
                trialEndsAt: null,
            },
        });
    }

    return new NextResponse(null, { status: 200 });
}

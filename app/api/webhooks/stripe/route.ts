import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

const PRICE_TO_PLAN: Record<string, 'PRO' | 'ELITE'> = {
    [process.env.STRIPE_PRO_MONTHLY_PRICE_ID || '']: 'PRO',
    [process.env.STRIPE_PRO_YEARLY_PRICE_ID || '']: 'PRO',
    [process.env.STRIPE_ELITE_MONTHLY_PRICE_ID || '']: 'ELITE',
    [process.env.STRIPE_ELITE_YEARLY_PRICE_ID || '']: 'ELITE',
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

        if (!session?.metadata?.userId) {
            return new NextResponse('User ID is missing in metadata', { status: 400 });
        }

        try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const priceId = getPriceId(subscription);
            const plan = resolvePlan(priceId, session.metadata?.plan || null);

            if (!plan) {
                console.error('[STRIPE_WEBHOOK] Unknown plan for price', priceId);
                return new NextResponse('Unknown plan', { status: 500 });
            }

            await prisma.user.update({
                where: { id: session.metadata.userId },
                data: {
                    stripeSubscriptionId: subscription.id,
                    stripeCustomerId: subscription.customer as string,
                    stripePriceId: priceId,
                    stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
                    isPremium: true,
                    subscriptionPlan: plan,
                },
            });
        } catch (error) {
            console.error('[STRIPE_WEBHOOK] checkout.session.completed update failed', error);
            return new NextResponse('Webhook update failed', { status: 500 });
        }
    }

    if (event.type === 'invoice.paid') {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;

        if (!subscriptionId) {
            return new NextResponse('Subscription ID is missing', { status: 400 });
        }

        try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const priceId = getPriceId(subscription);
            const plan = resolvePlan(priceId, null);

            if (!plan) {
                console.error('[STRIPE_WEBHOOK] Unknown plan for price', priceId);
                return new NextResponse('Unknown plan', { status: 500 });
            }

            await prisma.user.update({
                where: { stripeSubscriptionId: subscription.id },
                data: {
                    stripePriceId: priceId,
                    stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
                    isPremium: true,
                    subscriptionPlan: plan,
                },
            });
        } catch (error) {
            console.error('[STRIPE_WEBHOOK] invoice.paid update failed', error);
            return new NextResponse('Webhook update failed', { status: 500 });
        }
    }

    if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object as Stripe.Subscription;

        await prisma.user.update({
            where: { stripeSubscriptionId: subscription.id },
            data: {
                isPremium: false,
                subscriptionPlan: 'FREE',
                stripeCurrentPeriodEnd: null,
            },
        });
    }

    return new NextResponse(null, { status: 200 });
}

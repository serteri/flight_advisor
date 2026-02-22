import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';

type PlanType = 'PRO' | 'ELITE';
type BillingCycle = 'monthly' | 'yearly';

const PRICE_MAP: Record<PlanType, Record<BillingCycle, string | undefined>> = {
    PRO: {
        monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
        yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID,
    },
    ELITE: {
        monthly: process.env.STRIPE_ELITE_MONTHLY_PRICE_ID,
        yearly: process.env.STRIPE_ELITE_YEARLY_PRICE_ID,
    },
};

function resolveBaseUrl() {
    return (
        process.env.NEXTAUTH_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        'http://localhost:3000'
    );
}

export async function POST(req: Request) {
    try {
        if (process.env.NODE_ENV !== 'production') {
            console.warn('[ENV] NODE_ENV is not production:', process.env.NODE_ENV);
        }

        const session = await auth();
        const user = session?.user;

        if (!user?.id || !user?.email) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const { plan, billingCycle, trial } = (await req.json()) as {
            plan?: PlanType;
            billingCycle?: BillingCycle;
            trial?: boolean;
        };

        if (!plan || !billingCycle) {
            return new NextResponse('Missing plan or billing cycle', { status: 400 });
        }

        console.log('[CHECKOUT_POST]', {
            userId: user.id,
            plan,
            billingCycle,
            trial: trial !== false,
        });

        const priceId = PRICE_MAP[plan]?.[billingCycle];
        if (!priceId) {
            return new NextResponse('Missing Stripe price ID', { status: 400 });
        }

        let stripeCustomerId = await prisma.user
            .findUnique({
                where: { id: user.id },
                select: { stripeCustomerId: true },
            })
            .then((record) => record?.stripeCustomerId);

        if (!stripeCustomerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                name: user.name || undefined,
                metadata: {
                    userId: user.id,
                },
            });

            stripeCustomerId = customer.id;

            await prisma.user.update({
                where: { id: user.id },
                data: { stripeCustomerId },
            });
        }

        const baseUrl = resolveBaseUrl();

        const shouldTrial = trial !== false;
        const subscriptionData: {
            trial_period_days?: number;
            metadata: {
                userId: string;
                plan: PlanType;
                billingCycle: BillingCycle;
                trial: string;
            };
        } = {
            metadata: {
                userId: user.id,
                plan,
                billingCycle,
                trial: shouldTrial ? 'true' : 'false',
            },
        };

        if (shouldTrial) {
            subscriptionData.trial_period_days = 7;
        }

        const checkoutSession = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            mode: 'subscription',
            payment_method_collection: 'always',
            billing_address_collection: 'auto',
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            subscription_data: subscriptionData,
            metadata: {
                userId: user.id,
                plan,
                billingCycle,
                trial: shouldTrial ? 'true' : 'false',
            },
            success_url: `${baseUrl}/dashboard?status=success`,
            cancel_url: `${baseUrl}/pricing?canceled=true`,
        });

        return NextResponse.json({ url: checkoutSession.url });
    } catch (error) {
        console.error('[STRIPE_CHECKOUT]', error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}

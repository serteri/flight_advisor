import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { SUBSCRIPTION_PLANS } from "@/config/subscriptions";

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

function resolvePlanParam(planParam: string | null): PlanType | null {
    if (!planParam) return null;
    const normalized = planParam.toUpperCase();
    if (normalized === 'PRO' || normalized === 'ELITE') {
        return normalized as PlanType;
    }
    return null;
}

export async function GET(req: Request) {
    try {
        const session = await auth();
        const user = session?.user;

        if (!user || !user.email || !user.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const plan = resolvePlanParam(searchParams.get('plan'));
        const cycle = searchParams.get('billingCycle') === 'yearly' ? 'yearly' : 'monthly';
        const trial = searchParams.get('trial') !== 'false';

        if (!plan) {
            return new NextResponse("Missing or invalid plan", { status: 400 });
        }

        const priceId = PRICE_MAP[plan]?.[cycle];
        if (!priceId) {
            return new NextResponse("Missing Stripe price ID", { status: 400 });
        }

        let stripeCustomerId = await prisma.user.findUnique({
            where: { id: user.id },
            select: { stripeCustomerId: true }
        }).then(u => u?.stripeCustomerId);

        if (!stripeCustomerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                name: user.name || undefined,
                metadata: {
                    userId: user.id
                }
            });
            stripeCustomerId = customer.id;

            await prisma.user.update({
                where: { id: user.id },
                data: { stripeCustomerId }
            });
        }

        const baseUrl = resolveBaseUrl();

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
                billingCycle: cycle,
                trial: trial ? 'true' : 'false',
            },
        };

        if (trial) {
            subscriptionData.trial_period_days = 7;
        }

        const checkoutSession = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            mode: "subscription",
            billing_address_collection: "auto",
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
                billingCycle: cycle,
                trial: trial ? 'true' : 'false',
            },
            success_url: `${baseUrl}/dashboard?success=true`,
            cancel_url: `${baseUrl}/pricing?canceled=true`,
        });

        if (!checkoutSession.url) {
            return new NextResponse("Missing checkout URL", { status: 500 });
        }

        return NextResponse.redirect(checkoutSession.url, { status: 303 });
    } catch (error) {
        console.error("[STRIPE_CHECKOUT]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await auth();
        const user = session?.user;

        if (!user || !user.email || !user.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { priceId, planId } = await req.json();

        // Verify the plan exists in our config
        const plan = Object.values(SUBSCRIPTION_PLANS).find(p => p.id === planId);
        if (!plan) {
            return new NextResponse("Invalid Plan", { status: 400 });
        }

        const finalPriceId = priceId || plan.stripePriceId;
        if (!finalPriceId) {
            return new NextResponse("Missing Price ID", { status: 400 });
        }

        const resolvedPlan =
            plan.id === 'guardian'
                ? 'PRO'
                : plan.id === 'elite'
                  ? 'ELITE'
                  : null;

        // Get or create Stripe Customer
        let stripeCustomerId = await prisma.user.findUnique({
            where: { id: user.id },
            select: { stripeCustomerId: true }
        }).then(u => u?.stripeCustomerId);

        if (!stripeCustomerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                name: user.name || undefined,
                metadata: {
                    userId: user.id
                }
            });
            stripeCustomerId = customer.id;

            await prisma.user.update({
                where: { id: user.id },
                data: { stripeCustomerId }
            });
        }

        // Create Checkout Session
        const checkoutSession = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            mode: "subscription",
            billing_address_collection: "auto",
            line_items: [
                {
                    price: finalPriceId,
                    quantity: 1,
                },
            ],
            subscription_data: {
                trial_period_days: 7,
                metadata: {
                    userId: user.id,
                    planId: plan.id,
                    plan: resolvedPlan || '',
                },
            },
            metadata: {
                userId: user.id,
                planId: plan.id,
                plan: resolvedPlan || '',
            },
            success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`,
            cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
        });

        return NextResponse.json({ url: checkoutSession.url });
    } catch (error) {
        console.error("[STRIPE_CHECKOUT]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

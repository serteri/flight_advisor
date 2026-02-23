import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { SUBSCRIPTION_PLANS } from "@/config/subscriptions";

type PlanType = 'PRO' | 'ELITE';
type BillingCycle = 'monthly' | 'yearly';

// Detect Stripe test/live mode from secret key
const isStripeTestMode = (process.env.STRIPE_SECRET_KEY || '').includes('_test_');
const priceIdSuffix = isStripeTestMode ? 'TEST_' : '';

console.log('🔧 [STRIPE CONFIG - GET]', {
    mode: isStripeTestMode ? 'TEST' : 'LIVE',
    suffix: priceIdSuffix,
    secretKeyPrefix: process.env.STRIPE_SECRET_KEY?.substring(0, 15) || 'MISSING',
});

const PRICE_MAP: Record<PlanType, Record<BillingCycle, string | undefined>> = {
    PRO: {
        monthly: process.env[`STRIPE_PRO_${priceIdSuffix}MONTHLY_PRICE_ID`],
        yearly: process.env[`STRIPE_PRO_${priceIdSuffix}YEARLY_PRICE_ID`],
    },
    ELITE: {
        monthly: process.env[`STRIPE_ELITE_${priceIdSuffix}MONTHLY_PRICE_ID`],
        yearly: process.env[`STRIPE_ELITE_${priceIdSuffix}YEARLY_PRICE_ID`],
    },
};

console.log('💰 [PRICE MAP - GET]', {
    PRO_monthly: PRICE_MAP.PRO.monthly || 'MISSING',
    PRO_yearly: PRICE_MAP.PRO.yearly || 'MISSING',
    ELITE_monthly: PRICE_MAP.ELITE.monthly || 'MISSING',
    ELITE_yearly: PRICE_MAP.ELITE.yearly || 'MISSING',
});

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

        console.log('🔐 [AUTH CHECK]', {
            hasSession: !!session,
            hasUser: !!user,
            userId: user?.id || 'N/A',
            userEmail: user?.email || 'N/A',
        });

        if (!user || !user.email || !user.id) {
            console.error('❌ [UNAUTHORIZED] No valid session');
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const plan = resolvePlanParam(searchParams.get('plan'));
        const cycle = searchParams.get('billingCycle') === 'yearly' ? 'yearly' : 'monthly';
        const trial = searchParams.get('trial') !== 'false';

        if (!plan) {
            console.error('❌ [INVALID_PLAN]', { planParam: searchParams.get('plan') });
            return new NextResponse("Missing or invalid plan", { status: 400 });
        }

        const envVarName = `STRIPE_${plan}_${priceIdSuffix}${cycle.toUpperCase()}_PRICE_ID`;
        const priceId = PRICE_MAP[plan]?.[cycle];

        console.log('🚀 [STRIPE_CHECKOUT_GET]', {
            userId: user.id,
            plan,
            billingCycle: cycle,
            trial,
            stripeMode: isStripeTestMode ? 'TEST' : 'LIVE',
            envVarName,
            priceId: priceId || '❌ MISSING',
            priceIdPrefix: priceId?.substring(0, 15) || 'N/A',
        });

        if (!priceId) {
            console.error('❌ [PRICE_ID_MISSING - GET]', {
                plan,
                cycle,
                envVarName,
                availableEnvVars: Object.keys(process.env).filter(k => k.startsWith('STRIPE_')),
            });
            return NextResponse.json(
                {
                    error: 'Stripe Configuration Error',
                    details: `Missing price ID for ${plan} ${cycle}`,
                    expectedEnvVar: envVarName,
                },
                { status: 500 }
            );
        }

        // Verify user exists in database
        console.log('👤 [USER_LOOKUP - GET] Searching for user in database', {
            userId: user.id,
            userEmail: user.email,
        });

        let dbUser;
        try {
            dbUser = await prisma.user.findUnique({
                where: { id: user.id },
                select: { 
                    id: true,
                    email: true,
                    stripeCustomerId: true 
                },
            });
            
            console.log('🔍 [USER_DB_CHECK - GET]', {
                userId: user.id,
                found: !!dbUser,
                hasStripeId: !!dbUser?.stripeCustomerId,
                stripeCustomerId: dbUser?.stripeCustomerId || 'NOT_SET',
            });
        } catch (dbError: any) {
            console.error('❌ [USER_LOOKUP_FAILED - GET]', {
                userId: user.id,
                error: dbError?.message,
            });
            return NextResponse.json(
                {
                    error: 'User lookup failed',
                    details: 'Could not verify user in database',
                },
                { status: 500 }
            );
        }

        if (!dbUser) {
            console.error('❌ [USER_NOT_FOUND - GET]', {
                userId: user.id,
                userEmail: user.email,
            });
            return NextResponse.json(
                {
                    error: 'User not found',
                    details: 'Your account exists but is not properly synced. Please contact support.',
                },
                { status: 404 }
            );
        }

        let stripeCustomerId = dbUser.stripeCustomerId;

        if (!stripeCustomerId) {
            console.log('💳 [STRIPE_CUSTOMER_CREATE - GET] Creating new Stripe customer', {
                userId: user.id,
                userEmail: user.email,
            });

            try {
                const customer = await stripe.customers.create({
                    email: user.email,
                    name: user.name || undefined,
                    metadata: {
                        userId: user.id
                    }
                });

                stripeCustomerId = customer.id;

                console.log('✅ [STRIPE_CUSTOMER_CREATED - GET]', {
                    customerId: stripeCustomerId,
                    userId: user.id,
                });

                // Use upsert to handle edge cases
                await prisma.user.upsert({
                    where: { id: user.id },
                    update: { stripeCustomerId },
                    create: {
                        id: user.id,
                        email: user.email,
                        name: user.name || null,
                        stripeCustomerId,
                    },
                });

                console.log('✅ [USER_UPDATED - GET] Stripe customer ID saved');
            } catch (stripeError: any) {
                console.error('❌ [STRIPE_CUSTOMER_CREATE_FAILED - GET]', {
                    userId: user.id,
                    error: stripeError?.message,
                });
                return NextResponse.json(
                    {
                        error: 'Failed to create Stripe customer',
                        details: stripeError?.message || 'Unknown Stripe error',
                    },
                    { status: 500 }
                );
            }
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

        subscriptionData.trial_period_days = 7;

        const checkoutSession = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            mode: "subscription",
            payment_method_collection: "always",
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

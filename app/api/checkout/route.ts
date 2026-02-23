import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';

type PlanType = 'PRO' | 'ELITE';
type BillingCycle = 'monthly' | 'yearly';

// Detect Stripe test/live mode from secret key
const isStripeTestMode = (process.env.STRIPE_SECRET_KEY || '').includes('_test_');
const priceIdSuffix = isStripeTestMode ? 'TEST_' : '';

console.log('🔧 [STRIPE CONFIG]', {
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

console.log('💰 [PRICE MAP]', {
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

export async function POST(req: Request) {
    try {
        if (process.env.NODE_ENV !== 'production') {
            console.warn('⚠️ [ENV] NODE_ENV is not production:', process.env.NODE_ENV);
        }

        // Database ping to ensure connection
        console.log('🔌 [DB_PING] Checking database connection...');
        try {
            await prisma.$connect();
            console.log('✅ [DB_PING] Database connected');
        } catch (dbError) {
            console.error('❌ [DB_PING_FAILED]', dbError);
            return NextResponse.json(
                { error: 'Database connection failed', details: String(dbError) },
                { status: 500 }
            );
        }

        const session = await auth();
        const user = session?.user;

        console.log('🔐 [AUTH CHECK - POST]', {
            hasSession: !!session,
            hasUser: !!user,
            userId: user?.id || 'N/A',
            userEmail: user?.email || 'N/A',
        });

        if (!user?.id || !user?.email) {
            console.error('❌ [UNAUTHORIZED] No valid session');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { plan, billingCycle, trial } = (await req.json()) as {
            plan?: PlanType;
            billingCycle?: BillingCycle;
            trial?: boolean;
        };

        if (!plan || !billingCycle) {
            return new NextResponse('Missing plan or billing cycle', { status: 400 });
        }

        const envVarName = `STRIPE_${plan}_${priceIdSuffix}${billingCycle.toUpperCase()}_PRICE_ID`;
        const priceId = PRICE_MAP[plan]?.[billingCycle];

        console.log('🚀 [CHECKOUT_POST]', {
            userId: user.id,
            plan,
            billingCycle,
            trial: trial !== false,
            stripeMode: isStripeTestMode ? 'TEST' : 'LIVE',
            envVarName,
            priceId: priceId || '❌ MISSING',
            priceIdPrefix: priceId?.substring(0, 15) || 'N/A',
        });

        if (!priceId) {
            console.error('❌ [PRICE_ID_MISSING]', {
                plan,
                billingCycle,
                envVarName,
                availableEnvVars: Object.keys(process.env).filter(k => k.startsWith('STRIPE_')),
            });
            return NextResponse.json(
                { 
                    error: 'Stripe Configuration Error',
                    details: `Missing price ID for ${plan} ${billingCycle}`,
                    expectedEnvVar: envVarName,
                }, 
                { status: 500 }
            );
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

        console.log('💳 [STRIPE_SESSION_CREATE] About to create checkout session', {
            customer: stripeCustomerId,
            priceId,
            plan,
            billingCycle,
            trial: shouldTrial,
            baseUrl,
        });

        let checkoutSession;
        try {
            checkoutSession = await stripe.checkout.sessions.create({
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
            console.log('✅ [STRIPE_SESSION_CREATED]', {
                sessionId: checkoutSession.id,
                url: checkoutSession.url,
            });
        } catch (stripeError: any) {
            console.error('🚨 [STRIPE_API_ERROR]', {
                message: stripeError?.message,
                type: stripeError?.type,
                code: stripeError?.code,
                param: stripeError?.param,
                priceId,
                stripeCustomerId,
            });
            return NextResponse.json(
                { 
                    error: 'Stripe API Error',
                    details: stripeError?.message || 'Failed to create checkout session',
                    stripeErrorType: stripeError?.type,
                    stripeErrorCode: stripeError?.code,
                },
                { status: 500 }
            );
        }

        return NextResponse.json({ url: checkoutSession.url });
    } catch (error: any) {
        console.error('🚨 [CHECKOUT_SERVER_CRASH]', {
            message: error?.message,
            name: error?.name,
            stack: error?.stack,
            error: error,
        });
        return NextResponse.json(
            { 
                error: error?.message || 'Internal Server Error',
                details: 'Checkout handler crashed unexpectedly',
                errorType: error?.name,
            },
            { status: 500 }
        );
    }
}

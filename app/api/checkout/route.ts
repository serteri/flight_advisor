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

        // Resolve user record by email (self-healing upsert)
        console.log('👤 [USER_LOOKUP] Resolving user via upsert', {
            userId: user.id,
            userEmail: user.email,
            userName: user.name,
        });

        const sessionUserId = user.id;
        const sessionEmail = user.email;
        let dbUser;

        try {
            dbUser = await prisma.user.upsert({
                where: { email: sessionEmail },
                update: {
                    name: user.name ?? undefined,
                    image: user.image ?? undefined,
                },
                create: {
                    email: sessionEmail,
                    name: user.name || null,
                    image: user.image || null,
                },
                select: {
                    id: true,
                    email: true,
                    stripeCustomerId: true,
                },
            });

            if (dbUser.id !== sessionUserId) {
                console.warn('⚠️ [USER_ID_MISMATCH]', {
                    sessionUserId,
                    dbUserId: dbUser.id,
                    userEmail: sessionEmail,
                });
            }

            console.log('🔍 [USER_DB_CHECK]', {
                userId: dbUser.id,
                found: true,
                hasStripeId: !!dbUser.stripeCustomerId,
                stripeCustomerId: dbUser.stripeCustomerId || 'NOT_SET',
            });
        } catch (dbError: any) {
            console.error('❌ [USER_LOOKUP_FAILED]', {
                userId: sessionUserId,
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

        const effectiveUserId = dbUser.id;
        let stripeCustomerId = dbUser.stripeCustomerId;

        if (!stripeCustomerId) {
            console.log('💳 [STRIPE_CUSTOMER_CREATE] Creating new Stripe customer', {
                userId: effectiveUserId,
                userEmail: sessionEmail,
            });

            try {
                const customer = await stripe.customers.create({
                    email: sessionEmail,
                    name: user.name || undefined,
                    metadata: {
                        userId: effectiveUserId,
                    },
                });

                stripeCustomerId = customer.id;

                console.log('✅ [STRIPE_CUSTOMER_CREATED]', {
                    customerId: stripeCustomerId,
                    userId: effectiveUserId,
                });

                // Use upsert to handle edge cases
                console.log('💾 [USER_UPDATE] Saving Stripe customer ID to database', {
                    userId: effectiveUserId,
                    stripeCustomerId,
                });

                await prisma.user.upsert({
                    where: { email: sessionEmail },
                    update: { stripeCustomerId },
                    create: {
                        id: effectiveUserId,
                        email: sessionEmail,
                        name: user.name || null,
                        stripeCustomerId,
                    },
                });

                console.log('✅ [USER_UPDATED] Stripe customer ID saved');
            } catch (stripeError: any) {
                console.error('❌ [STRIPE_CUSTOMER_CREATE_FAILED]', {
                    userId: effectiveUserId,
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
                userId: effectiveUserId,
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
                    userId: effectiveUserId,
                    plan,
                    billingCycle,
                    trial: shouldTrial ? 'true' : 'false',
                },
                success_url: `${baseUrl}/en/dashboard?success=true`,
                cancel_url: `${baseUrl}/en/pricing?canceled=true`,
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

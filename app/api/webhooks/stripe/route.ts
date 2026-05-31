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

const toDateFromUnixSeconds = (value: unknown): Date | null => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        return null;
    }

    const parsed = new Date(value * 1000);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const syncSubscriptionToUser = async (
    subscription: Stripe.Subscription,
    userId: string | null | undefined,
    metadataPlan: string | null
) => {
    console.log('[SYNC] 🔄 Starting sync for subscription:', subscription.id);
    
    const priceId = getPriceId(subscription);
    const plan = resolvePlan(priceId, metadataPlan);

    console.log('[SYNC] 📊 Resolved plan details:', { priceId, plan, metadataPlan });

    if (!plan) {
        console.error('[SYNC] ❌ Unknown plan for price:', priceId);
        throw new Error('Unknown plan');
    }

    const customerId = typeof subscription.customer === 'string' ? subscription.customer : null;
    console.log('[SYNC] 👤 Customer ID:', customerId);
    
    const customerProfile = await resolveCustomerProfile(customerId);
    const customerEmail = customerProfile?.email?.trim().toLowerCase() || null;
    
    console.log('[SYNC] 📧 Customer profile:', { 
        email: customerEmail, 
        name: customerProfile?.name 
    });

    // Build update data with safe date handling
    const currentPeriodEnd = (subscription as any).current_period_end;
    const trialEnd = (subscription as any).trial_end;
    
    const updateData = {
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: customerId,
        stripePriceId: priceId,
        stripeCurrentPeriodEnd:
            toDateFromUnixSeconds(currentPeriodEnd) ||
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        isPremium: true,
        plan,
        subscriptionPlan: plan,
        subscriptionStatus: subscription.status || 'active',
        trialEndsAt: toDateFromUnixSeconds(trialEnd),
    };

    console.log('[SYNC] 💾 Update data prepared:', {
        email: customerEmail,
        plan: updateData.subscriptionPlan,
        status: updateData.subscriptionStatus,
        isPremium: updateData.isPremium,
        periodEnd: updateData.stripeCurrentPeriodEnd,
        trialEnd: updateData.trialEndsAt,
    });

    if (customerEmail) {
        console.log('[SYNC] 🔍 Attempting upsert by email:', customerEmail);
        
        try {
            // First try to find existing user with case-insensitive search
            console.log('[SYNC] 🔎 Searching for existing user in DB');
            const existingUser = await prisma.user.findFirst({
                where: {
                    OR: [
                        { email: customerEmail },
                        { email: { equals: customerEmail, mode: 'insensitive' } }
                    ]
                }
            });

            console.log('[SYNC] 🔎 User search result:', existingUser ? `Found ${existingUser.id}` : 'NOT FOUND');

            if (existingUser) {
                // Update existing user
                console.log('[SYNC] ✏️ Updating existing user:', existingUser.id);
                try {
                    const updatedUser = await prisma.user.update({
                        where: { id: existingUser.id },
                        data: {
                            ...updateData,
                            name: customerProfile?.name || existingUser.name,
                        },
                    });
                    console.log('[WEBHOOK] User updated successfully');
                    console.log('[SYNC] ✅ User UPDATED successfully:', {
                        id: updatedUser.id,
                        plan: updatedUser.subscriptionPlan,
                        isPremium: updatedUser.isPremium,
                    });
                } catch (err) {
                    console.error('[WEBHOOK] DB update failed:', err);
                    throw err;
                }
            } else {
                // Create new user
                console.log('[SYNC] 🆕 Creating new user');
                const newUser = await prisma.user.create({
                    data: {
                        email: customerEmail,
                        name: customerProfile?.name || null,
                        ...updateData,
                    },
                });
                console.log('[SYNC] ✅ User CREATED successfully:', {
                    id: newUser.id,
                    plan: newUser.subscriptionPlan,
                    isPremium: newUser.isPremium,
                });
            }
            return;
        } catch (dbError: any) {
            console.error('[SYNC] ❌ DATABASE ERROR - Email upsert failed:', {
                error: dbError.message,
                code: dbError.code,
                meta: JSON.stringify(dbError.meta),
            });
            throw dbError;
        }
    }

    console.log('[SYNC] 🔎 No customer email, trying to resolve by user ID');
    const resolvedUserId = await resolveUserId(userId, customerId);
    console.log('[SYNC] 🆔 Resolved user ID:', resolvedUserId);

    if (!resolvedUserId) {
        console.error('[SYNC] ❌ User not found for subscription:', subscription.id);
        throw new Error('User not found');
    }

    try {
        console.log('[SYNC] ✏️ Updating user by ID:', resolvedUserId);
        try {
            const updatedUser = await prisma.user.update({
                where: { id: resolvedUserId },
                data: updateData,
            });
            console.log('[WEBHOOK] User updated successfully');
            console.log('[SYNC] ✅ User updated by ID successfully:', {
                id: updatedUser.id,
                plan: updatedUser.subscriptionPlan,
                isPremium: updatedUser.isPremium,
            });
        } catch (err) {
            console.error('[WEBHOOK] DB update failed:', err);
            throw err;
        }
    } catch (dbError: any) {
        console.error('[SYNC] ❌ DATABASE ERROR - User update failed:', {
            userId: resolvedUserId,
            error: dbError.message,
            code: dbError.code,
            meta: JSON.stringify(dbError.meta),
        });
        throw dbError;
    }
};

export async function POST(req: Request) {
    try {
        console.log('[STRIPE_WEBHOOK] 🔔 Webhook request received');
        console.log('[STRIPE_WEBHOOK] 📝 Content-Type:', req.headers.get('content-type'));
        console.log('[STRIPE_WEBHOOK] 🔑 Has Stripe-Signature:', !!req.headers.get('Stripe-Signature'));
        
        // CRITICAL: Use req.text() for raw body to preserve signature verification!
        let body: string;
        try {
            body = await req.text();
            console.log('[STRIPE_WEBHOOK] ✅ Raw body parsed successfully');
            console.log('[STRIPE_WEBHOOK] 📏 Body length:', body.length);
        } catch (error: any) {
            console.error('[STRIPE_WEBHOOK] ❌ Failed to parse body:', error.message);
            return new NextResponse('Failed to parse request body', { status: 400 });
        }

        const headersList = await headers();
        const signature = headersList.get('Stripe-Signature') as string;

        if (!signature) {
            console.error('[STRIPE_WEBHOOK] ❌ Missing Stripe-Signature header');
            return new NextResponse('Missing Stripe-Signature header', { status: 400 });
        }

        console.log('[STRIPE_WEBHOOK] 🔐 Signature header present, verifying...');

        let event: Stripe.Event;

        try {
            const secret = process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_LIVE_WEBHOOK_SECRET;
            if (!secret) {
                console.error('[STRIPE_WEBHOOK] ❌ STRIPE_WEBHOOK_SECRET not configured');
                return new NextResponse('Webhook secret not configured', { status: 500 });
            }

            console.log('[STRIPE_WEBHOOK] 🔑 Secret prefix:', secret.substring(0, 10) + '...');
            
            event = stripe.webhooks.constructEvent(
                body,
                signature,
                secret
            );
            console.log('[STRIPE_WEBHOOK] ✅ Signature verified successfully');
            console.log('[STRIPE_WEBHOOK] 📌 Event type:', event.type);
            console.log('[STRIPE_WEBHOOK] 📅 Event ID:', event.id);
            console.log('[WEBHOOK] Event type:', event.type);
        } catch (error: any) {
            console.error('[STRIPE_WEBHOOK] ❌ Signature verification FAILED:', {
                message: error.message,
                code: error.code,
            });
            return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
        }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId = session.subscription as string;

        console.log('[STRIPE_WEBHOOK] 💳 checkout.session.completed STARTED', {
            sessionId: session.id,
            subscriptionId,
            customerEmail: session.customer_email,
            metadata: session.metadata,
        });
        console.log('[WEBHOOK] Session metadata:', session.metadata);
        console.log('[WEBHOOK] userId:', session.metadata?.userId);
        console.log('[WEBHOOK] plan:', session.metadata?.plan);

        if (!subscriptionId) {
            console.error('[STRIPE_WEBHOOK] ❌ Subscription ID is missing');
            return new NextResponse('Subscription ID is missing', { status: 400 });
        }

        try {
            console.log('[STRIPE_WEBHOOK] 🔄 Fetching subscription from Stripe API');
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            console.log('[STRIPE_WEBHOOK] ✅ Subscription retrieved:', {
                id: subscription.id,
                status: subscription.status,
                customer: subscription.customer,
                trial_end: subscription.trial_end,
                current_period_end: (subscription as any).current_period_end,
            });
            
            console.log('[STRIPE_WEBHOOK] 🔄 Starting syncSubscriptionToUser');
            await syncSubscriptionToUser(
                subscription,
                session.metadata?.userId || null,
                session.metadata?.plan || null
            );
            console.log('[STRIPE_WEBHOOK] ✅ checkout.session.completed COMPLETED SUCCESSFULLY');
            return new NextResponse(null, { status: 200 });
        } catch (error: any) {
            console.error('[STRIPE_WEBHOOK] ❌ checkout.session.completed FAILED:', {
                error: error.message,
                code: error.code,
                stack: error.stack,
            });
            return new NextResponse('Webhook update failed', { status: 500 });
        }
    }

    if (event.type === 'customer.subscription.created') {
        const subscription = event.data.object as Stripe.Subscription;

        console.log('[STRIPE_WEBHOOK] 🆕 customer.subscription.created', {
            subscriptionId: subscription.id,
            status: subscription.status,
            customer: subscription.customer,
            metadata: subscription.metadata,
        });

        try {
            await syncSubscriptionToUser(
                subscription,
                subscription.metadata?.userId || null,
                subscription.metadata?.plan || null
            );
            console.log('[STRIPE_WEBHOOK] ✅ customer.subscription.created sync SUCCESS');
        } catch (error: any) {
            console.error('[STRIPE_WEBHOOK] ❌ customer.subscription.created update failed:', {
                error: error.message,
                stack: error.stack,
            });
            return new NextResponse('Webhook update failed', { status: 500 });
        }
    }

    if (event.type === 'invoice.paid') {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as any).subscription as string;

        console.log('[STRIPE_WEBHOOK] 💰 invoice.paid', {
            invoiceId: invoice.id,
            subscriptionId,
            customer: invoice.customer,
        });

        if (!subscriptionId) {
            console.error('[STRIPE_WEBHOOK] ❌ Subscription ID is missing for invoice');
            return new NextResponse('Subscription ID is missing', { status: 400 });
        }

        try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            await syncSubscriptionToUser(subscription, null, null);
            console.log('[STRIPE_WEBHOOK] ✅ invoice.paid sync SUCCESS');
        } catch (error: any) {
            console.error('[STRIPE_WEBHOOK] ❌ invoice.paid update failed:', {
                error: error.message,
                stack: error.stack,
            });
            return new NextResponse('Webhook update failed', { status: 500 });
        }
    }

    if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object as Stripe.Subscription;

        console.log('[STRIPE_WEBHOOK] 🗑️ customer.subscription.deleted', {
            subscriptionId: subscription.id,
        });

        await prisma.user.updateMany({
            where: { stripeSubscriptionId: subscription.id },
            data: {
                isPremium: false,
                plan: 'FREE',
                subscriptionPlan: 'FREE',
                stripeCurrentPeriodEnd: null,
                subscriptionStatus: 'canceled',
                trialEndsAt: null,
            },
        });

        console.log('[STRIPE_WEBHOOK] ✅ Subscription canceled in DB');
    }

        console.log('[STRIPE_WEBHOOK] ✅ Webhook processed successfully');
        return new NextResponse(null, { status: 200 });
    } catch (outerError: any) {
        console.error('[STRIPE_WEBHOOK] 🚨 CRITICAL ERROR - Uncaught exception:', {
            message: outerError.message,
            stack: outerError.stack,
            code: outerError.code,
        });
        return new NextResponse('Internal server error', { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';

const toDateFromUnixSeconds = (value: unknown): Date | null => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        return null;
    }

    const parsed = new Date(value * 1000);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * Manual subscription sync endpoint
 * GET /api/user/sync-subscription
 * 
 * Forces a sync between Stripe and database for the current user.
 * Useful when webhooks fail or are delayed.
 */
export async function GET() {
    try {
        const session = await auth();
        const user = session?.user;

        if (!user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[MANUAL_SYNC] 🔄 Starting manual sync for user:', user.email);

        // Get user from DB
        const dbUser = await prisma.user.findUnique({
            where: { email: user.email.toLowerCase() },
        });

        if (!dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        console.log('[MANUAL_SYNC] 👤 DB User:', {
            id: dbUser.id,
            email: dbUser.email,
            stripeCustomerId: dbUser.stripeCustomerId,
            currentPlan: dbUser.subscriptionPlan,
        });

        // If no Stripe customer ID, nothing to sync
        if (!dbUser.stripeCustomerId) {
            return NextResponse.json({
                message: 'No Stripe customer ID found',
                plan: dbUser.subscriptionPlan,
                isPremium: dbUser.isPremium,
            });
        }

        // Fetch all subscriptions for this customer
        const subscriptions = await stripe.subscriptions.list({
            customer: dbUser.stripeCustomerId,
            status: 'all', // Get active, trialing, canceled, etc.
            limit: 10,
        });

        console.log('[MANUAL_SYNC] 📦 Found subscriptions:', subscriptions.data.length);

        // Find the active or trialing subscription
        const activeSubscription = subscriptions.data.find(
            (sub) => sub.status === 'active' || sub.status === 'trialing'
        );

        if (!activeSubscription) {
            console.log('[MANUAL_SYNC] ⚠️ No active subscription found, setting to FREE');
            
            await prisma.user.update({
                where: { id: dbUser.id },
                data: {
                    isPremium: false,
                    subscriptionPlan: 'FREE',
                    subscriptionStatus: 'canceled',
                    stripeCurrentPeriodEnd: null,
                    trialEndsAt: null,
                },
            });

            return NextResponse.json({
                message: 'No active subscription found',
                plan: 'FREE',
                isPremium: false,
            });
        }

        console.log('[MANUAL_SYNC] ✅ Active subscription found:', {
            id: activeSubscription.id,
            status: activeSubscription.status,
            trial_end: activeSubscription.trial_end,
        });

        // Determine plan from price ID
        const priceId = activeSubscription.items.data[0]?.price?.id;
        const PRICE_TO_PLAN: Record<string, 'PRO' | 'ELITE'> = {
            [process.env.STRIPE_PRO_MONTHLY_PRICE_ID || '']: 'PRO',
            [process.env.STRIPE_PRO_YEARLY_PRICE_ID || '']: 'PRO',
            [process.env.STRIPE_PRO_TEST_MONTHLY_PRICE_ID || '']: 'PRO',
            [process.env.STRIPE_PRO_TEST_YEARLY_PRICE_ID || '']: 'PRO',
            [process.env.STRIPE_ELITE_MONTHLY_PRICE_ID || '']: 'ELITE',
            [process.env.STRIPE_ELITE_YEARLY_PRICE_ID || '']: 'ELITE',
            [process.env.STRIPE_ELITE_TEST_MONTHLY_PRICE_ID || '']: 'ELITE',
            [process.env.STRIPE_ELITE_TEST_YEARLY_PRICE_ID || '']: 'ELITE',
        };

        const plan = priceId ? PRICE_TO_PLAN[priceId] || null : null;

        if (!plan) {
            console.error('[MANUAL_SYNC] ❌ Unknown plan for price:', priceId);
            return NextResponse.json(
                { error: 'Unknown plan type', priceId },
                { status: 500 }
            );
        }

        // Update user in DB
        const updatedUser = await prisma.user.update({
            where: { id: dbUser.id },
            data: {
                stripeSubscriptionId: activeSubscription.id,
                stripeCustomerId: dbUser.stripeCustomerId,
                stripePriceId: priceId,
                stripeCurrentPeriodEnd:
                    toDateFromUnixSeconds((activeSubscription as any).current_period_end) ||
                    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                isPremium: true,
                subscriptionPlan: plan,
                subscriptionStatus: activeSubscription.status,
                trialEndsAt: toDateFromUnixSeconds((activeSubscription as any).trial_end),
            },
        });

        console.log('[MANUAL_SYNC] ✅ User updated successfully');

        return NextResponse.json({
            message: 'Subscription synced successfully',
            plan: updatedUser.subscriptionPlan,
            isPremium: updatedUser.isPremium,
            status: updatedUser.subscriptionStatus,
            trialEndsAt: updatedUser.trialEndsAt,
        });
    } catch (error: any) {
        console.error('[MANUAL_SYNC] ❌ Error:', error.message);
        return NextResponse.json(
            { error: 'Sync failed', details: error.message },
            { status: 500 }
        );
    }
}

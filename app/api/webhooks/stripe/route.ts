import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

export async function POST(req: Request) {
    const body = await req.text();
    const headersList = await headers();
    const signature = headersList.get('Stripe-Signature') as string;

    let event: Stripe.Event;

    try {
        // 1. Güvenlik: İsteğin gerçekten Stripe'dan geldiğini doğrula
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
    } catch (error: any) {
        return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
    }

    const session = event.data.object as Stripe.Checkout.Session;

    // 2. Ödeme Başarılı Olduysa (subscription.created veya invoice.paid)
    if (event.type === 'checkout.session.completed') {
        const subscriptionData: any = await stripe.subscriptions.retrieve(session.subscription as string);

        if (!session?.metadata?.userId) {
            return new NextResponse('User ID is missing in metadata', { status: 400 });
        }

        // 3. Veritabanını Güncelle: ABONELİĞİ AÇ ✅
        await prisma.user.update({
            where: { id: session.metadata.userId },
            data: {
                stripeSubscriptionId: subscriptionData.id,
                stripeCustomerId: subscriptionData.customer as string,
                stripePriceId: subscriptionData.items.data[0].price.id,
                stripeCurrentPeriodEnd: new Date(subscriptionData.current_period_end * 1000),
                isPremium: true, // ARTIK PREMIUM!
            },
        });

        console.log(`💰 User ${session.metadata.userId} upgraded to Premium!`);
    }

    // 4. Abonelik İptal Edildiyse (customer.subscription.deleted)
    if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object as Stripe.Subscription;

        // Kullanıcıyı bulup premium'u kapat
        const user = await prisma.user.findFirst({
            where: { stripeSubscriptionId: subscription.id }
        });

        if (user) {
            await prisma.user.update({
                where: { id: user.id },
                data: { isPremium: false, stripeCurrentPeriodEnd: null }
            });
            console.log(`💔 User ${user.id} cancelled subscription.`);
        }
    }

    return new NextResponse(null, { status: 200 });
}

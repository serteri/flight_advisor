import { NextResponse } from 'next/server';
import { auth } from '@/auth'; // NextAuth
import { stripe } from '@/lib/stripe'; // Stripe instance
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const session = await auth();

        if (!session?.user || !session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Kullanıcının Stripe ID'si var mı? Yoksa oluştur.
        const user = await prisma.user.findUnique({ where: { id: session.user.id } });

        let stripeCustomerId = user?.stripeCustomerId;

        if (!stripeCustomerId) {
            const customer = await stripe.customers.create({
                email: session.user.email!,
                name: session.user.name || 'Travel Guardian User',
                metadata: { userId: session.user.id! } // Webhook için önemli!
            });
            stripeCustomerId = customer.id;

            // DB'yi güncelle
            await prisma.user.update({
                where: { id: session.user.id! },
                data: { stripeCustomerId }
            });
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';

        // 2. Ödeme Oturumu (Checkout Session) Oluştur
        const stripeSession = await stripe.checkout.sessions.create({
            customer: stripeCustomerId!,
            mode: 'subscription', // Aylık abonelik
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: 'Travel Guardian Premium',
                            description: '7/24 Uçuş Takibi, Tazminat Avcısı ve Upgrade Radar',
                        },
                        unit_amount: 999, // $9.99 (Kuruş cinsinden yazılır)
                        recurring: { interval: 'month' },
                    },
                    quantity: 1,
                },
            ],
            metadata: {
                userId: session.user.id!, // Parayı kimin ödediğini bilmek için
            },
            success_url: `${appUrl}/dashboard?success=true`,
            cancel_url: `${appUrl}/dashboard?canceled=true`,
        });

        return NextResponse.json({ url: stripeSession.url });

    } catch (error) {
        console.error("Stripe Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

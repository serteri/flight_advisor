import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

export async function POST(req: Request) {
    const body = await req.text();
    const signature = (await headers()).get("Stripe-Signature") as string;

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

    if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
        );

        const userId = session?.metadata?.userId;
        if (!userId) {
            return new NextResponse("User ID is missing in metadata", { status: 400 });
        }

        const priceItem = subscription.items.data[0]?.price;
        const priceId = typeof priceItem === 'string' ? priceItem : priceItem?.id;

        if (!priceId) {
            return new NextResponse("Price ID missing", { status: 400 });
        }

        await prisma.user.update({
            where: {
                id: userId,
            },
            data: {
                stripeSubscriptionId: subscription.id,
                stripeCustomerId: subscription.customer as string,
                stripePriceId: priceId,
                stripeCurrentPeriodEnd: new Date(
                    (subscription as any).current_period_end * 1000
                ),
                isPremium: true, // Unlock features
            },
        });
    }

    if (event.type === "invoice.payment_succeeded") {
        const invoice = event.data.object as Stripe.Invoice;
        const subscription = await stripe.subscriptions.retrieve(
            (invoice as any).subscription as string
        );

        const priceItem = subscription.items.data[0]?.price;
        const priceId = typeof priceItem === 'string' ? priceItem : priceItem?.id;

        // Update expiration date on recurring payment
        await prisma.user.update({
            where: {
                stripeSubscriptionId: subscription.id,
            },
            data: {
                stripePriceId: priceId || undefined, // Keep old if missing? Or should strictly be there.
                stripeCurrentPeriodEnd: new Date(
                    (subscription as any).current_period_end * 1000
                ),
                isPremium: true
            },
        });
    }

    // Handle cancellation or payment failure
    if (event.type === "customer.subscription.deleted" || event.type === "customer.subscription.updated") {
        const subscription = event.data.object as Stripe.Subscription;

        // If canceled
        if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
            await prisma.user.update({
                where: { stripeSubscriptionId: subscription.id },
                data: { isPremium: false }
            });
        }
    }

    return new NextResponse(null, { status: 200 });
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { SUBSCRIPTION_PLANS } from "@/config/subscriptions";

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
            metadata: {
                userId: user.id,
                planId: plan.id
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

"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

interface TrackFlightParams {
    from: string;
    to: string;
    departureDate: string;
    returnDate?: string;
    cabin: string;
    initialPrice: number;
    carrier: string;
    currency: string;
}

export async function trackFlight(params: TrackFlightParams) {
    const session = await auth();

    if (!session?.user?.email) {
        return { error: "Please log in to track flights" };
    }

    try {
        // Get/Create User
        let user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    email: session.user.email,
                    name: session.user.name ?? "User",
                }
            });
        }

        // Create Route
        const newRoute = await prisma.route.create({
            data: {
                userId: user.id,
                originCode: params.from,
                destinationCode: params.to,
                startDate: new Date(params.departureDate),
                endDate: params.returnDate ? new Date(params.returnDate) : null,
                cabin: (params.cabin || "ECONOMY") as any,
                currentPrice: params.initialPrice,
            },
        });

        // Create initial price snapshot
        await prisma.priceSnapshot.create({
            data: {
                routeId: newRoute.id,
                provider: params.carrier,
                amount: params.initialPrice,
                currency: params.currency,
                timestamp: new Date(),
            },
        });

        revalidatePath("/dashboard");

        return {
            success: true,
            routeId: newRoute.id,
        };
    } catch (error) {
        console.error('[track-flight] Failed to track flight:', error);
        return { error: "Failed to track flight. Please try again." };
    }
}

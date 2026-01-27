"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function submitFlightSearch(formData: FormData) {
    const session = await auth();

    // For MVP: Even if not logged in, we might want to allow search, but let's enforce auth for tracking
    if (!session?.user?.email) {
        return { error: "Please log in to track flights" };
    }

    const from = (formData.get("from") as string)?.trim().toUpperCase();
    const to = (formData.get("to") as string)?.trim().toUpperCase();
    const departureDate = formData.get("departureDate") as string;
    const returnDate = formData.get("returnDate") as string;
    const cabin = formData.get("cabin") as string;
    const _adults = parseInt(formData.get("adults") as string) || 1;
    const _children = parseInt(formData.get("children") as string) || 0;

    if (!from || !to || !departureDate) {
        return { error: "Missing required fields" };
    }

    // Validate IATA airport codes (must be exactly 3 letters)
    if (!/^[A-Z]{3}$/.test(from)) {
        return { error: `Invalid origin airport code "${from}". Please use 3-letter IATA codes like IST, JFK, LHR` };
    }
    if (!/^[A-Z]{3}$/.test(to)) {
        return { error: `Invalid destination airport code "${to}". Please use 3-letter IATA codes like SYD, JFK, LHR` };
    }

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

    // Save Route to DB
    const newRoute = await prisma.route.create({
        data: {
            userId: user.id,
            originCode: from.toUpperCase(),
            destinationCode: to.toUpperCase(),
            startDate: new Date(departureDate),
            endDate: returnDate ? new Date(returnDate) : null,
            cabin: (cabin || "ECONOMY") as any,
            // Future: Store pax count in a JSON field if needed, schema currently simple
        },
    });

    // Collect initial price snapshot
    let price: number | undefined;
    let currency: string | undefined;
    let carrier: string | undefined;

    try {
        const { collectPriceSnapshot } = await import("@/lib/priceCollector");
        const snapshot = await collectPriceSnapshot(newRoute.id);

        if (snapshot) {
            price = snapshot.amount;
            currency = snapshot.currency;
            // Get carrier from route or snapshot provider
            carrier = snapshot.provider;
        }
    } catch (error) {
        console.error('[submit-search] Failed to collect initial price:', error);
        // Don't fail route creation if price fetch fails
    }

    revalidatePath("/dashboard");
    return {
        success: true,
        price,
        currency,
        carrier,
    };
}

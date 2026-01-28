'use server';

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function deleteWatchedFlight(flightId: string) {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    try {
        await prisma.watchedFlight.delete({
            where: {
                id: flightId,
                userId: session.user.id // Ensure ownership
            }
        });

        revalidatePath("/dashboard");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete watched flight:", error);
        return { success: false, error: "Failed to delete flight" };
    }
}

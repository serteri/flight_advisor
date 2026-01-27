"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function deleteRoute(routeId: string) {
    const session = await auth();

    if (!session?.user?.email) {
        return { error: "Unauthorized - Please log in" };
    }

    try {
        // Verify the route belongs to the user
        const route = await prisma.route.findFirst({
            where: {
                id: routeId,
                user: {
                    email: session.user.email
                }
            }
        });

        if (!route) {
            return { error: "Route not found or access denied" };
        }

        // Delete the route (CASCADE will delete related snapshots and alerts)
        await prisma.route.delete({
            where: { id: routeId }
        });

        revalidatePath("/dashboard");
        return { success: true };
    } catch (error) {
        console.error('[delete-route] Failed:', error);
        return { error: "Failed to delete route" };
    }
}

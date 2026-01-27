import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export default async function DashboardPage() {
    const session = await auth();

    // Middleware yakalamazsa diye ikinci kontrol
    if (!session?.user) redirect("/login");

    // 1. KULLANICININ SEYAHATLERİ (MonitoredTrip - Guardian V2)
    const monitoredTrips = await prisma.monitoredTrip.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: 'desc' },
        include: { alerts: true }
    });

    // 2. TAKİP EDİLEN UÇUŞLAR (WatchedFlight - V1 Tracking)
    // Sadece "benim" eklediklerimi göster
    const trackedFlights = await prisma.watchedFlight.findMany({
        where: { userId: session.user.id, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        take: 20
    });

    return (
        <DashboardClient
            trips={monitoredTrips}
            trackedFlights={trackedFlights}
            user={session.user}
        />
    );
}

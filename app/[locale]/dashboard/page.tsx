import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export default async function DashboardPage({
    searchParams,
}: {
    searchParams: { plan?: string; billingCycle?: string; trial?: string };
}) {
    const session = await auth();

    // Middleware yakalamazsa diye ikinci kontrol
    if (!session?.user) redirect("/login");

    const planParam = searchParams?.plan?.toUpperCase();
    const cycleParam = searchParams?.billingCycle === 'yearly' ? 'yearly' : 'monthly';
    const trialParam = searchParams?.trial !== 'false';

    const dbUser = await prisma.user.findUnique({
        where: { email: session.user.email || '' },
        select: {
            subscriptionPlan: true,
            isPremium: true,
            trialEndsAt: true,
            subscriptionStatus: true,
        },
    });

    if (!dbUser?.isPremium && (planParam === 'PRO' || planParam === 'ELITE')) {
        redirect(`/api/checkout?plan=${planParam}&billingCycle=${cycleParam}&trial=${trialParam ? 'true' : 'false'}`);
    }

    // 1. CLEANUP: Günü geçmiş uçuşları otomatik olarak EXPIRED yap
    // (Örn: Uçuş dün ise ve hala ACTIVE ise, listeden düşür)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    await prisma.watchedFlight.updateMany({
        where: {
            userId: session.user.id,
            status: 'ACTIVE',
            departureDate: { lt: yesterday }
        },
        data: { status: 'EXPIRED' }
    });

    // 2. KULLANICININ SEYAHATLERİ (MonitoredTrip - Guardian V2)
    const monitoredTrips = await prisma.monitoredTrip.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: 'desc' },
        include: { alerts: true }
    });

    // 3. TAKİP EDİLEN UÇUŞLAR (WatchedFlight - V1 Tracking)
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
            user={{
                ...session.user,
                subscriptionPlan: dbUser?.subscriptionPlan || 'FREE',
                isPremium: dbUser?.isPremium || false,
                trialEndsAt: dbUser?.trialEndsAt || null,
                subscriptionStatus: dbUser?.subscriptionStatus || null,
            }}
        />
    );
}

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLocale, getTranslations } from "next-intl/server";
import { ShieldCheck, Plane } from "lucide-react";
import { TravelGuardianDashboard } from "@/components/TravelGuardianDashboard"; // New component
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { GuardianOverviewActions } from "@/components/guardian/GuardianOverviewActions";
import { DeleteTripButton } from "@/components/guardian/DeleteTripButton";
import Link from 'next/link';
import { calculateAirportDistanceKm } from '@/lib/compensation/haversine';

const estimateEu261Value = (trip: Prisma.MonitoredTripGetPayload<{ include: { alerts: true; segments: true; snapshot: true; alertEvents: true } }>) => {
    if (!trip.snapshot?.eu261Eligible) return 0;

    const firstSegment = trip.segments[0];
    if (!firstSegment) return 0;

    const distanceKm = calculateAirportDistanceKm(firstSegment.origin, firstSegment.destination);
    if (!distanceKm) return 0;
    if (distanceKm <= 1500) return 250;
    if (distanceKm <= 3500) return 400;
    return 600;
};

export default async function GuardianDashboard() {
    const locale = await getLocale();
    const t = await getTranslations("GuardianDashboard");
    const session = await auth();

    if (!session?.user?.id) {
        redirect('/login');
    }

    let trips: Prisma.MonitoredTripGetPayload<{ include: { alerts: true; segments: true; snapshot: true; alertEvents: true } }>[] = [];
    try {
        // Fetch only current user's Monitored Trips
        trips = await prisma.monitoredTrip.findMany({
            where: { userId: session.user.id },
            orderBy: { createdAt: 'desc' },
            include: {
                alerts: true,
                segments: { orderBy: { segmentOrder: 'asc' } },
                snapshot: true,
                alertEvents: true,
            }
        });
    } catch (error) {
        console.error('[GUARDIAN_DASHBOARD] Failed to load trips:', error);
        return (
            <div className="p-8 max-w-6xl mx-auto">
                <div className="text-center py-12 bg-red-50 rounded-2xl border border-red-200">
                    <h3 className="text-lg font-medium text-red-900">{t('loadError')}</h3>
                    <p className="text-red-700">{t('tryAgain')}</p>
                </div>
            </div>
        );
    }

    const activeTrips = trips.filter(t => t.status === 'ACTIVE');
    const alertsTotal = trips.reduce((acc, t) => acc + t.alerts.length, 0);
    const estimatedValueFound = activeTrips.reduce((sum, trip) => sum + estimateEu261Value(trip), 0);
    const estimatedValueFoundLabel = estimatedValueFound > 0
        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(estimatedValueFound)
        : '$0';

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8">
            {/* HEADER */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                        <ShieldCheck className="w-8 h-8 text-emerald-600" />
                        {t('title')}
                    </h1>
                    <p className="text-slate-500 mt-1">{t('subtitle')}</p>
                </div>
                <div className="flex gap-4">
                    <Link
                        href={`/${locale}/dashboard/guardian/history`}
                        className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                    >
                        {t('viewHistory')} →
                    </Link>
                    <GuardianOverviewActions
                        user={{
                            id: session.user.id,
                            subscriptionPlan: session.user.subscriptionPlan || 'FREE',
                        }}
                    />
                </div>
            </div>

            {/* KPI CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <p className="text-xs font-semibold text-slate-400 uppercase">{t('kpi.monitoredTrips')}</p>
                    <p className="text-2xl font-bold text-slate-800">{activeTrips.length}</p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <p className="text-xs font-semibold text-slate-400 uppercase">{t('kpi.activeAlerts')}</p>
                    <p className="text-2xl font-bold text-amber-600">{alertsTotal}</p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <p className="text-xs font-semibold text-slate-400 uppercase">{t('kpi.checkInterval')}</p>
                    <p className="text-2xl font-bold text-blue-600">{t('kpi.every6Hours')}</p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <p className="text-xs font-semibold text-slate-400 uppercase">{t('kpi.valueFound')}</p>
                    <p className="text-2xl font-bold text-emerald-600">{estimatedValueFoundLabel}</p>
                </div>
            </div>

            {/* ACTIVE TRIPS */}
            <div className="space-y-6">
                <h2 className="text-xl font-bold text-slate-800">{t('yourTrips')}</h2>

                {trips.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                        <Plane className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                        <h3 className="text-lg font-medium text-slate-900">{t('noTrips')}</h3>
                        <p className="text-slate-500">{t('noTripsDesc')}</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {trips.map(trip => (
                            <div key={trip.id} className="relative">
                                <DeleteTripButton tripId={trip.id} />
                                <Link href={`/${locale}/dashboard/guardian/${trip.id}`} className="block">
                                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200 cursor-pointer hover:shadow-md transition">
                                        {/* Pass trip data to the Dashboard Component we created earlier */}
                                        {/* Need to adapt type if necessary, but structure matches closely */}
                                        <TravelGuardianDashboard trip={trip as any} />
                                    </div>
                                </Link>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ShieldCheck, Plane } from "lucide-react";
import { TravelGuardianDashboard } from "@/components/TravelGuardianDashboard"; // New component
import { Prisma } from "@prisma/client";
import { GuardianOverviewActions } from "@/components/guardian/GuardianOverviewActions";
import { DeleteTripButton } from "@/components/guardian/DeleteTripButton";
import { Link, redirect } from '@/i18n/routing';
import { withLocalSchedules } from '@/lib/guardian/segmentSchedules';
import { splitTrips } from '@/lib/guardian/tripBuckets';
import { alertsSentCount, earliestNextCheck, nextScheduledCheck, tripHasChanges } from '@/lib/guardian/tripPresentation';
import { formatCheckTime } from '@/lib/guardian/checkTimeFormat';
import { getLocale } from 'next-intl/server';

export default async function GuardianDashboard({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);
    const t = await getTranslations("GuardianDashboard");
    const tv = await getTranslations("GuardianV2");
    const session = await auth();

    if (!session || !session.user?.id) {
        redirect({ href: '/login', locale });
    }
    const userId = session!.user!.id;
    const subscriptionPlan = session!.user!.subscriptionPlan || 'FREE';

    type GuardianTrip = Prisma.MonitoredTripGetPayload<{ include: { alerts: true; segments: true; snapshot: true; alertEvents: true; scheduledChecks: { select: { kind: true; runAt: true; status: true } } } }>;
    let trips: GuardianTrip[] = [];
    try {
        // Fetch only current user's Monitored Trips
        trips = await prisma.monitoredTrip.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: {
                alerts: true,
                segments: { orderBy: { segmentOrder: 'asc' } },
                snapshot: true,
                alertEvents: true,
                scheduledChecks: {
                    where: { status: 'SCHEDULED' },
                    select: { kind: true, runAt: true, status: true },
                    orderBy: { runAt: 'asc' },
                },
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

    // Current trips only (same model as /dashboard); finished ones live in history.
    const { current: currentTrips } = splitTrips(trips);
    const activeTrips = currentTrips.filter((trip) => trip.status === 'ACTIVE');
    const now = new Date();
    const tripsWithChanges = activeTrips.filter((trip) => tripHasChanges(trip, now)).length;
    const alertsSent = alertsSentCount(currentTrips);
    const nextPerTrip = activeTrips.map((trip) => ({ id: trip.id, next: nextScheduledCheck(trip.scheduledChecks) }));
    const nextCheck = earliestNextCheck(nextPerTrip.map((entry) => entry.next));
    const nextCheckTripId = nextPerTrip.find((entry) => entry.next && entry.next === nextCheck)?.id;
    const checkLocale = await getLocale();
    const cardTrips = await Promise.all(currentTrips.map(async (trip) => ({ ...trip, segments: await withLocalSchedules(trip.segments) })));
    const nextCheckSegment = cardTrips.find((trip) => trip.id === nextCheckTripId)?.segments[0];

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
                        href="/dashboard/guardian/history"
                        className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                    >
                        {t('viewHistory')} →
                    </Link>
                    <GuardianOverviewActions
                        user={{
                            id: userId,
                            subscriptionPlan,
                        }}
                    />
                </div>
            </div>

            {/* KPI CARDS: Guardian-specific, from current trips only */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <p className="text-xs font-semibold text-slate-400 uppercase">{tv('kpi.activeTrips')}</p>
                    <p className="text-2xl font-bold text-slate-800">{activeTrips.length}</p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <p className="text-xs font-semibold text-slate-400 uppercase">{tv('kpi.tripsWithChanges')}</p>
                    <p className={`text-2xl font-bold ${tripsWithChanges > 0 ? 'text-amber-600' : 'text-slate-800'}`}>{tripsWithChanges}</p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <p className="text-xs font-semibold text-slate-400 uppercase">{tv('kpi.nextCheck')}</p>
                    <p className="text-lg font-bold text-slate-800">
                        {nextCheck ? formatCheckTime(nextCheck.runAt, checkLocale, nextCheckSegment) : tv('kpi.noneScheduled')}
                    </p>
                    {nextCheck?.labelKey && <p className="text-xs text-slate-500">{tv(`checkKind.${nextCheck.labelKey}`)}</p>}
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <p className="text-xs font-semibold text-slate-400 uppercase">{tv('kpi.alertsSent')}</p>
                    <p className="text-2xl font-bold text-slate-800">{alertsSent}</p>
                </div>
            </div>

            {/* ACTIVE TRIPS */}
            <div className="space-y-6">
                <h2 className="text-xl font-bold text-slate-800">{t('yourTrips')}</h2>

                {cardTrips.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                        <Plane className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                        <h3 className="text-lg font-medium text-slate-900">{t('noTrips')}</h3>
                        <p className="text-slate-500">{t('noTripsDesc')}</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {cardTrips.map(trip => (
                            <div key={trip.id} className="relative">
                                <DeleteTripButton tripId={trip.id} />
                                <Link href={`/dashboard/guardian/${trip.id}`} className="block">
                                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200 cursor-pointer hover:shadow-md transition">
                                        {/* Pass trip data to the Dashboard Component we created earlier */}
                                        {/* Need to adapt type if necessary, but structure matches closely */}
                                        <TravelGuardianDashboard trip={trip} />
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

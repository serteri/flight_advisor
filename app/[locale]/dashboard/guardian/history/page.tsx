import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getLocale } from 'next-intl/server';
import { ArrowLeft, CheckCircle2, Clock3, Euro, Plane, ShieldAlert } from 'lucide-react';

const toStatusLabel = (status?: string | null, delayMinutes?: number) => {
    const normalized = (status || '').toLowerCase();
    if (normalized.includes('cancel')) return 'CANCELLED';
    if ((delayMinutes || 0) > 0 || normalized.includes('delay')) return 'DELAYED';
    if (!status || normalized.includes('unknown')) return 'ON_TIME';
    return 'ON_TIME';
};

const statusBadgeClass = (status: string) => {
    if (status === 'CANCELLED') return 'bg-red-100 text-red-700 border-red-200';
    if (status === 'DELAYED') return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
};

const severityBadgeClass = (severity: string) => {
    const normalized = (severity || '').toUpperCase();
    if (normalized === 'HIGH' || normalized === 'CRITICAL') return 'bg-red-100 text-red-700 border-red-200';
    if (normalized === 'MEDIUM') return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
};

const normalizeAlertType = (eventType: string) => {
    const normalized = (eventType || '').toUpperCase();
    if (normalized.includes('DELAY')) return 'DELAY';
    if (normalized.includes('CANCEL')) return 'CANCELLATION';
    if (normalized.includes('GATE')) return 'GATE_CHANGE';
    return normalized;
};

const formatDateTime = (value?: Date | string | null) => {
    if (!value) return 'Unknown';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Unknown';
    return parsed.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
};

const formatDate = (value?: Date | string | null) => {
    if (!value) return 'Unknown';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Unknown';
    return parsed.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

export default async function GuardianHistoryPage() {
    const locale = await getLocale();
    const session = await auth();
    if (!session?.user?.id) {
        redirect('/login');
    }

    const trips = await prisma.monitoredTrip.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: 'desc' },
        include: {
            segments: {
                orderBy: { segmentOrder: 'asc' },
                select: {
                    id: true,
                    segmentOrder: true,
                    airlineCode: true,
                    flightNumber: true,
                    origin: true,
                    destination: true,
                    departureDate: true,
                    arrivalDate: true,
                },
            },
            snapshot: {
                select: {
                    status: true,
                    delayMinutes: true,
                    eu261Eligible: true,
                    snapshotAt: true,
                },
            },
            alertEvents: {
                orderBy: { detectedAt: 'desc' },
                select: {
                    id: true,
                    eventType: true,
                    severity: true,
                    title: true,
                    message: true,
                    detectedAt: true,
                },
            },
        },
    });

    const allEvents = trips
        .flatMap((trip) =>
            trip.alertEvents.map((event) => ({
                ...event,
                tripId: trip.id,
                routeLabel: trip.routeLabel,
            })),
        )
        .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());

    const summary = {
        totalTripsMonitored: trips.length,
        totalDelaysDetected: allEvents.filter((event) => /delay/i.test(event.eventType || '')).length,
        totalHoursDelayed: trips.reduce((sum, trip) => sum + ((trip.snapshot?.delayMinutes || 0) / 60), 0),
        eu261ClaimsGenerated: trips.filter((trip) => Boolean(trip.snapshot?.eu261Eligible)).length,
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
            <div className="max-w-7xl mx-auto px-4 md:px-6 py-10 space-y-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <Link
                            href={`/${locale}/dashboard/guardian`}
                            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-sky-600 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" /> Back to Guardian dashboard
                        </Link>
                        <h1 className="mt-3 text-3xl md:text-4xl font-black text-slate-900">Flight History</h1>
                        <p className="text-slate-500 mt-1">Historical analytics across all monitored trips.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                        <div className="text-xs uppercase tracking-wider font-bold text-slate-500">Total trips monitored</div>
                        <div className="mt-2 text-3xl font-black text-slate-900">{summary.totalTripsMonitored}</div>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                        <div className="text-xs uppercase tracking-wider font-bold text-slate-500">Total delays detected</div>
                        <div className="mt-2 text-3xl font-black text-amber-600">{summary.totalDelaysDetected}</div>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                        <div className="text-xs uppercase tracking-wider font-bold text-slate-500">Total hours delayed</div>
                        <div className="mt-2 text-3xl font-black text-sky-600">{summary.totalHoursDelayed.toFixed(1)}</div>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                        <div className="text-xs uppercase tracking-wider font-bold text-slate-500">EU261 claims generated</div>
                        <div className="mt-2 text-3xl font-black text-emerald-600">{summary.eu261ClaimsGenerated}</div>
                    </div>
                </div>

                <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
                    <div className="flex items-center gap-2">
                        <Plane className="w-5 h-5 text-sky-600" />
                        <h2 className="text-lg font-bold text-slate-900">Trip History</h2>
                    </div>
                    {trips.length === 0 ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                            No monitored trip history yet.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
                                        <th className="py-3 pr-4">Route</th>
                                        <th className="py-3 pr-4">Flight</th>
                                        <th className="py-3 pr-4">Date</th>
                                        <th className="py-3 pr-4">Status</th>
                                        <th className="py-3 pr-4">Delay</th>
                                        <th className="py-3 pr-4">EU261 Eligible</th>
                                        <th className="py-3 pr-4">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {trips.map((trip) => {
                                        const firstSegment = trip.segments[0];
                                        const lastSegment = trip.segments[trip.segments.length - 1];
                                        const status = toStatusLabel(trip.snapshot?.status, trip.snapshot?.delayMinutes || 0);
                                        return (
                                            <tr key={trip.id} className="border-b border-slate-100 align-top">
                                                <td className="py-3 pr-4 font-semibold text-slate-900">
                                                    {firstSegment && lastSegment
                                                        ? `${firstSegment.origin} → ${lastSegment.destination}`
                                                        : trip.routeLabel}
                                                </td>
                                                <td className="py-3 pr-4 text-slate-700">
                                                    {firstSegment
                                                        ? `${firstSegment.airlineCode}${firstSegment.flightNumber}`
                                                        : 'Unknown'}
                                                </td>
                                                <td className="py-3 pr-4 text-slate-700">{formatDate(firstSegment?.departureDate)}</td>
                                                <td className="py-3 pr-4">
                                                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${statusBadgeClass(status)}`}>
                                                        {status}
                                                    </span>
                                                </td>
                                                <td className="py-3 pr-4 text-slate-700">{trip.snapshot?.delayMinutes ?? 0} min</td>
                                                <td className="py-3 pr-4">
                                                    {trip.snapshot?.eu261Eligible ? (
                                                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                                                            Yes
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                                                            No
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 pr-4">
                                                    <Link
                                                        href={`/${locale}/dashboard/guardian/${trip.id}`}
                                                        className="text-sky-700 hover:text-sky-800 font-semibold"
                                                    >
                                                        View trip
                                                    </Link>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
                    <div className="flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-amber-600" />
                        <h2 className="text-lg font-bold text-slate-900">Disruption Timeline</h2>
                    </div>
                    {allEvents.length === 0 ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                            No alert events have been recorded yet.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {allEvents.map((event) => (
                                <div key={event.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                                            <Clock3 className="w-3.5 h-3.5" /> {formatDateTime(event.detectedAt)}
                                        </span>
                                        <span className="text-slate-300">•</span>
                                        <span className="text-sm font-semibold text-slate-900">{event.routeLabel}</span>
                                        <span className="text-slate-300">•</span>
                                        <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-700">
                                            {normalizeAlertType(event.eventType)}
                                        </span>
                                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${severityBadgeClass(event.severity)}`}>
                                            {event.severity}
                                        </span>
                                    </div>
                                    <div className="mt-2 text-sm text-slate-700">{event.title}: {event.message}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}

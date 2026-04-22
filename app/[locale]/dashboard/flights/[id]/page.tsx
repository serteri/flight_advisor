import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Link } from '@/i18n/routing';
import { notFound } from 'next/navigation';
import {
    ArrowLeft,
    ArrowRight,
    Bell,
    CheckCircle2,
    Clock,
    Plane,
    AlertTriangle,
    Minus,
    TrendingDown,
    TrendingUp,
    ShieldAlert,
} from 'lucide-react';

type PriceHistoryEntry = {
    date?: string;
    price?: number;
    source?: string;
    trackingType?: string;
    scoreSnapshot?: {
        recommendation?: 'BUY' | 'WAIT' | 'WATCH';
        confidence?: number;
        primaryReason?: string;
        positiveFactor?: string | null;
        negativeFactor?: string | null;
        missingFactor?: string | null;
        actionHint?: string;
        dataSourceType?: 'USER_PASTED_ITINERARY';
        realTimeDataAvailable?: boolean;
    };
    trackingState?: {
        status?: string;
        waitingForNextSnapshot?: boolean;
        limitedData?: boolean;
        realTimeDataUnavailable?: boolean;
        importantChanged?: boolean;
    };
};

type Segment = {
    from: string;
    to: string;
    departureDateTime?: string;
    arrivalDateTime?: string;
    departure?: string;
    arrival?: string;
    airline?: string;
    carrier?: string;
    flightNumber: string;
    duration?: number;
};

const formatMoney = (amount: number, currency: string): string => {
    return `${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
};

const formatPercent = (value: number): string => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
};

const formatDateTime = (value?: string | Date | null): string => {
    if (!value) return 'Unknown';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
};

const formatDuration = (minutes?: number | null): string => {
    if (!minutes || minutes <= 0) return 'Unknown';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
};

export default async function TrackedItineraryDetailPage({
    params,
}: {
    params: Promise<{ locale: string; id: string }>;
}) {
    const { locale, id } = await params;
    const session = await auth();

    if (!session?.user?.email) {
        notFound();
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
    });

    if (!user) {
        notFound();
    }

    const watchedFlight = await prisma.watchedFlight.findFirst({
        where: {
            id,
            userId: user.id,
        },
    });

    if (!watchedFlight) {
        notFound();
    }

    const history = Array.isArray(watchedFlight.priceHistory)
        ? watchedFlight.priceHistory as unknown as PriceHistoryEntry[]
        : [];
    const latestHistory = history[history.length - 1] || null;
    const scoreSnapshot = latestHistory?.scoreSnapshot;
    const trackingState = latestHistory?.trackingState;
    const segments = Array.isArray(watchedFlight.segments)
        ? watchedFlight.segments as unknown as Segment[]
        : [];

    const currentPrice = watchedFlight.currentPrice ?? watchedFlight.initialPrice;
    const changeAmount = currentPrice - watchedFlight.initialPrice;
    const changePercent = watchedFlight.initialPrice > 0
        ? (changeAmount / watchedFlight.initialPrice) * 100
        : 0;
    const hasImportantChange = Boolean(trackingState?.importantChanged) || Math.abs(changePercent) >= 5;
    const latestUpdateAt = watchedFlight.lastChecked || watchedFlight.updatedAt || watchedFlight.createdAt;
    const realTimeUnavailable = scoreSnapshot?.realTimeDataAvailable === false || trackingState?.realTimeDataUnavailable;

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
            <div className="max-w-6xl mx-auto px-4 md:px-6 py-10 space-y-6">
                <Link href={`/${locale}/dashboard/tracked-flights`} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-sky-600 transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back to tracked itineraries
                </Link>

                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-6">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-12 h-12 rounded-2xl bg-sky-100 flex items-center justify-center">
                                    <Bell className="w-6 h-6 text-sky-700" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Tracked itinerary</p>
                                    <h1 className="text-2xl md:text-3xl font-black text-slate-900">
                                        {watchedFlight.origin} <span className="text-slate-300">→</span> {watchedFlight.destination}
                                    </h1>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                                <span>{formatDateTime(watchedFlight.departureDate)}</span>
                                <span className="text-slate-300">•</span>
                                <span>{watchedFlight.airline}</span>
                                <span className="text-slate-300">•</span>
                                <span>{watchedFlight.flightNumber}</span>
                                <span className="text-slate-300">•</span>
                                <span>{watchedFlight.cabin || 'Unknown cabin'}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 min-w-full lg:min-w-[340px]">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-1">Current tracked price</div>
                                <div className="text-2xl font-black text-slate-900">{formatMoney(currentPrice, watchedFlight.currency)}</div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-1">Price at creation</div>
                                <div className="text-2xl font-black text-slate-900">{formatMoney(watchedFlight.initialPrice, watchedFlight.currency)}</div>
                            </div>
                        </div>
                    </div>

                    {realTimeUnavailable && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                            <div className="font-semibold mb-1">Real-time data unavailable</div>
                            <p>This itinerary is currently tracked from your scored itinerary snapshot, not live provider pricing.</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        <div className="rounded-2xl border border-slate-200 p-4">
                            <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-1">Price movement</div>
                            <div className="flex items-center gap-2 text-lg font-bold">
                                {changeAmount < 0 && <TrendingDown className="w-4 h-4 text-emerald-600" />}
                                {changeAmount > 0 && <TrendingUp className="w-4 h-4 text-red-600" />}
                                {changeAmount === 0 && <Minus className="w-4 h-4 text-slate-400" />}
                                <span className={changeAmount < 0 ? 'text-emerald-600' : changeAmount > 0 ? 'text-red-600' : 'text-slate-700'}>
                                    {changeAmount > 0 ? '+' : ''}{formatMoney(changeAmount, watchedFlight.currency)}
                                </span>
                            </div>
                            <div className="text-sm text-slate-500 mt-1">{formatPercent(changePercent)} since tracking started</div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 p-4">
                            <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-1">Latest recommendation</div>
                            <div className="text-lg font-black text-slate-900">{scoreSnapshot?.recommendation || 'WATCH'}</div>
                            <div className="text-sm text-slate-500 mt-1">Current confidence: {scoreSnapshot?.confidence ?? 'Unknown'}%</div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 p-4">
                            <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-1">Tracking state</div>
                            <div className="flex flex-wrap gap-2 mt-2">
                                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">{trackingState?.status || watchedFlight.status}</span>
                                {trackingState?.waitingForNextSnapshot && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">Waiting for next snapshot</span>}
                                {trackingState?.limitedData && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Limited data</span>}
                                {realTimeUnavailable && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">Using itinerary snapshot</span>}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 p-4">
                            <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-1">Latest update</div>
                            <div className="text-lg font-bold text-slate-900">{formatDateTime(latestUpdateAt)}</div>
                            <div className="text-sm text-slate-500 mt-1">{hasImportantChange ? 'Important change detected' : 'No major change yet'}</div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Plane className="w-5 h-5 text-sky-600" />
                                <h2 className="text-lg font-bold text-slate-900">Itinerary summary</h2>
                            </div>
                            <div className="space-y-3">
                                {segments.length > 0 ? segments.map((segment, index) => {
                                    const departure = segment.departureDateTime || segment.departure;
                                    const arrival = segment.arrivalDateTime || segment.arrival;
                                    return (
                                        <div key={`${segment.flightNumber}-${index}`} className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                                <div>
                                                    <div className="text-sm font-bold text-slate-900">
                                                        {segment.from} <ArrowRight className="inline w-4 h-4 text-slate-400" /> {segment.to}
                                                    </div>
                                                    <div className="text-sm text-slate-500 mt-1">
                                                        {(segment.airline || segment.carrier || 'Unknown airline')} • {segment.flightNumber}
                                                    </div>
                                                </div>
                                                <div className="text-sm text-slate-600">
                                                    <div>Departure: {formatDateTime(departure)}</div>
                                                    <div>Arrival: {formatDateTime(arrival)}</div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }) : (
                                    <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-500">Segment details are not available yet.</div>
                                )}
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                <h2 className="text-lg font-bold text-slate-900">Explanation summary</h2>
                            </div>
                            <div>
                                <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-1">Primary reason</div>
                                <p className="text-sm text-slate-800">{scoreSnapshot?.primaryReason || 'This itinerary is being monitored from the last scored snapshot.'}</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                                    <div className="text-xs uppercase tracking-wider font-bold text-emerald-700 mb-1">Top positive factor</div>
                                    <p className="text-sm text-emerald-900">{scoreSnapshot?.positiveFactor || 'No strong positive factor captured yet.'}</p>
                                </div>
                                <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                                    <div className="text-xs uppercase tracking-wider font-bold text-red-700 mb-1">Top negative factor</div>
                                    <p className="text-sm text-red-900">{scoreSnapshot?.negativeFactor || 'No major negative factor recorded yet.'}</p>
                                </div>
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                    <div className="text-xs uppercase tracking-wider font-bold text-amber-700 mb-1">Top missing factor</div>
                                    <p className="text-sm text-amber-900">{scoreSnapshot?.missingFactor || 'No missing factor recorded.'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <ShieldAlert className="w-5 h-5 text-amber-600" />
                                <h2 className="text-lg font-bold text-slate-900">Status summary</h2>
                            </div>
                            <ul className="space-y-3 text-sm text-slate-700">
                                <li className="flex items-start gap-2">
                                    <Clock className="w-4 h-4 mt-0.5 text-slate-400" />
                                    <span>{trackingState?.waitingForNextSnapshot ? 'Tracking is active and waiting for the next comparison snapshot.' : 'Tracking is active.'}</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 mt-0.5 text-slate-400" />
                                    <span>{trackingState?.limitedData ? 'This itinerary has limited follow-up data so far.' : 'Tracking data coverage is healthy.'}</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <Bell className="w-4 h-4 mt-0.5 text-slate-400" />
                                    <span>{hasImportantChange ? 'Something important changed since tracking started.' : 'Nothing materially changed since tracking started.'}</span>
                                </li>
                                {realTimeUnavailable && (
                                    <li className="flex items-start gap-2 text-amber-800">
                                        <ShieldAlert className="w-4 h-4 mt-0.5 text-amber-600" />
                                        <span>Real-time pricing data is unavailable; current status is based on the tracked itinerary snapshot.</span>
                                    </li>
                                )}
                            </ul>
                        </div>

                        <div className="bg-slate-900 rounded-3xl p-6 text-white">
                            <div className="text-xs uppercase tracking-wider font-bold text-sky-300 mb-2">Next step</div>
                            <p className="text-sm text-slate-200 leading-relaxed">
                                {scoreSnapshot?.actionHint || 'Keep tracking this itinerary and compare it against newer price observations before booking.'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

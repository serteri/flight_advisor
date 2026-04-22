import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Link } from '@/i18n/routing';
import { PromoteTrackedItineraryButton } from '@/components/guardian/PromoteTrackedItineraryButton';
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
        promotedTripId?: string;
        promotedAt?: string;
        bookingDataEstimated?: boolean;
        missingBookingFields?: string[];
    };
};

type ChangeType =
    | 'PRICE_DROP'
    | 'PRICE_RISE'
    | 'RECOMMENDATION_CHANGED'
    | 'CONFIDENCE_DROP'
    | 'RISK_INCREASED'
    | 'DATA_QUALITY_DROP'
    | 'NO_SIGNIFICANT_CHANGE';

type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

type ChangeSummaryRow = {
    label: string;
    type: ChangeType;
    message: string;
    significant: boolean;
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

const toRiskScore = (
    snapshot?: PriceHistoryEntry['scoreSnapshot'] | null,
    state?: PriceHistoryEntry['trackingState'] | null,
): number => {
    if (!snapshot) return 2;

    let score = 0;

    if (snapshot.recommendation === 'WAIT') score += 2;
    else if (snapshot.recommendation === 'WATCH') score += 1;

    if (typeof snapshot.confidence === 'number') {
        if (snapshot.confidence < 55) score += 2;
        else if (snapshot.confidence < 70) score += 1;
    }

    if (snapshot.missingFactor) score += 1;
    if (state?.limitedData) score += 1;
    if (snapshot.realTimeDataAvailable === false || state?.realTimeDataUnavailable) score += 1;

    return score;
};

const toRiskLevel = (
    snapshot?: PriceHistoryEntry['scoreSnapshot'] | null,
    state?: PriceHistoryEntry['trackingState'] | null,
): RiskLevel => {
    const score = toRiskScore(snapshot, state);
    if (score >= 4) return 'HIGH';
    if (score >= 2) return 'MEDIUM';
    return 'LOW';
};

const riskRank: Record<RiskLevel, number> = {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
};

const isBaggageRelated = (value?: string | null): boolean => {
    if (!value) return false;
    return /(baggage|bag|checked|cabin)/i.test(value);
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
    const firstHistory = history[0] || null;
    const latestHistory = history[history.length - 1] || null;
    const promotionHistory = [...history].reverse().find((entry) => Boolean(entry?.trackingState?.promotedTripId)) || null;
    const initialSnapshot = firstHistory?.scoreSnapshot || null;
    const scoreSnapshot = latestHistory?.scoreSnapshot;
    const initialTrackingState = firstHistory?.trackingState || null;
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
    const promotedTripId = promotionHistory?.trackingState?.promotedTripId || null;
    const promotedAt = promotionHistory?.trackingState?.promotedAt || null;
    const isPromotedToBooked = watchedFlight.status === 'BOUGHT' || Boolean(promotedTripId);

    const initialRecommendation = initialSnapshot?.recommendation || scoreSnapshot?.recommendation || 'WATCH';
    const currentRecommendation = scoreSnapshot?.recommendation || initialRecommendation;
    const recommendationChanged = initialRecommendation !== currentRecommendation;

    const initialConfidence = typeof initialSnapshot?.confidence === 'number'
        ? initialSnapshot.confidence
        : null;
    const currentConfidence = typeof scoreSnapshot?.confidence === 'number'
        ? scoreSnapshot.confidence
        : null;
    const confidenceDelta = initialConfidence !== null && currentConfidence !== null
        ? currentConfidence - initialConfidence
        : null;

    const initialRiskLevel = toRiskLevel(initialSnapshot, initialTrackingState);
    const currentRiskLevel = toRiskLevel(scoreSnapshot, trackingState);
    const riskIncreased = riskRank[currentRiskLevel] > riskRank[initialRiskLevel];

    const initialMissingFactor = initialSnapshot?.missingFactor || null;
    const currentMissingFactor = scoreSnapshot?.missingFactor || null;
    const newMissingIssue = Boolean(currentMissingFactor && currentMissingFactor !== initialMissingFactor);
    const limitedDataWorsened = !initialTrackingState?.limitedData && Boolean(trackingState?.limitedData);
    const realtimeWorsened = initialSnapshot?.realTimeDataAvailable !== false && scoreSnapshot?.realTimeDataAvailable === false;
    const dataQualityDropped = newMissingIssue || limitedDataWorsened || realtimeWorsened;

    const confidenceDropReason = confidenceDelta !== null && confidenceDelta < -0.5 && isBaggageRelated(currentMissingFactor) && !isBaggageRelated(initialMissingFactor)
        ? ' Confidence fell because baggage data is no longer available.'
        : '';

    const changeSummaryRows: ChangeSummaryRow[] = [
        changeAmount < 0
            ? {
                label: 'Price',
                type: 'PRICE_DROP',
                message: `Price dropped by ${formatMoney(Math.abs(changeAmount), watchedFlight.currency)} since you started tracking.`,
                significant: true,
            }
            : changeAmount > 0
                ? {
                    label: 'Price',
                    type: 'PRICE_RISE',
                    message: `Price increased by ${formatMoney(changeAmount, watchedFlight.currency)} since you started tracking.`,
                    significant: true,
                }
                : {
                    label: 'Price',
                    type: 'NO_SIGNIFICANT_CHANGE',
                    message: 'Price is unchanged since you started tracking.',
                    significant: false,
                },
        recommendationChanged
            ? {
                label: 'Recommendation',
                type: 'RECOMMENDATION_CHANGED',
                message: `Recommendation changed from ${initialRecommendation} to ${currentRecommendation}.`,
                significant: true,
            }
            : {
                label: 'Recommendation',
                type: 'NO_SIGNIFICANT_CHANGE',
                message: `Recommendation is unchanged at ${currentRecommendation}.`,
                significant: false,
            },
        confidenceDelta !== null && confidenceDelta < -0.5
            ? {
                label: 'Confidence',
                type: 'CONFIDENCE_DROP',
                message: `Confidence fell by ${Math.abs(confidenceDelta).toFixed(1)} points since tracking started.${confidenceDropReason}`,
                significant: true,
            }
            : confidenceDelta !== null && confidenceDelta > 0.5
                ? {
                    label: 'Confidence',
                    type: 'NO_SIGNIFICANT_CHANGE',
                    message: `Confidence increased by ${confidenceDelta.toFixed(1)} points since tracking started.`,
                    significant: false,
                }
                : {
                    label: 'Confidence',
                    type: 'NO_SIGNIFICANT_CHANGE',
                    message: 'Confidence is effectively unchanged since tracking started.',
                    significant: false,
                },
        riskIncreased
            ? {
                label: 'Risk level',
                type: 'RISK_INCREASED',
                message: `Risk level increased from ${initialRiskLevel} to ${currentRiskLevel}.`,
                significant: true,
            }
            : {
                label: 'Risk level',
                type: 'NO_SIGNIFICANT_CHANGE',
                message: `Risk level is ${currentRiskLevel}${currentRiskLevel !== initialRiskLevel ? ` (was ${initialRiskLevel})` : ''}.`,
                significant: false,
            },
        dataQualityDropped
            ? {
                label: 'Data quality',
                type: 'DATA_QUALITY_DROP',
                message: newMissingIssue
                    ? `New missing-data issue detected: ${currentMissingFactor}.`
                    : realtimeWorsened
                        ? 'Data quality dropped because live/real-time availability was reduced.'
                        : 'Data quality dropped due to limited follow-up tracking data.',
                significant: true,
            }
            : {
                label: 'Data quality',
                type: 'NO_SIGNIFICANT_CHANGE',
                message: 'No new missing-data or quality issue detected.',
                significant: false,
            },
    ];

    const significantChangeCount = changeSummaryRows.filter((row) => row.significant).length;
    const summaryHeadline = significantChangeCount > 0
        ? `${significantChangeCount} meaningful change${significantChangeCount > 1 ? 's' : ''} detected since tracking started.`
        : 'No major change since your last snapshot.';

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
                                {isPromotedToBooked && (
                                    <>
                                        <span className="text-slate-300">•</span>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Booked / promoted</span>
                                    </>
                                )}
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
                                {isPromotedToBooked && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">Promoted to Guardian</span>}
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

                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-1">Change summary</div>
                            <h2 className="text-xl font-black text-slate-900">What changed since tracking started</h2>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${significantChangeCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>
                            {significantChangeCount > 0 ? 'Changes detected' : 'Stable'}
                        </span>
                    </div>
                    <p className="text-sm text-slate-600">{summaryHeadline}</p>
                    <div className="space-y-3">
                        {changeSummaryRows.map((row) => (
                            <div key={row.label} className="rounded-2xl border border-slate-200 p-4 bg-slate-50 flex items-start gap-3">
                                {row.type === 'PRICE_DROP' && <TrendingDown className="w-4 h-4 mt-0.5 text-emerald-600" />}
                                {row.type === 'PRICE_RISE' && <TrendingUp className="w-4 h-4 mt-0.5 text-red-600" />}
                                {(row.type === 'CONFIDENCE_DROP' || row.type === 'DATA_QUALITY_DROP' || row.type === 'RISK_INCREASED') && <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600" />}
                                {row.type === 'RECOMMENDATION_CHANGED' && <Bell className="w-4 h-4 mt-0.5 text-sky-600" />}
                                {row.type === 'NO_SIGNIFICANT_CHANGE' && <Minus className="w-4 h-4 mt-0.5 text-slate-400" />}
                                <div>
                                    <div className="text-xs uppercase tracking-wider font-bold text-slate-500">{row.label} • {row.type}</div>
                                    <p className="text-sm text-slate-800 mt-1">{row.message}</p>
                                </div>
                            </div>
                        ))}
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
                                    <span>{isPromotedToBooked ? 'This itinerary is promoted to booked-trip monitoring.' : trackingState?.waitingForNextSnapshot ? 'Tracking is active and waiting for the next comparison snapshot.' : 'Tracking is active.'}</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 mt-0.5 text-slate-400" />
                                    <span>{trackingState?.limitedData ? 'This itinerary has limited follow-up data so far.' : 'Tracking data coverage is healthy.'}</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <Bell className="w-4 h-4 mt-0.5 text-slate-400" />
                                    <span>{hasImportantChange ? 'Something important changed since tracking started.' : 'Nothing materially changed since tracking started.'}</span>
                                </li>
                                {isPromotedToBooked && (
                                    <li className="flex items-start gap-2 text-blue-800">
                                        <ShieldAlert className="w-4 h-4 mt-0.5 text-blue-600" />
                                        <span>{promotedAt ? `Promoted to booked-trip monitoring on ${formatDateTime(promotedAt)}.` : 'Promoted to booked-trip monitoring.'}</span>
                                    </li>
                                )}
                                {realTimeUnavailable && (
                                    <li className="flex items-start gap-2 text-amber-800">
                                        <ShieldAlert className="w-4 h-4 mt-0.5 text-amber-600" />
                                        <span>Real-time pricing data is unavailable; current status is based on the tracked itinerary snapshot.</span>
                                    </li>
                                )}
                                {isPromotedToBooked && (
                                    <li className="flex items-start gap-2 text-slate-600">
                                        <AlertTriangle className="w-4 h-4 mt-0.5 text-slate-500" />
                                        <span>Booking confirmation fields (PNR confirmation, ticket number) are still estimated placeholders unless you add official booking data later.</span>
                                    </li>
                                )}
                            </ul>
                        </div>

                        {promotedTripId ? (
                            <div className="bg-slate-900 rounded-3xl p-6 text-white space-y-3">
                                <div className="text-xs uppercase tracking-wider font-bold text-sky-300">Booked trip monitoring</div>
                                <p className="text-sm text-slate-200 leading-relaxed">
                                    This itinerary is now connected to Guardian post-booking protection.
                                </p>
                                <Link
                                    href={`/${locale}/dashboard/guardian/${promotedTripId}`}
                                    className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors"
                                >
                                    Open booked trip monitoring
                                </Link>
                            </div>
                        ) : (
                            <div className="bg-slate-900 rounded-3xl p-6 text-white space-y-4">
                                <div className="text-xs uppercase tracking-wider font-bold text-sky-300">Next step</div>
                                <p className="text-sm text-slate-200 leading-relaxed">
                                    {scoreSnapshot?.actionHint || 'Keep tracking this itinerary and compare it against newer price observations before booking.'}
                                </p>
                                <PromoteTrackedItineraryButton locale={locale} trackedItineraryId={watchedFlight.id} />
                                <p className="text-xs text-slate-300">
                                    Promotion starts Guardian monitoring without re-entering this itinerary. Booking confirmation fields are marked as estimated until official booking data is provided.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

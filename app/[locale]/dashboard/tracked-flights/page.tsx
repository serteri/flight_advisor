import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getUserTier } from '@/lib/tierUtils';
import { TrendingDown, TrendingUp, Minus, Bell, Plane, ArrowRight, Calendar, Search, Clock, Briefcase } from 'lucide-react';
import Link from 'next/link';
import { RemoveWatchButton } from '@/components/RemoveWatchButton';
import { RefreshPricesButton } from "@/components/RefreshPricesButton";
import { BackToSearchButton } from "@/components/BackToSearchButton";
import { formatDistanceToNow } from 'date-fns';
import { tr, enUS, de } from 'date-fns/locale';

interface FlightSegment {
    from: string;
    to: string;
    carrier: string;
    carrierName?: string;
    flightNumber: string;
    departure: string;
    arrival: string;
    duration: number;
}

interface Layover {
    airport: string;
    city?: string;
    duration: number;
}

interface WatchedFlight {
    id: string;
    flightNumber: string;
    airline: string;
    origin: string;
    destination: string;
    departureDate: Date;
    initialPrice: number;
    currentPrice: number | null;
    priceHistory: Array<{ date: string; price: number }> | null;
    currency: string;
    status: string;
    createdAt: Date;
    lastChecked: Date | null;
    // Flight details
    totalDuration: number | null;
    stops: number | null;
    segments: FlightSegment[] | null;
    layovers: Layover[] | null;
    baggageWeight: number | null;
    cabin: string | null;
}

function formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
}

function formatTime(dateStr: string): string {
    try {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
        return dateStr;
    }
}

export default async function TrackedFlightsPage({
    params
}: {
    params: Promise<{ locale: string }>
}) {
    const { locale } = await params;
    const session = await auth();
    const dateLocale = locale === 'tr' ? tr : locale === 'de' ? de : enUS;
    const userTier = await getUserTier();
    const hasPremiumAccess = userTier === 'PRO' || userTier === 'ELITE';

    let flights: WatchedFlight[] = [];

    try {
        flights = await prisma.watchedFlight.findMany({
            where: session?.user?.id ? { userId: session.user.id } : {},
            orderBy: { createdAt: 'desc' },
        }) as unknown as WatchedFlight[];
    } catch (error) {
        console.error('Failed to fetch watched flights:', error);
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
            <div className="max-w-5xl mx-auto p-6 md:p-8">
                {/* Back Navigation */}
                <BackToSearchButton fallbackUrl={`/${locale}/flight-search`} />

                {/* Header */}
                <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-3 bg-blue-100 rounded-xl">
                                <Bell className="h-6 w-6 text-blue-600" />
                            </div>
                            <h1 className="text-2xl md:text-3xl font-black text-slate-900">
                                Flight Watchlist
                            </h1>
                        </div>
                        <p className="text-slate-500">
                            Track prices and get notified when they drop.
                        </p>
                    </div>
                    <RefreshPricesButton />
                </div>

                {/* Flight List */}
                {!hasPremiumAccess ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-sm">
                        <Plane className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-700 mb-2">
                            Premium Feature
                        </h3>
                        <p className="text-slate-500 mb-6">
                            Upgrade to PRO or ELITE to track flights and see advanced scoring in your dashboard.
                        </p>
                        <Link
                            href={`/${locale}/pricing`}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all"
                        >
                            Upgrade Now
                        </Link>
                    </div>
                ) : flights.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-sm">
                        <Plane className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-700 mb-2">
                            No Flights Tracked Yet
                        </h3>
                        <p className="text-slate-500 mb-6">
                            Search for flights and click &quot;Track This Flight&quot; to add them here.
                        </p>
                        <Link
                            href={`/${locale}/flight-search`}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all"
                        >
                            <Search className="h-4 w-4" />
                            Search Flights
                        </Link>
                    </div>
                ) : (
                    <div className="grid gap-6">
                        {flights.map((flight) => {
                            const currentPrice = flight.currentPrice || flight.initialPrice;
                            const priceDiff = currentPrice - flight.initialPrice;
                            const percentChange = ((priceDiff / flight.initialPrice) * 100).toFixed(1);
                            const isLower = priceDiff < 0;
                            const isHigher = priceDiff > 0;
                            const priceHistory = flight.priceHistory || [];
                            const segments = flight.segments || [];
                            const layovers = flight.layovers || [];

                            return (
                                <div
                                    key={flight.id}
                                    className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-lg transition-all overflow-hidden"
                                >
                                    {/* Header with Price */}
                                    <div className="p-5 md:p-6 border-b border-slate-100">
                                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                                            {/* Route Info */}
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className="text-xl font-bold text-slate-900">{flight.origin}</span>
                                                    <div className="flex items-center gap-1">
                                                        <div className="w-8 h-[2px] bg-slate-300"></div>
                                                        <Plane className="h-4 w-4 text-slate-400" />
                                                        <div className="w-8 h-[2px] bg-slate-300"></div>
                                                    </div>
                                                    <span className="text-xl font-bold text-slate-900">{flight.destination}</span>
                                                    {flight.stops !== null && flight.stops > 0 && (
                                                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                                                            {flight.stops} stop{flight.stops > 1 ? 's' : ''}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                                                    <div className="flex items-center gap-1">
                                                        <Calendar className="h-4 w-4" />
                                                        {new Date(flight.departureDate).toLocaleDateString('en-US', {
                                                            weekday: 'short',
                                                            month: 'short',
                                                            day: 'numeric'
                                                        })}
                                                    </div>
                                                    <span className="text-slate-300">•</span>
                                                    <span className="font-medium">{flight.airline}</span>
                                                    {flight.totalDuration && (
                                                        <>
                                                            <span className="text-slate-300">•</span>
                                                            <div className="flex items-center gap-1">
                                                                <Clock className="h-4 w-4" />
                                                                {formatDuration(flight.totalDuration)}
                                                            </div>
                                                        </>
                                                    )}
                                                    {flight.baggageWeight && (
                                                        <>
                                                            <span className="text-slate-300">•</span>
                                                            <div className="flex items-center gap-1">
                                                                <Briefcase className="h-4 w-4" />
                                                                {flight.baggageWeight}kg
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Price Display */}
                                            <div className="flex items-center gap-4">
                                                <div className="text-center">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Start</span>
                                                    <span className={`text-lg font-bold ${isLower ? 'text-slate-400 line-through' : 'text-slate-600'}`}>
                                                        {flight.initialPrice.toLocaleString()}
                                                    </span>
                                                </div>
                                                <ArrowRight className="h-4 w-4 text-slate-300" />
                                                <div className="text-center">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Now</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-xl font-black ${isLower ? 'text-green-600' : isHigher ? 'text-red-600' : 'text-slate-700'}`}>
                                                            {currentPrice.toLocaleString()} {flight.currency}
                                                        </span>
                                                        {isLower && <TrendingDown className="h-5 w-5 text-green-600" />}
                                                        {isHigher && <TrendingUp className="h-5 w-5 text-red-600" />}
                                                        {!isLower && !isHigher && <Minus className="h-5 w-5 text-slate-400" />}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Segment Details */}
                                    {segments.length > 0 && (
                                        <div className="px-6 py-4 bg-slate-50">
                                            <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Flight Segments</p>
                                            <div className="space-y-3">
                                                {segments.map((seg, idx) => (
                                                    <div key={idx}>
                                                        {/* Segment */}
                                                        <div className="flex items-center gap-4 bg-white rounded-lg p-3 border border-slate-100">
                                                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-bold text-sm">
                                                                {seg.carrier}
                                                            </div>
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 text-sm font-medium">
                                                                    <span className="font-bold">{seg.from}</span>
                                                                    <ArrowRight className="h-3 w-3 text-slate-400" />
                                                                    <span className="font-bold">{seg.to}</span>
                                                                    <span className="text-slate-400">•</span>
                                                                    <span className="font-mono text-xs">{seg.flightNumber}</span>
                                                                </div>
                                                                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                                                    <span>{formatTime(seg.departure)} - {formatTime(seg.arrival)}</span>
                                                                    <span className="text-slate-300">•</span>
                                                                    <span className="flex items-center gap-1">
                                                                        <Clock className="h-3 w-3" />
                                                                        {formatDuration(seg.duration)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Layover after segment (if not last) */}
                                                        {idx < segments.length - 1 && layovers[idx] && (
                                                            <div className="ml-5 my-2 flex items-center gap-2 text-xs text-amber-600">
                                                                <div className="w-0.5 h-4 bg-amber-300 rounded"></div>
                                                                <Clock className="h-3 w-3" />
                                                                <span className="font-medium">
                                                                    {formatDuration(layovers[idx].duration)} layover in {layovers[idx].city || layovers[idx].airport}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Price History Chart */}
                                    {priceHistory.length >= 1 && (
                                        <div className="px-6 py-4 border-t border-slate-100">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-xs font-semibold text-slate-500 uppercase">Price History</span>
                                                <span className="text-xs text-slate-400">{priceHistory.length} data point{priceHistory.length > 1 ? 's' : ''}</span>
                                            </div>
                                            <div className="flex items-end gap-1 h-12">
                                                {priceHistory.slice(-14).map((point, idx) => {
                                                    const maxPrice = Math.max(...priceHistory.map(p => p.price));
                                                    const minPrice = Math.min(...priceHistory.map(p => p.price));
                                                    const range = maxPrice - minPrice || 1;
                                                    const height = priceHistory.length === 1 ? 50 : Math.max(8, ((point.price - minPrice) / range) * 40 + 8);
                                                    const isLatest = idx === priceHistory.slice(-14).length - 1;

                                                    return (
                                                        <div key={idx} className="flex-1 group relative">
                                                            <div
                                                                className={`w-full rounded-t transition-all ${point.price <= flight.initialPrice
                                                                    ? isLatest ? 'bg-green-500' : 'bg-green-300'
                                                                    : isLatest ? 'bg-red-500' : 'bg-red-300'
                                                                    }`}
                                                                style={{ height: `${height}px` }}
                                                            />
                                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                                                                <div className="bg-slate-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                                                                    {new Date(point.date).toLocaleDateString()}: {point.price.toLocaleString()} {flight.currency}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Action Bar */}
                                    <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                                        <Link
                                            href={`/${locale}/flight-search?from=${flight.origin}&to=${flight.destination}&date=${new Date(flight.departureDate).toISOString().split('T')[0]}`}
                                            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                                        >
                                            <Search className="h-4 w-4" />
                                            Search Again
                                        </Link>
                                        <RemoveWatchButton flightId={flight.id} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Info Note */}
                <div className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="flex items-start gap-3">
                        <Bell className="h-5 w-5 text-blue-500 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-blue-900">Daily Price Updates</p>
                            <p className="text-xs text-blue-700 mt-1">
                                Prices are automatically checked daily. The chart shows price changes over time.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

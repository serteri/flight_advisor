'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Plane, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useSearchParams, usePathname } from 'next/navigation';
import { AddTripModal } from './AddTripModal';
import { FlightInspector } from './FlightInspector';
import { WatchedFlightCard } from '@/components/WatchedFlightCard';

interface DashboardClientProps {
    trips: any[];           // MonitoredTrip[]
    trackedFlights: any[];  // WatchedFlight[]
    user: any;
}

export function DashboardClient({ trips, trackedFlights, user }: DashboardClientProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showFlightInspector, setShowFlightInspector] = useState(false);
    const [checkoutLoading, setCheckoutLoading] = useState<null | 'PRO' | 'ELITE'>(null);
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
    const [autoCheckoutError, setAutoCheckoutError] = useState<string | null>(null);
    const searchParams = useSearchParams();
    const checkoutStatus = searchParams.get('status');
    const checkoutSuccess = checkoutStatus === 'success' || searchParams.get('success') === 'true';
    const pathname = usePathname();
    const locale = pathname?.split('/')[1] || 'en';
    const planParam = searchParams.get('plan');
    const normalizedPlanParam = planParam?.toUpperCase() || null;
    const cycleParam = searchParams.get('billingCycle');
    const trialParam = searchParams.get('trial');
    const hasAutoCheckoutParams = normalizedPlanParam === 'PRO' || normalizedPlanParam === 'ELITE';
    const getPendingPlan = () => {
        if (typeof window === 'undefined') return null;
        const raw = localStorage.getItem('pendingPlan');
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw) as {
                plan?: 'PRO' | 'ELITE';
                billingCycle?: 'monthly' | 'yearly';
                trial?: boolean;
            };
            if (parsed.plan !== 'PRO' && parsed.plan !== 'ELITE') return null;
            return parsed;
        } catch {
            return null;
        }
    };
    const [isAutoCheckoutLoading, setIsAutoCheckoutLoading] = useState(() => {
        if (hasAutoCheckoutParams) return true;
        return !!getPendingPlan();
    });
    const autoCheckoutRef = useRef(false);

    const plan = (user?.subscriptionPlan || '').toUpperCase();
    const hasPremium = plan === 'PRO' || plan === 'ELITE';

    const t = useTranslations('Dashboard');

    const startCheckout = async (
        planValue: 'PRO' | 'ELITE',
        cycleValue: 'monthly' | 'yearly',
        trialValue: boolean
    ) => {
        try {
            const response = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan: planValue,
                    billingCycle: cycleValue,
                    trial: trialValue,
                }),
            });

            if (response.status === 401) {
                console.warn('[CHECKOUT] Unauthorized session');
                return { ok: false, unauthorized: true } as const;
            }

            if (!response.ok) {
                throw new Error('Checkout failed');
            }

            const data = await response.json();
            if (data?.url) {
                window.location.replace(data.url);
                return { ok: true } as const;
            }

            return { ok: false } as const;
        } catch (error) {
            console.error('[CHECKOUT]', error);
            return { ok: false } as const;
        }
    };

    useEffect(() => {
        if (autoCheckoutRef.current) return;

        const pendingPlan = getPendingPlan();
        const resolvedPlan = hasAutoCheckoutParams
            ? normalizedPlanParam
            : pendingPlan?.plan;
        if (!resolvedPlan) return;

        autoCheckoutRef.current = true;
        setIsAutoCheckoutLoading(true);
        const cycle = hasAutoCheckoutParams
            ? (cycleParam === 'yearly' ? 'yearly' : 'monthly')
            : (pendingPlan?.billingCycle === 'yearly' ? 'yearly' : 'monthly');
        const trial = hasAutoCheckoutParams
            ? (trialParam !== 'false')
            : (pendingPlan?.trial !== false);

        if (pendingPlan && typeof window !== 'undefined') {
            localStorage.removeItem('pendingPlan');
        }

        console.log('[AUTO_CHECKOUT]', {
            plan: resolvedPlan,
            billingCycle: cycle,
            trial,
            source: hasAutoCheckoutParams ? 'query' : 'localStorage',
        });

        void (async () => {
            const result = await startCheckout(resolvedPlan as 'PRO' | 'ELITE', cycle, trial);

            if (result?.unauthorized) {
                const callbackUrl = `${pathname}?${searchParams.toString()}`;
                window.location.href = `/${locale}/login?callbackUrl=${encodeURIComponent(
                    callbackUrl
                )}`;
                return;
            }

            if (!result?.ok) {
                setAutoCheckoutError('Checkout failed. Please try again.');
                setIsAutoCheckoutLoading(false);
                autoCheckoutRef.current = false;
            }
        })();
    }, [cycleParam, hasAutoCheckoutParams, normalizedPlanParam, pathname, searchParams, trialParam]);

    useEffect(() => {
        if (!isAutoCheckoutLoading) return;
        const timer = window.setTimeout(() => {
            setAutoCheckoutError('Checkout is taking longer than expected. Please try again.');
            setIsAutoCheckoutLoading(false);
            autoCheckoutRef.current = false;
        }, 12000);

        return () => window.clearTimeout(timer);
    }, [isAutoCheckoutLoading]);

    // Handle checkout via POST /api/checkout
    const handleUpgradeClick = async (selectedPlan: 'PRO' | 'ELITE') => {
        try {
            setCheckoutLoading(selectedPlan);
            await startCheckout(selectedPlan, billingCycle, true);
        } finally {
            setCheckoutLoading(null);
        }
    };

    if (isAutoCheckoutLoading) {
        return (
            <div className="fixed inset-0 bg-slate-950 flex items-center justify-center z-50">
                <div className="text-center text-white">
                    <div className="mb-6 flex justify-center">
                        <div className="w-14 h-14 rounded-full border-4 border-white/30 border-t-white animate-spin" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">Redirecting to Payment...</h3>
                    <p className="text-white/70">
                        {trialParam === 'false'
                            ? 'Please wait while we prepare your secure checkout.'
                            : 'Please wait while we prepare your 7-day free trial.'}
                    </p>
                </div>
            </div>
        );
    }

    if (autoCheckoutError) {
        return (
            <div className="fixed inset-0 bg-slate-950 flex items-center justify-center z-50">
                <div className="text-center text-white max-w-md px-6">
                    <div className="mb-6 flex justify-center">
                        <div className="w-12 h-12 rounded-full border-4 border-white/30 border-t-white" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">Checkout problem</h3>
                    <p className="text-white/70 mb-6">{autoCheckoutError}</p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <button
                            onClick={() => {
                                setAutoCheckoutError(null);
                                setIsAutoCheckoutLoading(true);
                                autoCheckoutRef.current = false;
                            }}
                            className="bg-white text-slate-900 px-5 py-2 rounded-lg font-semibold"
                        >
                            Try again
                        </button>
                        <Link
                            href={`/${locale}/pricing`}
                            className="text-white/80 underline underline-offset-4"
                        >
                            Back to pricing
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-12">
            {/* UPGRADE CARD - For FREE tier users */}
            {!hasPremium && (
                <div className="rounded-2xl border-2 border-blue-400 bg-gradient-to-br from-blue-50 to-blue-100 p-8 shadow-lg">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div>
                            <h3 className="text-2xl font-bold text-slate-900 mb-2">Unlock Premium Features</h3>
                            <p className="text-slate-600 mb-4">Get real-time flight tracking, price alerts, and Flight Inspector with a 7-day free trial.</p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setBillingCycle('monthly')}
                                    className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                                        billingCycle === 'monthly'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white text-slate-700 border border-slate-300'
                                    }`}
                                >
                                    Monthly
                                </button>
                                <button
                                    onClick={() => setBillingCycle('yearly')}
                                    className={`px-4 py-2 rounded-lg font-semibold transition-all relative ${
                                        billingCycle === 'yearly'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white text-slate-700 border border-slate-300'
                                    }`}
                                >
                                    Yearly <span className="text-xs ml-1">25% OFF</span>
                                </button>
                            </div>
                        </div>
                        <div className="flex gap-3 flex-col md:flex-row">
                            <button
                                onClick={() => handleUpgradeClick('PRO')}
                                disabled={checkoutLoading === 'PRO'}
                                className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg transition-all disabled:opacity-50"
                            >
                                {checkoutLoading === 'PRO' ? '⏳ PRO...' : '🎁 PRO - $9.90/mo'}
                            </button>
                            <button
                                onClick={() => handleUpgradeClick('ELITE')}
                                disabled={checkoutLoading === 'ELITE'}
                                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg transition-all disabled:opacity-50"
                            >
                                {checkoutLoading === 'ELITE' ? '⏳ ELITE...' : '👑 ELITE - $19.90/mo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {checkoutSuccess && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-emerald-900">
                    <div className="text-sm font-bold">
                        Welcome to {plan === 'ELITE' ? 'ELITE' : 'PRO'}! Your 7-day free trial has started.
                    </div>
                    <div className="text-sm text-emerald-800">
                        Flight Inspector is now unlocked.
                    </div>
                </div>
            )}

            {/* --- SECTION 0: FLIGHT INSPECTOR (PRE-BOOKING) --- */}
            {hasPremium && (
                <div>
                    <div className="mb-6">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="w-5 h-5 text-blue-500" />
                            <h2 className="text-2xl font-bold text-slate-900">Flight Inspector</h2>
                        </div>
                        <p className="text-slate-500">Inspect flights before booking to see real-time pricing, historical delays, and smart recommendations.</p>
                    </div>

                    {!showFlightInspector ? (
                        <button
                            onClick={() => setShowFlightInspector(true)}
                            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg"
                        >
                            <Sparkles className="w-5 h-5" />
                            Start Flight Inspection
                        </button>
                    ) : (
                        <div className="space-y-4">
                            <FlightInspector locale={locale} />
                            <button
                                onClick={() => setShowFlightInspector(false)}
                                className="w-full text-slate-600 hover:text-slate-900 font-medium text-sm"
                            >
                                ← Close Inspector
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* --- SECTION 1: SEYAHATLERİM (GUARDIAN V2) --- */}
            <div>
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">{t('myTrips')}</h2>
                        <p className="text-slate-500">{t('myTripsDesc')}</p>
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-lg shadow-emerald-200"
                    >
                        <Plus className="w-5 h-5" />
                        {t('addTrip')}
                    </button>
                </div>

                {trips.length === 0 ? (
                    <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center flex flex-col items-center">
                        <div className="p-3 bg-white rounded-full shadow-sm mb-3 text-slate-400">
                            <Plane className="w-6 h-6" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-900">{t('emptyTitle')}</h3>
                        <p className="text-xs text-slate-500 mt-1 mb-3 max-w-xs">
                            {t('emptyDesc')}
                        </p>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="text-emerald-600 text-sm font-bold hover:underline"
                        >
                            {t('addTripShort')}
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-6">
                        {trips.map((trip) => (
                            <Link href={`/dashboard/guardian/${trip.id}`} key={trip.id}>
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center hover:shadow-md transition-shadow cursor-pointer group">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-slate-100 rounded-lg text-slate-600 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                                            <Plane className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-slate-900 group-hover:text-emerald-700 transition-colors">{trip.origin} ➝ {trip.destination}</h3>
                                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                                <span className="font-mono font-bold bg-slate-100 px-1 rounded text-slate-700">{trip.pnr}</span>
                                                <span>•</span>
                                                <span>{new Date(trip.departureDate).toLocaleDateString('tr-TR')}</span>
                                                <span>•</span>
                                                <span>{trip.flightNumber}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${trip.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-600 border-slate-200'
                                            }`}>
                                            {trip.status === 'ACTIVE' ? t('protected') : trip.status}
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* --- SECTION 2: TAKİP EDİLEN UÇUŞLAR (TRACKED FLIGHTS) --- */}
            <div>
                <div className="mb-6 border-t pt-8">
                    <h2 className="text-2xl font-bold text-slate-900">{t('trackedFlights')}</h2>
                    <p className="text-slate-500">{t('trackedFlightsDesc')}</p>
                </div>

                {!hasPremium ? (
                    <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
                        <h3 className="text-lg font-bold text-slate-900">Premium Feature</h3>
                        <p className="text-slate-500 mt-1 mb-4">Upgrade to PRO or ELITE to track flights manually and see advanced scoring.</p>
                        <Link
                            href={`/${locale}/pricing`}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all"
                        >
                            Upgrade Now
                        </Link>
                    </div>
                ) : trackedFlights.length === 0 ? (
                    <div className="text-center py-8 opacity-60">
                        <p>{t('noTrackedFlights')}</p>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
                        {trackedFlights.map((flight) => (
                            <WatchedFlightCard key={flight.id} flight={flight} />
                        ))}
                    </div>
                )}
            </div>

            {isModalOpen && (
                <AddTripModal user={user} onClose={() => setIsModalOpen(false)} />
            )}
        </div>
    );
}

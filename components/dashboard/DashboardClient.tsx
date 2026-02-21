'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Plane, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
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
    const [isAutoCheckoutLoading, setIsAutoCheckoutLoading] = useState(false);
    const searchParams = useSearchParams();
    const router = useRouter();
    const autoCheckoutRef = useRef(false);
    const checkoutStatus = searchParams.get('status');
    const checkoutSuccess = checkoutStatus === 'success' || searchParams.get('success') === 'true';
    const pathname = usePathname();
    const locale = pathname?.split('/')[1] || 'en';

    const plan = (user?.subscriptionPlan || '').toUpperCase();
    const hasPremium = plan === 'PRO' || plan === 'ELITE';

    const t = useTranslations('Dashboard');

    // Auto-trigger checkout if plan params present in URL
    useEffect(() => {
        if (autoCheckoutRef.current) return; // Prevent duplicate triggers
        
        const planParam = searchParams.get('plan');
        const cycleParam = searchParams.get('billingCycle');
        
        if (!planParam || (planParam !== 'PRO' && planParam !== 'ELITE')) return;
        
        const cycle = cycleParam === 'yearly' ? 'yearly' : 'monthly';
        
        // Mark as started to prevent re-trigger
        autoCheckoutRef.current = true;
        
        // Trigger checkout
        const triggerCheckout = async () => {
            try {
                setIsAutoCheckoutLoading(true);
                const response = await fetch('/api/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        plan: planParam,
                        billingCycle: cycle,
                    }),
                });
                
                if (!response.ok) {
                    throw new Error(`Checkout failed: ${response.status}`);
                }
                
                const data = await response.json();
                if (data?.url) {
                    window.location.href = data.url; // Redirect to Stripe
                }
            } catch (error) {
                console.error('[AUTO-CHECKOUT ERROR]', error);
                setIsAutoCheckoutLoading(false);
                autoCheckoutRef.current = false; // Reset on error
            }
        };
        
        triggerCheckout();
    }, [searchParams]);

    return (
        <div className="space-y-12">
            {isAutoCheckoutLoading && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-8 shadow-2xl text-center">
                        <div className="mb-4 flex justify-center">
                            <div className="relative w-12 h-12">
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full animate-spin" 
                                     style={{ clipPath: 'polygon(50% 0%, 100% 0%, 100% 50%, 50% 50%)' }} />
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Redirecting to Stripe...</h3>
                        <p className="text-slate-600">Please wait while we prepare your checkout session.</p>
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

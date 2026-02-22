'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Shield, Crown } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function PricingTable() {
    const t = useTranslations('Pricing');
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const locale = pathname?.split('/')[1] || 'en';
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
    const [checkoutLoading, setCheckoutLoading] = useState<null | 'PRO' | 'ELITE'>(null);
    const autoCheckoutRef = useRef(false);

    const redirectToLogin = (
        plan: 'PRO' | 'ELITE',
        cycle: 'monthly' | 'yearly',
        trial: boolean
    ) => {
        const callbackUrl = `/${locale}/dashboard?plan=${plan}&billingCycle=${cycle}&trial=${trial ? 'true' : 'false'}`;
        router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    };

    const handleCheckout = async (
        plan: 'PRO' | 'ELITE',
        trial: boolean,
        cycleOverride?: 'monthly' | 'yearly'
    ) => {
        const resolvedCycle = cycleOverride || billingCycle;

        try {
            setCheckoutLoading(plan);
            const response = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan,
                    billingCycle: resolvedCycle,
                    trial,
                }),
            });

            if (response.status === 401) {
                redirectToLogin(plan, resolvedCycle, trial);
                return;
            }

            if (!response.ok) {
                throw new Error('Checkout failed');
            }

            const data = await response.json();
            if (data?.url) {
                window.location.href = data.url;
            }
        } catch (error) {
            console.error('[CHECKOUT]', error);
        } finally {
            setCheckoutLoading(null);
        }
    };

    useEffect(() => {
        if (autoCheckoutRef.current) {
            return;
        }

        const planParam = searchParams.get('plan');
        const cycleParam = searchParams.get('billingCycle');
        const trialParam = searchParams.get('trial');

        if (planParam === 'PRO' || planParam === 'ELITE') {
            const cycle = cycleParam === 'yearly' ? 'yearly' : 'monthly';
            const trial = trialParam !== 'false';
            autoCheckoutRef.current = true;
            handleCheckout(planParam, trial, cycle);
        }
    }, [searchParams]);

    return (
        <section className="py-24 bg-white relative overflow-hidden">
            <div className="container mx-auto px-4 md:px-6">

                {/* Header */}
                <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
                    <h2 className="text-3xl md:text-5xl font-bold text-slate-900 tracking-tight">
                        {t('title')}
                    </h2>
                    <p className="text-xl text-slate-500">
                        {t('subtitle')}
                    </p>
                    
                    {/* Billing Cycle Toggle */}
                    <div className="flex justify-center items-center gap-4 pt-6">
                        <button
                            onClick={() => setBillingCycle('monthly')}
                            className={`px-6 py-2 rounded-full font-semibold transition-all ${
                                billingCycle === 'monthly'
                                    ? 'bg-blue-600 text-white shadow-lg'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            {t('monthly')}
                        </button>
                        <button
                            onClick={() => setBillingCycle('yearly')}
                            className={`px-6 py-2 rounded-full font-semibold transition-all relative ${
                                billingCycle === 'yearly'
                                    ? 'bg-blue-600 text-white shadow-lg'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            {t('yearly')}
                            <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                25% OFF
                            </span>
                        </button>
                    </div>
                </div>

                {/* Pricing Cards */}
                <div className="max-w-5xl mx-auto pb-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">

                        {/* Column 1: Free */}
                        <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200">
                            <div className="h-40 flex flex-col justify-between mb-8 text-center">
                                <div>
                                    <div className="font-bold text-slate-500 uppercase tracking-widest text-xs mb-2">{t('plans.free.badge')}</div>
                                    <div className="text-2xl font-bold text-slate-900">{t('plans.free.name')}</div>
                                </div>
                                <div className="text-4xl font-black text-slate-900">{t('plans.free.price')}</div>
                                <Button variant="outline" className="w-full mt-4 rounded-xl border-slate-300 hover:bg-white">{t('cta.current')}</Button>
                            </div>
                        </div>

                        {/* Column 2: Guardian (Pro) */}
                        <div className="bg-gradient-to-b from-blue-50 via-white to-blue-50 rounded-3xl p-8 border-2 border-blue-400 shadow-2xl shadow-blue-400/30 relative group hover:-translate-y-2 transition-all duration-300">
                            <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest shadow-lg whitespace-nowrap z-20 pointer-events-none">
                                ⭐ RECOMMENDED
                            </div>
                            <div className="absolute top-0 right-0 w-40 h-40 bg-blue-400/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:scale-110 transition-transform"></div>

                            <div className="h-auto flex flex-col justify-between mb-8 text-center relative z-10 pt-6">
                                <div>
                                    <div className="font-bold text-blue-700 uppercase tracking-widest text-xs mb-2 flex justify-center items-center gap-2">
                                        <Shield className="w-4 h-4" /> {t('plans.guardian.badge')}
                                    </div>
                                    <div className="text-3xl font-black text-slate-900">{t('plans.guardian.name')}</div>
                                    <p className="text-xs text-blue-600 mt-1 font-medium">Smart Traveler Essential</p>
                                </div>
                                <div className="mt-4">
                                    <div className="text-5xl font-black text-blue-600">
                                        ${billingCycle === 'monthly' ? '9.90' : '89.10'}
                                    </div>
                                    <span className="text-sm font-semibold text-slate-600 ml-1">
                                        {billingCycle === 'monthly' ? '/month' : '/year'}
                                    </span>
                                </div>
                                {billingCycle === 'yearly' && (
                                    <div className="text-sm text-blue-700 font-bold mt-2 bg-blue-100/60 rounded-lg py-2 px-3 border border-blue-300/50">
                                        💰 Save $29.70/year • Only $0.74/day
                                    </div>
                                )}
                                
                                {/* Features */}
                                <div className="mt-6 space-y-3 text-left">
                                    <div className="flex items-center gap-3 text-slate-700 font-semibold text-sm">
                                        <span className="h-3 w-3 rounded-full bg-blue-500" />
                                        <span>Real-time Flight Tracking</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-slate-700 font-semibold text-sm">
                                        <span className="h-3 w-3 rounded-full bg-blue-500" />
                                        <span>Price Drop Alerts</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-slate-700 font-semibold text-sm">
                                        <span className="h-3 w-3 rounded-full bg-blue-500" />
                                        <span>Flight Inspector Premium</span>
                                    </div>
                                </div>

                                {/* CTAs */}
                                <div className="mt-6 space-y-3">
                                    <Button
                                        className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold text-base shadow-lg shadow-emerald-900/40 border-0 transition-all duration-300 hover:shadow-emerald-900/60 hover:scale-105 py-3"
                                        onClick={() => handleCheckout('PRO', true)}
                                        disabled={checkoutLoading === 'PRO'}
                                    >
                                        {checkoutLoading === 'PRO' ? '⏳ Connecting...' : 'Start Free Trial (7 Days)'}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="w-full rounded-xl border-slate-300 font-semibold text-slate-700 hover:bg-white"
                                        onClick={() => handleCheckout('PRO', false)}
                                        disabled={checkoutLoading === 'PRO'}
                                    >
                                        {checkoutLoading === 'PRO' ? '⏳ Connecting...' : 'Subscribe Now'}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Column 3: Elite */}
                        <div className="bg-gradient-to-b from-slate-900 via-slate-800 to-black rounded-3xl p-8 border-2 border-gradient-to-r from-amber-400 via-orange-400 to-rose-400 text-white shadow-2xl relative overflow-hidden group hover:-translate-y-2 transition-all duration-300">
                            {/* Premium Glow Background */}
                            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-amber-500/30 via-orange-500/20 to-transparent rounded-full blur-3xl -translate-y-1/3 translate-x-1/3 pointer-events-none group-hover:scale-110 transition-transform"></div>
                            <div className="absolute bottom-0 left-0 w-72 h-72 bg-gradient-to-tr from-rose-500/20 to-transparent rounded-full blur-3xl translate-y-1/3 -translate-x-1/4 pointer-events-none"></div>

                            <div className="h-auto flex flex-col justify-between mb-8 text-center relative z-10">
                                <div>
                                    <div className="font-bold text-amber-300 uppercase tracking-widest text-xs mb-2 flex justify-center items-center gap-2">
                                        <Crown className="w-5 h-5 drop-shadow-lg" /> {t('plans.elite.badge')}
                                    </div>
                                    <div className="text-3xl font-black text-white drop-shadow-lg">{t('plans.elite.name')}</div>
                                    <p className="text-sm text-amber-200 mt-1 font-medium">Premium Protection Suite</p>
                                </div>
                                <div className="mt-4">
                                    <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-300 to-rose-300 drop-shadow-lg">
                                        ${billingCycle === 'monthly' ? '19.90' : '178.20'}
                                    </div>
                                    <span className="text-sm font-semibold text-amber-200 ml-1">
                                        {billingCycle === 'monthly' ? '/month' : '/year'}
                                    </span>
                                </div>

                                {billingCycle === 'yearly' && (
                                    <div className="text-sm text-emerald-300 font-bold mt-2 bg-emerald-900/30 rounded-lg py-2 px-3 border border-emerald-600/50">
                                        💎 Save $59.40/year • Only $1.48/day
                                    </div>
                                )}
                                
                                {/* Features */}
                                <div className="mt-6 space-y-3 text-left">
                                    <div className="flex items-center gap-3 text-amber-50 font-semibold text-sm">
                                        <span className="h-3 w-3 rounded-full bg-gradient-to-br from-amber-300 to-orange-400 shadow-lg shadow-orange-500/50" />
                                        <span>Urgent SMS Notifications</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-amber-50 font-semibold text-sm">
                                        <span className="h-3 w-3 rounded-full bg-gradient-to-br from-orange-300 to-rose-400 shadow-lg shadow-rose-500/50" />
                                        <span>Automated Compensation Recovery</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-amber-50 font-semibold text-sm">
                                        <span className="h-3 w-3 rounded-full bg-gradient-to-br from-rose-300 to-pink-400 shadow-lg shadow-pink-500/50" />
                                        <span>24/7 Proactive Crisis Management</span>
                                    </div>
                                </div>

                                {/* CTAs */}
                                <div className="mt-6 space-y-3">
                                    <Button
                                        className="w-full rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:via-orange-600 hover:to-rose-600 text-white font-bold text-base shadow-2xl shadow-orange-900/50 border-0 transition-all duration-300 hover:shadow-orange-900/80 hover:scale-105 py-3"
                                        onClick={() => handleCheckout('ELITE', true)}
                                        disabled={checkoutLoading === 'ELITE'}
                                    >
                                        {checkoutLoading === 'ELITE' ? '⏳ Connecting...' : 'Start Free Trial (7 Days)'}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="w-full rounded-xl border-white/60 bg-white text-slate-900 hover:bg-white"
                                        onClick={() => handleCheckout('ELITE', false)}
                                        disabled={checkoutLoading === 'ELITE'}
                                    >
                                        {checkoutLoading === 'ELITE' ? '⏳ Connecting...' : 'Subscribe Now'}
                                    </Button>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </section>
    );
}

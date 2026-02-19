'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Shield, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PricingTable() {
    const t = useTranslations('Pricing');
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

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
                        <div className="bg-gradient-to-br from-blue-50 to-white rounded-3xl p-6 border-2 border-blue-400 shadow-2xl shadow-blue-400/20 relative">
                            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg whitespace-nowrap">
                                ⭐ Recommended
                            </div>
                            <div className="h-40 flex flex-col justify-between mb-8 text-center pt-2">
                                <div>
                                    <div className="font-bold text-blue-700 uppercase tracking-widest text-xs mb-2 flex justify-center items-center gap-1">
                                        <Shield className="w-4 h-4" /> {t('plans.guardian.badge')}
                                    </div>
                                    <div className="text-2xl font-bold text-slate-900">{t('plans.guardian.name')}</div>
                                </div>
                                <div className="text-4xl font-black text-slate-900">
                                    ${billingCycle === 'monthly' ? '9.90' : '89.10'}
                                    <span className="text-sm font-medium text-slate-500 ml-1">
                                        {billingCycle === 'monthly' ? '/month' : '/year'}
                                    </span>
                                </div>
                                {billingCycle === 'yearly' && (
                                    <div className="text-xs text-emerald-600 font-semibold">💰 Save $29.70/year</div>
                                )}
                                <div className="space-y-2 mt-4">
                                    <Button className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg">
                                        {t('cta.upgrade')}
                                    </Button>
                                    <Button className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm">
                                        Try Free (14 days)
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Column 3: Elite */}
                        <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 text-white shadow-2xl relative overflow-hidden">
                            {/* Background Glow */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                            <div className="h-40 flex flex-col justify-between mb-8 text-center relative z-10">
                                <div>
                                    <div className="font-bold text-amber-400 uppercase tracking-widest text-xs mb-2 flex justify-center items-center gap-1">
                                        <Crown className="w-3 h-3" /> {t('plans.elite.badge')}
                                    </div>
                                    <div className="text-2xl font-bold text-white">{t('plans.elite.name')}</div>
                                </div>
                                <div className="text-4xl font-black text-white">
                                    ${billingCycle === 'monthly' ? '19.90' : '178.20'}
                                    <span className="text-sm font-medium text-slate-400 ml-1">
                                        {billingCycle === 'monthly' ? '/month' : '/year'}
                                    </span>
                                </div>

                                {billingCycle === 'yearly' && (
                                    <div className="text-xs text-emerald-300 font-semibold">💰 Save $59.40/year</div>
                                )}
                                <div className="mt-4 space-y-2">
                                    <Button className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold shadow-lg shadow-amber-900/20 border-0">
                                        {billingCycle === 'monthly' ? t('cta.upgrade') : 'Subscribe & Save 25%'}
                                    </Button>
                                    <Button className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm border-0">
                                        Try Free (14 days)
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

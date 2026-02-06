'use client';

import { useTranslations } from 'next-intl';
import { Check, X, Minus, Globe, Shield, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PricingTable() {
    const t = useTranslations('Pricing');

    // Feature keys in order
    const features = [
        { key: 'search_score', free: 'unlimited', guardian: 'unlimited', elite: 'unlimited' },
        { key: 'scenario_sim', free: 'limited_3', guardian: 'unlimited', elite: 'unlimited' },
        { key: 'disruption_hunter', free: 'link_only', guardian: 'auto_track', elite: 'priority' },
        { key: 'inbox_parser', free: 'none', guardian: 'tickets_2', elite: 'unlimited' },
        { key: 'schedule_guardian', free: 'none', guardian: 'watch_247', elite: 'watch_247' },
        { key: 'junior_guardian', free: 'none', guardian: 'none', elite: 'full_protection' },
        { key: 'backup_generator', free: 'none', guardian: 'none', elite: 'crisis_mgmt' },
        { key: 'lounge_intel', free: 'none', guardian: 'list_only', elite: 'full_analysis' },
    ];

    const getIcon = (valKey: string) => {
        if (valKey === 'none') return <Minus className="w-5 h-5 text-slate-300" />;
        if (valKey === 'unlimited') return <Check className="w-5 h-5 text-emerald-500" />;
        if (valKey.includes('limited')) return <span className="text-amber-500 font-semibold text-sm">⚠️</span>;
        return <Check className="w-5 h-5 text-blue-500" />;
    };

    const getValueText = (valKey: string) => {
        if (valKey === 'unlimited') return t('values.unlimited');
        if (valKey === 'none') return <span className="text-slate-300">-</span>;
        return t(`values.${valKey}`);
    };

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
                </div>

                {/* Table Layout */}
                <div className="max-w-7xl mx-auto overflow-x-auto pb-8">
                    <div className="min-w-[800px] grid grid-cols-4 gap-4 md:gap-8 text-sm md:text-base">

                        {/* Column 1: Feature Labels */}
                        <div className="col-span-1 pt-40 md:pt-48 space-y-6">
                            {features.map((feat, idx) => (
                                <div key={idx} className="h-12 flex items-center font-semibold text-slate-700 border-b border-slate-50">
                                    {t(`features.${feat.key}`)}
                                </div>
                            ))}
                        </div>

                        {/* Column 2: Free */}
                        <div className="col-span-1 bg-slate-50 rounded-3xl p-6 border border-slate-200">
                            <div className="h-40 flex flex-col justify-between mb-8 text-center">
                                <div>
                                    <div className="font-bold text-slate-500 uppercase tracking-widest text-xs mb-2">{t('plans.free.badge')}</div>
                                    <div className="text-2xl font-bold text-slate-900">{t('plans.free.name')}</div>
                                </div>
                                <div className="text-4xl font-black text-slate-900">{t('plans.free.price')}</div>
                                <Button variant="outline" className="w-full mt-4 rounded-xl border-slate-300 hover:bg-white">{t('cta.current')}</Button>
                            </div>
                            <div className="space-y-6">
                                {features.map((feat, idx) => (
                                    <div key={idx} className="h-12 flex flex-col justify-center items-center text-center border-b border-slate-200/50">
                                        {getIcon(feat.free)}
                                        <div className="text-xs text-slate-500 mt-1">{getValueText(feat.free)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Column 3: Guardian (Pro) */}
                        <div className="col-span-1 bg-white rounded-3xl p-6 border-2 border-blue-100 shadow-xl shadow-blue-900/5 relative">
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg">
                                Recommended
                            </div>
                            <div className="h-40 flex flex-col justify-between mb-8 text-center">
                                <div>
                                    <div className="font-bold text-blue-600 uppercase tracking-widest text-xs mb-2">{t('plans.guardian.badge')}</div>
                                    <div className="text-2xl font-bold text-slate-900">{t('plans.guardian.name')}</div>
                                </div>
                                <div className="text-4xl font-black text-slate-900">
                                    {t('plans.guardian.price')}
                                    <span className="text-sm font-medium text-slate-400 ml-1">{t('monthly')}</span>
                                </div>
                                <Button className="w-full mt-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-200">{t('cta.upgrade')}</Button>
                            </div>
                            <div className="space-y-6">
                                {features.map((feat, idx) => (
                                    <div key={idx} className="h-12 flex flex-col justify-center items-center text-center border-b border-slate-100">
                                        {getIcon(feat.guardian)}
                                        <div className="text-xs text-slate-600 font-medium mt-1">{getValueText(feat.guardian)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Column 4: Elite */}
                        <div className="col-span-1 bg-slate-900 rounded-3xl p-6 border border-slate-800 text-white shadow-2xl relative overflow-hidden">
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
                                    {t('plans.elite.price')}
                                    <span className="text-sm font-medium text-slate-500 ml-1">{t('monthly')}</span>
                                </div>

                                <div className="mt-4">
                                    <Button className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold shadow-lg shadow-amber-900/20 border-0">
                                        {t('cta.start_trial')}
                                    </Button>
                                    <div className="text-[10px] text-emerald-400 mt-2 font-medium">
                                        {t('trial')}
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-6 relative z-10">
                                {features.map((feat, idx) => (
                                    <div key={idx} className="h-12 flex flex-col justify-center items-center text-center border-b border-slate-800">
                                        {getIcon(feat.elite)}
                                        <div className="text-xs text-slate-300 font-medium mt-1">{getValueText(feat.elite)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </section>
    );
}

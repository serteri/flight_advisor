'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Minus } from 'lucide-react';

export function PricingFeatures() {
    const t = useTranslations('Pricing');
    // State removed - using simple table display instead

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
        if (valKey === 'none') return <Minus className="w-4 h-4 text-slate-300" />;
        if (valKey === 'unlimited') return <Check className="w-4 h-4 text-emerald-500" />;
        if (valKey.includes('limited')) return <span className="text-amber-500 font-semibold text-xs">⚠️</span>;
        return <Check className="w-4 h-4 text-blue-500" />;
    };

    const getValueText = (valKey: string) => {
        if (valKey === 'unlimited') return t('values.unlimited');
        if (valKey === 'none') return '-';
        return t(`values.${valKey}`);
    };

    return (
        <section className="py-16 bg-slate-50">
            <div className="container mx-auto px-4 md:px-6">
                <div className="text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">
                        Feature Comparison
                    </h2>
                    <p className="text-lg text-slate-600">
                        See what&apos;s included in each plan
                    </p>
                </div>

                {/* Table Version */}
                <div className="max-w-5xl mx-auto overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-white border-b-2 border-slate-200">
                                <th className="p-4 text-left font-bold text-slate-900">Feature</th>
                                <th className="p-4 text-center font-bold text-slate-600">Free</th>
                                <th className="p-4 text-center font-bold text-blue-600">Guardian</th>
                                <th className="p-4 text-center font-bold text-amber-600">Elite</th>
                            </tr>
                        </thead>
                        <tbody>
                            {features.map((feat, idx) => (
                                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                                    <td className="p-4 font-medium text-slate-700">
                                        {t(`features.${feat.key}`)}
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex justify-center">{getIcon(feat.free)}</div>
                                        <div className="text-xs text-slate-500 mt-1">{getValueText(feat.free)}</div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex justify-center">{getIcon(feat.guardian)}</div>
                                        <div className="text-xs text-slate-600 mt-1">{getValueText(feat.guardian)}</div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex justify-center">{getIcon(feat.elite)}</div>
                                        <div className="text-xs text-slate-600 mt-1">{getValueText(feat.elite)}</div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Legend */}
                <div className="max-w-5xl mx-auto mt-8 flex justify-center gap-6 flex-wrap text-sm">
                    <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-500" />
                        <span className="text-slate-600">Included</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-amber-500 font-semibold">⚠️</span>
                        <span className="text-slate-600">Limited</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Minus className="w-4 h-4 text-slate-300" />
                        <span className="text-slate-600">Not included</span>
                    </div>
                </div>
            </div>
        </section>
    );
}

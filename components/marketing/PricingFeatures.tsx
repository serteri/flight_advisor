'use client';

import { useTranslations } from 'next-intl';
import { Check, Minus, AlertCircle } from 'lucide-react';

export function PricingFeatures() {
    const t = useTranslations('Pricing');

    const features = [
        // SEARCH & SCORING
        { key: 'search_score', category: 'Search & Analysis', free: true, guardian: true, elite: true },
        { key: 'scenario_sim', category: 'Search & Analysis', free: 'limited', guardian: true, elite: true },
        { key: 'disruption_hunter', category: 'Search & Analysis', free: 'limited', guardian: true, elite: true },
        
        // MONITORING
        { key: 'schedule_guardian', category: 'Monitoring (24/7)', free: false, guardian: true, elite: true },
        
        // NOTIFICATIONS
        { key: 'email_notifications', category: 'Notifications', free: 'limited', guardian: true, elite: true },
        { key: 'sms_notifications', category: 'Notifications', free: false, guardian: 'limited', elite: true },
        { key: 'push_notifications', category: 'Notifications', free: false, guardian: true, elite: true },
        
        // AUTOMATION
        { key: 'inbox_parser', category: 'Automation', free: false, guardian: 'limited', elite: true },
        
        // PREMIUM FEATURES
        { key: 'junior_guardian', category: 'Premium Features', free: false, guardian: false, elite: true },
        { key: 'lounge_intel', category: 'Premium Features', free: false, guardian: 'limited', elite: true },
        { key: 'backup_generator', category: 'Premium Features', free: false, guardian: false, elite: true },
    ];

    const categories = [...new Set(features.map(f => f.category))];

    const getIcon = (value: boolean | string) => {
        if (value === true) return <Check className="w-5 h-5 text-emerald-500" />;
        if (value === false) return <Minus className="w-5 h-5 text-slate-300" />;
        if (value === 'limited') return <AlertCircle className="w-5 h-5 text-amber-500" />;
        return <Minus className="w-5 h-5 text-slate-300" />;
    };

    const getLabel = (value: boolean | string) => {
        if (value === true) return 'Included';
        if (value === false) return '-';
        if (value === 'limited') return 'Limited';
        return '-';
    };

    return (
        <section className="py-16 bg-gradient-to-b from-slate-50 to-white border-t border-slate-200">
            <div className="container mx-auto px-4 md:px-6">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">
                        Feature Comparison
                    </h2>
                    <p className="text-slate-600">
                        See exactly what you get in each plan
                    </p>
                </div>

                {/* Feature Table by Category */}
                {categories.map((category, catIdx) => {
                    const categoryFeatures = features.filter(f => f.category === category);
                    
                    return (
                        <div key={category} className="mb-8">
                            <div className="max-w-5xl mx-auto">
                                {/* Category Header */}
                                <h3 className="text-lg font-bold text-slate-900 mb-3 px-4 py-2 bg-slate-100 rounded-lg">
                                    {category}
                                </h3>

                                {/* Table */}
                                <div className="overflow-x-auto rounded-lg border border-slate-200">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200">
                                                <th className="p-4 text-left font-bold text-slate-900">Feature</th>
                                                <th className="p-4 text-center font-bold text-slate-600 min-w-[100px]">Free</th>
                                                <th className="p-4 text-center font-bold text-blue-600 min-w-[100px]">Guardian</th>
                                                <th className="p-4 text-center font-bold text-amber-600 min-w-[100px]">Elite</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {categoryFeatures.map((feat, idx) => (
                                                <tr 
                                                    key={idx} 
                                                    className={`border-b border-slate-100 ${
                                                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                                                    } hover:bg-blue-50/30 transition-colors`}
                                                >
                                                    <td className="p-4 font-medium text-slate-900">
                                                        {t(`features.${feat.key}`)}
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <div className="flex flex-col items-center gap-1">
                                                            {getIcon(feat.free)}
                                                            <span className="text-xs text-slate-600">{getLabel(feat.free)}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-center bg-blue-50/20">
                                                        <div className="flex flex-col items-center gap-1">
                                                            {getIcon(feat.guardian)}
                                                            <span className="text-xs text-slate-700 font-semibold">{getLabel(feat.guardian)}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-center bg-amber-50/20">
                                                        <div className="flex flex-col items-center gap-1">
                                                            {getIcon(feat.elite)}
                                                            <span className="text-xs text-slate-700 font-semibold">{getLabel(feat.elite)}</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* Legend */}
                <div className="max-w-5xl mx-auto mt-12 p-6 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-semibold text-slate-900 mb-3">Legend:</p>
                    <div className="flex flex-wrap gap-6">
                        <div className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-emerald-500" />
                            <span className="text-sm text-slate-600">Included</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-500" />
                            <span className="text-sm text-slate-600">Limited</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Minus className="w-4 h-4 text-slate-300" />
                            <span className="text-sm text-slate-600">Not Included</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

"use client";

import React from 'react';
import { TrendingUp, TrendingDown, Minus, AlertCircle, Info, Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { predictGlobalTrend, type GlobalPriceForecast, type MarketStats } from '@/lib/globalPriceOracle';

interface PriceInsightCardProps {
    departureTime: string;
    price: number;
    effectivePrice?: number;
    seatsAvailable?: number;
    marketStats?: MarketStats;
}

export function PriceInsightCard({
    departureTime,
    price,
    effectivePrice,
    seatsAvailable,
    marketStats = { minPrice: price * 0.9, avgPrice: price, totalFlights: 10 } // Default if not provided
}: PriceInsightCardProps) {
    const t = useTranslations('priceOracle');

    const forecast = predictGlobalTrend(
        { departureTime, price, effectivePrice },
        marketStats
    );

    // Design color schemes
    const colorSchemes = {
        BUY_NOW: {
            bg: 'bg-red-50',
            border: 'border-red-200',
            text: 'text-red-700',
            badgeBg: 'bg-red-100',
            icon: TrendingUp,
            labelKey: 'trends.rising'
        },
        WAIT: {
            bg: 'bg-emerald-50',
            border: 'border-emerald-200',
            text: 'text-emerald-700',
            badgeBg: 'bg-emerald-100',
            icon: TrendingDown,
            labelKey: 'trends.falling'
        },
        MONITOR: {
            bg: 'bg-amber-50',
            border: 'border-amber-200',
            text: 'text-amber-700',
            badgeBg: 'bg-amber-100',
            icon: Minus,
            labelKey: 'trends.stable'
        }
    };

    const colors = colorSchemes[forecast.action];
    const Icon = colors.icon;

    // Helper to get translated signal text
    const getSignalText = (reason: GlobalPriceForecast['reasons'][0]) => {
        if (reason.textParams) {
            // Handle parameterized translations
            const key = reason.textKey.replace('priceOracle.', '');
            try {
                return t(key, reason.textParams);
            } catch {
                return t(key);
            }
        }
        return t(reason.textKey.replace('priceOracle.', ''));
    };

    return (
        <div className={`mt-4 border rounded-xl p-4 ${colors.bg} ${colors.border}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-white shadow-sm ${colors.text}`}>
                        <Icon size={20} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h4 className={`font-bold text-sm ${colors.text}`}>
                                🔮 {t('title')}
                            </h4>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${colors.badgeBg} ${colors.text}`}>
                                {t(colors.labelKey)}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                            <Shield size={12} className="text-slate-400" />
                            <span className="text-xs text-slate-500">
                                {t('confidence')}: %{forecast.confidence}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Risk Score */}
                <div className="text-right">
                    <div className={`text-2xl font-black ${colors.text}`}>
                        {forecast.riskScore}
                    </div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                        {t('riskScore')}
                    </span>
                </div>
            </div>

            {/* Risk Bar */}
            <div className="mb-3">
                <div className="h-2 bg-white rounded-full overflow-hidden shadow-inner">
                    <div
                        className={`h-full transition-all ${forecast.riskScore >= 70 ? 'bg-red-500' :
                            forecast.riskScore >= 40 ? 'bg-amber-500' :
                                'bg-emerald-500'
                            }`}
                        style={{ width: `${forecast.riskScore}%` }}
                    />
                </div>
            </div>

            {/* Signals (Evidence) */}
            <div className="space-y-1.5 mb-3">
                {forecast.reasons.map((reason, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                        <Info size={12} className="mt-0.5 opacity-60 shrink-0" />
                        <span>{getSignalText(reason)}</span>
                    </div>
                ))}
            </div>

            {/* Call to Action */}
            {forecast.action === 'BUY_NOW' && forecast.riskScore >= 70 && (
                <div className="pt-3 border-t border-red-200">
                    <div className="flex items-center gap-2 text-sm font-semibold text-red-600">
                        <AlertCircle size={16} />
                        <span>{t('badges.buyNow')}</span>
                    </div>
                </div>
            )}

            {forecast.action === 'WAIT' && (
                <div className="pt-3 border-t border-emerald-200">
                    <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
                        <TrendingDown size={16} />
                        <span>{t('badges.wait')}</span>
                    </div>
                </div>
            )}
        </div>
    );
}


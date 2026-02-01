'use client';
import { useState } from 'react';
import { ShieldAlert, ShieldCheck, Info, TrendingDown } from 'lucide-react';
import { calculateFlightRisk } from '@/utils/riskEngine';

export function FlexibilityWidget({ price, daysToDeparture }: { price: number, daysToDeparture: number }) {
    const [showTooltip, setShowTooltip] = useState(false);

    // Analizi çalıştır
    const analysis = calculateFlightRisk(price, daysToDeparture, 'TIER_1');

    // Stil Ayarları
    const styles = {
        LOW: {
            bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200',
            icon: <ShieldCheck className="w-4 h-4" />, label: 'Fiyat Güvenli'
        },
        MEDIUM: {
            bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200',
            icon: <Info className="w-4 h-4" />, label: 'Risk Analizi'
        },
        HIGH: {
            bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200',
            icon: <ShieldAlert className="w-4 h-4" />, label: '⚠️ Düşüş Bekleniyor'
        }
    };

    const style = styles[analysis.riskLevel];

    return (
        <div className="relative">

            {/* 1. KÜÇÜK ETİKET (BADGE) */}
            <button
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold border cursor-help transition-all ${style.bg} ${style.text} ${style.border}`}
            >
                {style.icon}
                {style.label}
            </button>

            {/* 2. DETAYLI ANALİZ KUTUSU (TOOLTIP) */}
            {showTooltip && (
                <div className="absolute top-8 right-0 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-4 z-50 animate-in fade-in slide-in-from-top-2">

                    <div className="flex items-start justify-between mb-2">
                        <h4 className="font-bold text-slate-900 flex items-center gap-2">
                            🧮 Guardian Yapay Zekası
                        </h4>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${style.bg} ${style.text}`}>
                            {analysis.riskLevel} RİSK
                        </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed mb-3">
                        {analysis.reason}
                    </p>

                    {analysis.recommendation === 'BUY_FLEX' && (
                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-full">
                                    <TrendingDown className="w-4 h-4" />
                                </div>
                                <div>
                                    <div className="text-[10px] uppercase font-bold text-slate-400">Beklenen Fiyat Düşüşü</div>
                                    <div className="text-sm font-black text-emerald-600">-{analysis.potentialSavings} AUD</div>
                                </div>
                            </div>
                            <div className="text-[10px] text-slate-500">
                                <strong>Öneri:</strong> Flex bilet alırsanız, fiyat düştüğünde cezasız iade edip yeni fiyattan alarak kâr edebilirsiniz.
                            </div>
                        </div>
                    )}

                    {analysis.recommendation === 'BUY_SAVER' && (
                        <div className="text-xs text-emerald-700 font-bold bg-emerald-50 p-2 rounded border border-emerald-100 text-center">
                            ✅ Şu anki fiyat dip noktada. İadesiz (Saver) bilet almak matematiksel olarak en kârlı seçenek.
                        </div>
                    )}

                    {/* Ok İşareti */}
                    <div className="absolute -top-1.5 right-6 w-3 h-3 bg-white border-t border-l border-slate-200 rotate-45"></div>
                </div>
            )}
        </div>
    );
}

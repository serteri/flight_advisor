'use client';

import { useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { CheckCircle2, Zap, FileText, Shield, BellRing, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

export function UnlockPricingPage() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const t = useTranslations('PricingPage');
    const locale = pathname?.split('/')[1] || 'en';
    const [loading, setLoading] = useState<null | 'PRO' | 'REPORT'>(null);

    const selectedOffer = useMemo(() => {
        const offer = (searchParams.get('offer') || '').toLowerCase();
        if (offer === 'report') return 'REPORT';
        return 'PRO';
    }, [searchParams]);

    const startProCheckout = async () => {
        try {
            setLoading('PRO');
            const response = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan: 'PRO', billingCycle: 'monthly', trial: false }),
            });

            const data = await response.json();
            if (response.ok && data?.url) {
                window.location.href = data.url;
                return;
            }
        } catch {
            // fallback below
        } finally {
            setLoading(null);
        }

        window.location.href = `/${locale}/pricing`;
    };

    const openOneTimeReport = () => {
        const direct = process.env.NEXT_PUBLIC_ONE_TIME_REPORT_URL || process.env.NEXT_PUBLIC_STRIPE_ONE_TIME_REPORT_LINK;
        if (direct) {
            window.location.href = direct;
            return;
        }
        window.location.href = `/${locale}/pricing?offer=report`;
    };

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_20%_10%,#dbeafe_0%,#f8fafc_35%,#ffffff_70%)]">
            <div className="max-w-6xl mx-auto px-4 py-10 md:py-14">
                <div className="flex items-center justify-between mb-10">
                    <div>
                        <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900">{t('title')}</h1>
                        <p className="mt-2 text-slate-600">{t('subtitle')}</p>
                    </div>
                    <Link
                        href={`/${locale}`}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400"
                    >
                        <ArrowLeft className="w-4 h-4" /> {t('back')}
                    </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className={`rounded-3xl border-2 p-6 md:p-7 shadow-lg ${selectedOffer === 'PRO' ? 'border-blue-500 bg-blue-50/60' : 'border-slate-200 bg-white'}`}>
                        <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700 mb-4">
                            <Zap className="w-3.5 h-3.5" /> {t('monthlyPro')}
                        </div>
                        <div className="text-4xl font-black text-slate-900">$19<span className="text-base font-semibold text-slate-500">/month</span></div>
                        <p className="mt-2 text-sm text-slate-600">{t('proDesc')}</p>

                        <ul className="mt-5 space-y-2.5 text-sm">
                            <li className="flex items-center gap-2 text-slate-700"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> {t('proItem1')}</li>
                            <li className="flex items-center gap-2 text-slate-700"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> {t('proItem2')}</li>
                            <li className="flex items-center gap-2 text-slate-700"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> {t('proItem3')}</li>
                            <li className="flex items-center gap-2 text-slate-700"><BellRing className="w-4 h-4 text-blue-600" /> {t('proItem4')}</li>
                        </ul>

                        <button
                            onClick={startProCheckout}
                            disabled={loading === 'PRO'}
                            className="mt-6 w-full rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-70 text-white font-bold py-3"
                        >
                            {loading === 'PRO' ? t('connecting') : t('upgradeToPro')}
                        </button>
                    </div>

                    <div className={`rounded-3xl border-2 p-6 md:p-7 shadow-lg ${selectedOffer === 'REPORT' ? 'border-indigo-500 bg-indigo-50/60' : 'border-slate-200 bg-white'}`}>
                        <div className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700 mb-4">
                            <FileText className="w-3.5 h-3.5" /> {t('oneTimeReport')}
                        </div>
                        <div className="text-4xl font-black text-slate-900">$4.99<span className="text-base font-semibold text-slate-500"> one-time</span></div>
                        <p className="mt-2 text-sm text-slate-600">{t('reportDesc')}</p>

                        <ul className="mt-5 space-y-2.5 text-sm">
                            <li className="flex items-center gap-2 text-slate-700"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> {t('reportItem1')}</li>
                            <li className="flex items-center gap-2 text-slate-700"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> {t('reportItem2')}</li>
                            <li className="flex items-center gap-2 text-slate-700"><Shield className="w-4 h-4 text-indigo-600" /> {t('reportItem3')}</li>
                        </ul>

                        <button
                            onClick={openOneTimeReport}
                            disabled={loading === 'REPORT'}
                            className="mt-6 w-full rounded-xl bg-white border border-slate-300 hover:border-slate-400 text-slate-800 font-bold py-3"
                        >
                            {t('buyOneTime')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

"use client";

import { ShieldCheck, Bell, FileText, Mail, History } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

export default function PricingPage() {
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const t = useTranslations('PricingPage.guardian');

    async function handleCheckout() {
        if (isCheckingOut) return;

        setIsCheckingOut(true);
        try {
            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan: 'PRO',
                    billingCycle: 'monthly',
                }),
            });

            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
                return;
            }

            throw new Error(data?.error || 'Checkout URL was not returned.');
        } catch (error) {
            console.error('[PRICING] Checkout start failed:', error);
        } finally {
            setIsCheckingOut(false);
        }
    }

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_20%_10%,#d1fae5_0%,#f8fafc_35%,#ffffff_70%)]">
            <div className="max-w-6xl mx-auto px-4 py-10 md:py-14">
                <div className="mb-6">
                    <Link href="/" className="text-sm font-semibold text-slate-700 hover:text-slate-900">
                        ← {t('backToHome')}
                    </Link>
                </div>

                <div className="mb-10 text-center">
                    <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900">{t('title')}</h1>
                    <p className="mt-3 text-slate-600">{t('subtitle')}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="rounded-3xl border-2 border-slate-200 bg-white p-6 md:p-7 shadow-lg">
                        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 mb-4">
                            <ShieldCheck className="w-3.5 h-3.5" /> FREE
                        </div>
                        <div className="text-4xl font-black text-slate-900">$0<span className="text-base font-semibold text-slate-500">/month</span></div>

                        <ul className="mt-5 space-y-2.5 text-sm">
                            <li className="flex items-center gap-2 text-slate-700"><ShieldCheck className="w-4 h-4 text-emerald-600" /> {t('free.item1')}</li>
                            <li className="flex items-center gap-2 text-slate-700"><Bell className="w-4 h-4 text-emerald-600" /> {t('free.item2')}</li>
                            <li className="flex items-center gap-2 text-slate-700"><FileText className="w-4 h-4 text-emerald-600" /> {t('free.item3')}</li>
                            <li className="flex items-center gap-2 text-slate-700"><FileText className="w-4 h-4 text-emerald-600" /> {t('free.item4')}</li>
                        </ul>

                        <Link
                            href="/register"
                            className="mt-6 inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white hover:border-slate-400 text-slate-800 font-bold py-3"
                        >
                            {t('free.cta')}
                        </Link>
                    </div>

                    <div className="rounded-3xl border-2 border-emerald-500 bg-emerald-50/60 p-6 md:p-7 shadow-lg">
                        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 mb-4">
                            <ShieldCheck className="w-3.5 h-3.5" /> PRO
                        </div>
                        <div className="text-4xl font-black text-slate-900">$19<span className="text-base font-semibold text-slate-500">/month</span></div>

                        <ul className="mt-5 space-y-2.5 text-sm">
                            <li className="flex items-center gap-2 text-slate-700"><ShieldCheck className="w-4 h-4 text-emerald-600" /> {t('pro.item1')}</li>
                            <li className="flex items-center gap-2 text-slate-700"><Bell className="w-4 h-4 text-emerald-600" /> {t('pro.item2')}</li>
                            <li className="flex items-center gap-2 text-slate-700"><FileText className="w-4 h-4 text-emerald-600" /> {t('pro.item3')}</li>
                            <li className="flex items-center gap-2 text-slate-700"><Mail className="w-4 h-4 text-emerald-600" /> {t('pro.item4')}</li>
                            <li className="flex items-center gap-2 text-slate-700"><History className="w-4 h-4 text-emerald-600" /> {t('pro.item5')}</li>
                        </ul>

                        <button
                            type="button"
                            onClick={handleCheckout}
                            disabled={isCheckingOut}
                            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3"
                        >
                            {isCheckingOut ? t('pro.checkingOut') : t('pro.cta')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

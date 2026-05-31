"use client";

import { ShieldCheck, Bell, FileText, Mail, History } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

export default function PricingPage() {
    const params = useParams<{ locale?: string | string[] }>();
    const localeParam = Array.isArray(params?.locale) ? params.locale[0] : params?.locale;
    const locale = localeParam || 'en';
    const [isCheckingOut, setIsCheckingOut] = useState(false);

    async function handleCheckout(plan: string) {
        if (isCheckingOut) return;

        setIsCheckingOut(true);
        try {
            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan,
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
                    <Link href={`/${locale}`} className="text-sm font-semibold text-slate-700 hover:text-slate-900">
                        ← Back to home
                    </Link>
                </div>

                <div className="mb-10 text-center">
                    <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900">Simple plans for flight protection</h1>
                    <p className="mt-3 text-slate-600">Monitor your trips and get compensated when things go wrong.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="rounded-3xl border-2 border-slate-200 bg-white p-6 md:p-7 shadow-lg">
                        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 mb-4">
                            <ShieldCheck className="w-3.5 h-3.5" /> FREE
                        </div>
                        <div className="text-4xl font-black text-slate-900">$0<span className="text-base font-semibold text-slate-500">/month</span></div>

                        <ul className="mt-5 space-y-2.5 text-sm">
                            <li className="flex items-center gap-2 text-slate-700"><ShieldCheck className="w-4 h-4 text-emerald-600" /> Monitor 1 flight</li>
                            <li className="flex items-center gap-2 text-slate-700"><Bell className="w-4 h-4 text-emerald-600" /> Disruption alerts (email)</li>
                            <li className="flex items-center gap-2 text-slate-700"><FileText className="w-4 h-4 text-emerald-600" /> EU261 eligibility check</li>
                            <li className="flex items-center gap-2 text-slate-700"><FileText className="w-4 h-4 text-emerald-600" /> Basic claim letter</li>
                        </ul>

                        <Link
                            href={`/${locale}/register`}
                            className="mt-6 inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white hover:border-slate-400 text-slate-800 font-bold py-3"
                        >
                            Get started free
                        </Link>
                    </div>

                    <div className="rounded-3xl border-2 border-emerald-500 bg-emerald-50/60 p-6 md:p-7 shadow-lg">
                        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 mb-4">
                            <ShieldCheck className="w-3.5 h-3.5" /> PRO
                        </div>
                        <div className="text-4xl font-black text-slate-900">$19<span className="text-base font-semibold text-slate-500">/month</span></div>

                        <ul className="mt-5 space-y-2.5 text-sm">
                            <li className="flex items-center gap-2 text-slate-700"><ShieldCheck className="w-4 h-4 text-emerald-600" /> Monitor unlimited flights</li>
                            <li className="flex items-center gap-2 text-slate-700"><Bell className="w-4 h-4 text-emerald-600" /> Priority disruption alerts</li>
                            <li className="flex items-center gap-2 text-slate-700"><FileText className="w-4 h-4 text-emerald-600" /> EU261 claim letter + PDF</li>
                            <li className="flex items-center gap-2 text-slate-700"><Mail className="w-4 h-4 text-emerald-600" /> Email to airline (automated)</li>
                            <li className="flex items-center gap-2 text-slate-700"><History className="w-4 h-4 text-emerald-600" /> Alert history</li>
                        </ul>

                        <button
                            type="button"
                            onClick={() => handleCheckout('PRO')}
                            disabled={isCheckingOut}
                            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3"
                        >
                            {isCheckingOut ? 'Starting checkout...' : 'Start Pro'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

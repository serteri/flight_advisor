'use client';

import { useTranslations } from 'next-intl';
import { Sparkles, ArrowRight } from 'lucide-react';

interface CompensationCardProps {
    tripId: string;
}

export function CompensationCard({ tripId }: CompensationCardProps) {
    const t = useTranslations('GuardianTripDetails.compensation');

    return (
        <div className="relative overflow-hidden rounded-3xl border border-amber-300 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-6 md:p-8 shadow-sm">
            <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-amber-200/40 blur-3xl" aria-hidden="true" />

            <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg md:text-xl font-bold text-slate-900">{t('title')}</h2>
                        <p className="mt-1 text-sm text-slate-600 max-w-xl">{t('description')}</p>
                    </div>
                </div>

                <a
                    href={`/claim-process/${tripId}`}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-amber-500 hover:from-emerald-500 hover:to-amber-400 text-white font-semibold px-5 py-3 text-sm shadow-sm shadow-amber-300/40 transition-all"
                >
                    {t('buttonText')}
                    <ArrowRight className="w-4 h-4" />
                </a>
            </div>
        </div>
    );
}

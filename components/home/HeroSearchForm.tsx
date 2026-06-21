'use client';

import { useState } from 'react';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Loader2, Mail, Plane, Calendar, ShieldCheck } from 'lucide-react';

type FieldErrors = {
    flightNumber?: string;
    date?: string;
    email?: string;
    consent?: string;
};

export function HeroSearchForm() {
    const t = useTranslations('HomePage.guardian.heroForm');
    const router = useRouter();

    const [flightNumber, setFlightNumber] = useState('');
    const [date, setDate] = useState('');
    const [email, setEmail] = useState('');
    const [consent, setConsent] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const formSchema = z.object({
        flightNumber: z.string().min(3, { message: t('errors.invalidFlight') }),
        date: z.coerce
            .date({ message: t('errors.invalidDate') })
            .min(startOfToday, { message: t('errors.invalidDate') }),
        email: z.string().email({ message: t('errors.invalidEmail') }),
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        setError(null);

        const result = formSchema.safeParse({ flightNumber, date, email });
        const nextFieldErrors: FieldErrors = {};

        if (!result.success) {
            for (const issue of result.error.issues) {
                const field = issue.path[0] as keyof FieldErrors;
                if (field && !nextFieldErrors[field]) {
                    nextFieldErrors[field] = issue.message;
                }
            }
        }

        if (!consent) {
            nextFieldErrors.consent = t('errors.consentRequired');
        }

        setFieldErrors(nextFieldErrors);
        if (Object.keys(nextFieldErrors).length > 0) {
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await fetch('/api/trips/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ flightNumber, date, email, consent }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data?.error || t('genericError'));
                setIsSubmitting(false);
                return;
            }

            router.push(`/trip/${data.id}`);
        } catch {
            setError(t('genericError'));
            setIsSubmitting(false);
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            noValidate
            className="max-w-xl mx-auto bg-white rounded-3xl border border-slate-200 shadow-lg p-6 md:p-8 space-y-4 text-left"
        >
            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                    <label htmlFor="flightNumber" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {t('flightNumberLabel')}
                    </label>
                    <div className="relative">
                        <Plane className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            id="flightNumber"
                            type="text"
                            value={flightNumber}
                            onChange={(e) => setFlightNumber(e.target.value)}
                            placeholder={t('flightNumberPlaceholder')}
                            className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>
                    {fieldErrors.flightNumber && (
                        <p className="text-red-500 text-sm">{fieldErrors.flightNumber}</p>
                    )}
                </div>

                <div className="space-y-1.5">
                    <label htmlFor="flightDate" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {t('dateLabel')}
                    </label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            id="flightDate"
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>
                    {fieldErrors.date && (
                        <p className="text-red-500 text-sm">{fieldErrors.date}</p>
                    )}
                </div>
            </div>

            <div className="space-y-1.5">
                <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t('emailLabel')}
                </label>
                <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t('emailPlaceholder')}
                        className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                </div>
                {fieldErrors.email && (
                    <p className="text-red-500 text-sm">{fieldErrors.email}</p>
                )}
            </div>

            <div className="space-y-1.5">
                <label className="flex items-start gap-2.5 text-sm text-slate-600">
                    <input
                        type="checkbox"
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>{t('consentText')}</span>
                </label>
                {fieldErrors.consent && (
                    <p className="text-red-500 text-sm">{fieldErrors.consent}</p>
                )}
            </div>

            {error && (
                <p className="text-sm font-medium text-red-600">{error}</p>
            )}

            <button
                type="submit"
                disabled={isSubmitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-white font-semibold py-3 text-sm disabled:opacity-60"
            >
                {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <ShieldCheck className="w-4 h-4" />
                )}
                {isSubmitting ? t('submitting') : t('submit')}
            </button>
        </form>
    );
}

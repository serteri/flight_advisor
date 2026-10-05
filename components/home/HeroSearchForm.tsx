'use client';

import { useState } from 'react';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { FlightLookupResult } from '@/components/home/FlightLookupResult';
import { submitGate, type LookupState } from '@/lib/flights/lookupFormState';
import { useRouter } from '@/i18n/routing';
import { Loader2, Mail, Plane, Calendar, ShieldCheck, Search } from 'lucide-react';
import { isValidFlightNumber } from '@/lib/flights/flightNumber';
import { validateFlightDate, type FlightDateError } from '@/lib/flights/flightDateRule';

type FieldErrors = {
    flightNumber?: string;
    date?: string;
    email?: string;
    consent?: string;
    lookup?: string;
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
    // "Find my flight" step: server-side lookup of number + date. Any edit resets it.
    const [lookup, setLookup] = useState<LookupState>({ kind: 'idle' });
    const [selectedKey, setSelectedKey] = useState<string | null>(null);

    const resetLookup = () => {
        setLookup({ kind: 'idle' });
        setSelectedKey(null);
    };

    // Same rule as /api/trips/track (lib/flights/flightDateRule.ts): no past
    // dates, at most 330 days ahead. Each error has its own message.
    const dateMessages: Record<FlightDateError, string> = {
        INVALID_DATE: t('errors.invalidDate'),
        DATE_PAST: t('errors.datePast'),
        DATE_TOO_FAR: t('errors.dateTooFar'),
    };
    // Server error codes → the field and message they belong to.
    const serverFieldErrors: Record<string, { field: keyof FieldErrors; message: string }> = {
        INVALID_FLIGHT: { field: 'flightNumber', message: t('errors.invalidFlight') },
        INVALID_DATE: { field: 'date', message: dateMessages.INVALID_DATE },
        DATE_PAST: { field: 'date', message: dateMessages.DATE_PAST },
        DATE_TOO_FAR: { field: 'date', message: dateMessages.DATE_TOO_FAR },
        INVALID_EMAIL: { field: 'email', message: t('errors.invalidEmail') },
        CONSENT_REQUIRED: { field: 'consent', message: t('errors.consentRequired') },
        FLIGHT_NOT_FOUND: { field: 'flightNumber', message: t('lookup.notFoundBlocking') },
        SEGMENT_REQUIRED: { field: 'lookup', message: t('lookup.errors.selectSegment') },
        INVALID_SEGMENT: { field: 'lookup', message: t('lookup.errors.staleSegment') },
    };

    const formSchema = z.object({
        flightNumber: z.string().refine(isValidFlightNumber, { message: t('errors.invalidFlight') }),
        date: z.string().superRefine((value, ctx) => {
            const check = validateFlightDate(value);
            if (!check.ok) ctx.addIssue({ code: 'custom', message: dateMessages[check.code] });
        }),
        email: z.string().email({ message: t('errors.invalidEmail') }),
    });

    // Validates number + date locally (no API call), then asks the server.
    const runLookup = async (): Promise<boolean> => {
        const check = formSchema.pick({ flightNumber: true, date: true }).safeParse({ flightNumber, date });
        if (!check.success) {
            const next: FieldErrors = {};
            for (const issue of check.error.issues) {
                const field = issue.path[0] as keyof FieldErrors;
                if (field && !next[field]) next[field] = issue.message;
            }
            setFieldErrors(next);
            return false;
        }
        setFieldErrors({});
        setLookup({ kind: 'loading' });
        try {
            const response = await fetch('/api/flights/lookup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ flightNumber, date }),
            });
            const data = await response.json().catch(() => null);
            if (response.status === 429 || data?.status === 'RATE_LIMITED') {
                setLookup({ kind: 'rateLimited' });
            } else if (response.ok && data?.status === 'FOUND' && Array.isArray(data.options) && data.options.length > 0) {
                setLookup({ kind: 'found', options: data.options });
                // A single leg still needs "This is my flight"; several need a choice.
            } else if (response.ok && data?.status === 'NOT_FOUND') {
                setLookup({ kind: 'notFound', blocking: data.blocking === true });
            } else {
                // SKIPPED (quota/provider), validation or server trouble: carry on as before.
                setLookup({ kind: 'skipped' });
            }
        } catch {
            setLookup({ kind: 'skipped' });
        }
        return true;
    };

    const gateMessages = {
        LOOKUP_REQUIRED: null,
        LOOKUP_PENDING: t('lookup.errors.pending'),
        SELECT_SEGMENT: t('lookup.errors.selectSegment'),
        CONFIRM_FLIGHT: t('lookup.errors.confirmFlight'),
        FLIGHT_NOT_FOUND: t('lookup.notFoundBlocking'),
    } as const;

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

        // The flight must be looked up (and, if found, confirmed) before sending.
        // Quota/provider trouble or a far-off schedule never blocks (see submitGate).
        const gate = submitGate(lookup, selectedKey);
        if (gate === 'LOOKUP_REQUIRED') {
            await runLookup();
            return;
        }
        if (gate) {
            setFieldErrors({ [gate === 'FLIGHT_NOT_FOUND' ? 'flightNumber' : 'lookup']: gateMessages[gate] ?? undefined });
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await fetch('/api/trips/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ flightNumber, date, email, consent, ...(selectedKey ? { legKey: selectedKey } : {}) }),
            });

            const data = await response.json();

            if (!response.ok) {
                const mapped = data?.code ? serverFieldErrors[data.code] : undefined;
                if (mapped) {
                    setFieldErrors({ [mapped.field]: mapped.message });
                    if (data.code === 'INVALID_SEGMENT') resetLookup();
                } else {
                    setError(data?.error || t('genericError'));
                }
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
                            onChange={(e) => { setFlightNumber(e.target.value); resetLookup(); }}
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
                            onChange={(e) => { setDate(e.target.value); resetLookup(); }}
                            className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>
                    {fieldErrors.date && (
                        <p className="text-red-500 text-sm">{fieldErrors.date}</p>
                    )}
                </div>
            </div>

            <div className="space-y-2" aria-live="polite">
                <button
                    type="button"
                    onClick={() => void runLookup()}
                    disabled={isSubmitting || lookup.kind === 'loading'}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
                >
                    {lookup.kind === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    {lookup.kind === 'loading' ? t('lookup.finding') : t('lookup.find')}
                </button>
                {lookup.kind === 'found' && (
                    <FlightLookupResult options={lookup.options} selectedKey={selectedKey} onSelect={setSelectedKey} />
                )}
                {lookup.kind === 'notFound' && (
                    <p className={`text-sm ${lookup.blocking ? 'text-red-600 font-medium' : 'text-amber-700'}`}>
                        {lookup.blocking ? t('lookup.notFoundBlocking') : t('lookup.notFoundSoft')}
                    </p>
                )}
                {lookup.kind === 'skipped' && <p className="text-sm text-slate-500">{t('lookup.skipped')}</p>}
                {lookup.kind === 'rateLimited' && <p className="text-sm text-slate-500">{t('lookup.rateLimited')}</p>}
                {fieldErrors.lookup && <p className="text-red-500 text-sm">{fieldErrors.lookup}</p>}
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

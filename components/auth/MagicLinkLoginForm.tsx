'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Mail, Loader2, Send } from 'lucide-react';

export function MagicLinkLoginForm() {
    const t = useTranslations('MagicLogin');

    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        setError(null);
        setIsSubmitting(true);

        try {
            const response = await fetch('/api/auth/request-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                setError(data?.error || t('genericError'));
                setIsSubmitting(false);
                return;
            }

            setSent(true);
        } catch {
            setError(t('genericError'));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (sent) {
        return (
            <div className="max-w-md mx-auto bg-white rounded-3xl border border-slate-200 shadow-sm p-8 text-center space-y-3">
                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                    <Mail className="w-6 h-6 text-emerald-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">{t('sentTitle')}</h2>
                <p className="text-sm text-slate-600">{t('sentSubtitle')}</p>
            </div>
        );
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="max-w-md mx-auto bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-4"
        >
            <h1 className="text-xl font-bold text-slate-900">{t('title')}</h1>
            <p className="text-sm text-slate-600">{t('subtitle')}</p>

            <div className="space-y-1.5">
                <label htmlFor="magic-email" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t('emailLabel')}
                </label>
                <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        id="magic-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t('emailPlaceholder')}
                        className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                </div>
            </div>

            {error && <p className="text-sm font-medium text-red-600">{error}</p>}

            <button
                type="submit"
                disabled={isSubmitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-white font-semibold py-3 text-sm disabled:opacity-60"
            >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {isSubmitting ? t('submitting') : t('submit')}
            </button>
        </form>
    );
}

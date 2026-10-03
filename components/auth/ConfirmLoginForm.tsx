'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ShieldCheck } from 'lucide-react';

// Plain form POST (works without JS). The button locks on submit so a double
// click can't fire two consuming requests.
export function ConfirmLoginForm({ token, redirectTo }: { token: string; redirectTo?: string }) {
    const t = useTranslations('ConfirmLogin');
    const [submitting, setSubmitting] = useState(false);

    return (
        <form
            method="post"
            action="/api/auth/verify"
            onSubmit={() => setSubmitting(true)}
            className="max-w-md mx-auto bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-4 text-center"
        >
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-emerald-600" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">{t('title')}</h1>
            <p className="text-sm text-slate-600">{t('body')}</p>
            <input type="hidden" name="token" value={token} />
            {redirectTo ? <input type="hidden" name="redirect" value={redirectTo} /> : null}
            <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
                {submitting ? t('submitting') : t('button')}
            </button>
        </form>
    );
}

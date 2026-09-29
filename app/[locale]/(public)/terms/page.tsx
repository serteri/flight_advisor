import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

// TODO(owner): replace this placeholder with the final terms text.
// Kept out of search results until the real content is published.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);
    const t = await getTranslations('Legal');

    return (
        <div className="container mx-auto px-4 md:px-6 py-16 max-w-3xl">
            <h1 className="text-3xl font-bold text-slate-900 mb-6">{t('termsTitle')}</h1>
            <p className="text-slate-600">{t('placeholder')}</p>
        </div>
    );
}

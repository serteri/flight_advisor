import { useTranslations } from 'next-intl';

// "Not legal advice" notice shown in the footer and throughout the claim flow.
export function LegalDisclaimer({ className = '' }: { className?: string }) {
    const t = useTranslations('Legal');
    return (
        <p className={`text-xs leading-relaxed text-slate-500 ${className}`}>
            {t('disclaimer')}
        </p>
    );
}

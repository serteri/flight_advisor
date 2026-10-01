import { useTranslations } from 'next-intl';
import { Mail } from 'lucide-react';

// Shown while EMAIL_DELIVERY_READY is off (waitlist mode): email-based sign-in
// and alerts are not active yet. Render it only when isEmailDeliveryReady() is false.
export function WaitlistNotice({ className = '' }: { className?: string }) {
    const t = useTranslations('Waitlist');
    return (
        <div role="status" className={`flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 ${className}`}>
            <Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{t('loginNotice')}</p>
        </div>
    );
}

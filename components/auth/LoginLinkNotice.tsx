import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';

// Explains why /api/auth/verify sent the user back here (?error=...).
const MESSAGE_KEY = {
    missing_token: 'linkMissing',
    expired_token: 'linkExpired',
    verify_failed: 'linkFailed',
} as const;

export function LoginLinkNotice({ error, className = '' }: { error?: string; className?: string }) {
    const t = useTranslations('MagicLogin');
    const key = error && Object.hasOwn(MESSAGE_KEY, error) ? MESSAGE_KEY[error as keyof typeof MESSAGE_KEY] : null;
    if (!key) return null;
    return (
        <div role="alert" className={`flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 ${className}`}>
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{t(key)}</p>
        </div>
    );
}

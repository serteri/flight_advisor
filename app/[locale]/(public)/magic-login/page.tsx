import { MagicLinkLoginForm } from '@/components/auth/MagicLinkLoginForm';
import { LoginLinkNotice } from '@/components/auth/LoginLinkNotice';
import { WaitlistNotice } from '@/components/auth/WaitlistNotice';
import { isEmailDeliveryReady } from '@/lib/featureFlags';

// Env flag read per request, not at build time.
export const dynamic = 'force-dynamic';

export default async function MagicLoginPage({
    searchParams,
}: {
    searchParams: Promise<{ error?: string | string[] }>;
}) {
    const { error } = await searchParams;
    return (
        <div className="container mx-auto px-4 md:px-6 py-16 space-y-4">
            <LoginLinkNotice error={Array.isArray(error) ? error[0] : error} className="max-w-md mx-auto" />
            {isEmailDeliveryReady() ? (
                <MagicLinkLoginForm />
            ) : (
                <WaitlistNotice className="max-w-md mx-auto" />
            )}
        </div>
    );
}

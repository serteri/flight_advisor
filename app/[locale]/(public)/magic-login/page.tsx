import { MagicLinkLoginForm } from '@/components/auth/MagicLinkLoginForm';
import { WaitlistNotice } from '@/components/auth/WaitlistNotice';
import { isEmailDeliveryReady } from '@/lib/featureFlags';

// Env flag read per request, not at build time.
export const dynamic = 'force-dynamic';

export default function MagicLoginPage() {
    return (
        <div className="container mx-auto px-4 md:px-6 py-16">
            {isEmailDeliveryReady() ? (
                <MagicLinkLoginForm />
            ) : (
                <WaitlistNotice className="max-w-md mx-auto" />
            )}
        </div>
    );
}

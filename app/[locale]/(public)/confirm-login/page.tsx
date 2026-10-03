import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ConfirmLoginForm } from '@/components/auth/ConfirmLoginForm';

// The page carries a one-time token: never indexed, never sent as a referrer.
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: 'no-referrer' };
export const dynamic = 'force-dynamic';

export default async function ConfirmLoginPage({
    searchParams,
}: {
    searchParams: Promise<{ token?: string | string[]; redirect?: string | string[] }>;
}) {
    const params = await searchParams;
    const token = Array.isArray(params.token) ? params.token[0] : params.token;
    const redirectTo = Array.isArray(params.redirect) ? params.redirect[0] : params.redirect;
    if (!token) redirect('/magic-login?error=missing_token');

    return (
        <div className="container mx-auto px-4 md:px-6 py-16">
            <ConfirmLoginForm token={token} redirectTo={redirectTo} />
        </div>
    );
}

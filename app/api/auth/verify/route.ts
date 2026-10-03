import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { AUTH_SESSION_COOKIE, createSessionCookieValue } from '@/lib/auth/magicLinkSession';
import { confirmPendingTrips } from '@/lib/guardian/tripConfirmation';
import { verifyLoginLink } from '@/lib/auth/verifyLoginLink';

const DEFAULT_REDIRECT_PATH = '/my-trips';

function getSafeRedirectPath(rawRedirect: string | null): string {
    if (!rawRedirect) {
        return DEFAULT_REDIRECT_PATH;
    }

    if (!rawRedirect.startsWith('/') || rawRedirect.startsWith('//')) {
        return DEFAULT_REDIRECT_PATH;
    }

    return rawRedirect;
}

export async function GET(req: Request) {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    const redirectPath = getSafeRedirectPath(url.searchParams.get('redirect'));
    const to = (path: string) => NextResponse.redirect(new URL(path, url.origin));

    if (!token) {
        return to('/magic-login?error=missing_token');
    }

    // Never a 500: every failure ends on /magic-login with a readable message.
    try {
        const outcome = await verifyLoginLink(token, {
            findToken: (t) => prisma.loginToken.findUnique({ where: { token: t } }),
            consumeToken: async (t) => (await prisma.loginToken.deleteMany({ where: { token: t } })).count === 1,
            upsertUser: (email) => prisma.user.upsert({ where: { email }, update: {}, create: { email } }),
            confirmPendingTrips,
        });

        if (outcome.kind === 'expired') return to('/magic-login?error=expired_token');
        if (outcome.kind === 'failed') return to('/magic-login?error=verify_failed');

        const cookieStore = await cookies();
        cookieStore.set(AUTH_SESSION_COOKIE, createSessionCookieValue(outcome.userId), {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 30 * 24 * 60 * 60,
        });

        return to(redirectPath);
    } catch (error) {
        console.error('[Auth:verify] unexpected failure after token check', error);
        return to('/magic-login?error=verify_failed');
    }
}

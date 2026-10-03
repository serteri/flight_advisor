// app/api/auth/verify/route.ts
//
// Magic-link / opt-in verification, in two steps so mail scanners can't burn
// the link:
//   GET  ?token=…  read-only; redirects to the "Confirm" page (never consumes).
//   POST token=…   the human's click; consumes the token, confirms pending
//                  trips, sets the session cookie, 303-redirects to the target.
// Neither ever answers 500 — failures redirect to /magic-login?error=….

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { AUTH_SESSION_COOKIE, createSessionCookieValue, verifySessionCookieValue } from '@/lib/auth/magicLinkSession';
import { confirmPendingTrips } from '@/lib/guardian/tripConfirmation';
import { inspectLoginLink, verifyLoginLink, type VerifyDeps } from '@/lib/auth/verifyLoginLink';

export const dynamic = 'force-dynamic';

const DEFAULT_REDIRECT_PATH = '/my-trips';

function getSafeRedirectPath(rawRedirect: string | null | undefined): string {
    if (!rawRedirect) {
        return DEFAULT_REDIRECT_PATH;
    }

    if (!rawRedirect.startsWith('/') || rawRedirect.startsWith('//')) {
        return DEFAULT_REDIRECT_PATH;
    }

    return rawRedirect;
}

const deps: Pick<VerifyDeps, 'findToken' | 'consumeToken' | 'upsertUser' | 'confirmPendingTrips'> = {
    findToken: (token) => prisma.loginToken.findUnique({ where: { token } }),
    // deleteMany never throws on a missing row (delete() would: P2025), and
    // count === 1 is true for exactly one of any number of concurrent callers.
    consumeToken: async (token) => (await prisma.loginToken.deleteMany({ where: { token } })).count === 1,
    upsertUser: (email) => prisma.user.upsert({ where: { email }, update: {}, create: { email } }),
    confirmPendingTrips,
};

async function hasValidSession(): Promise<boolean> {
    try {
        return verifySessionCookieValue((await cookies()).get(AUTH_SESSION_COOKIE)?.value) !== null;
    } catch {
        return false; // missing secret etc. counts as no session
    }
}

// Link already used (or expired). Someone who is logged in anyway just goes on;
// otherwise they are told to request a new link.
async function linkUnusable(url: URL, redirectPath: string, status?: number) {
    if (await hasValidSession()) return NextResponse.redirect(new URL(redirectPath, url.origin), status);
    return NextResponse.redirect(new URL('/magic-login?error=expired_token', url.origin), status);
}

export async function GET(req: Request) {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    const redirectPath = getSafeRedirectPath(url.searchParams.get('redirect'));

    if (!token) {
        return NextResponse.redirect(new URL('/magic-login?error=missing_token', url.origin));
    }

    try {
        const outcome = await inspectLoginLink(token, deps);
        if (outcome.kind === 'failed') {
            return NextResponse.redirect(new URL('/magic-login?error=verify_failed', url.origin));
        }
        if (outcome.kind === 'expired') return await linkUnusable(url, redirectPath);

        const confirmUrl = new URL('/confirm-login', url.origin);
        confirmUrl.searchParams.set('token', token);
        if (redirectPath !== DEFAULT_REDIRECT_PATH) confirmUrl.searchParams.set('redirect', redirectPath);
        return NextResponse.redirect(confirmUrl);
    } catch (error) {
        console.error('[Auth:verify] unexpected GET failure', error);
        return NextResponse.redirect(new URL('/magic-login?error=verify_failed', url.origin));
    }
}

export async function POST(req: Request) {
    const url = new URL(req.url);
    const SEE_OTHER = 303; // the browser must follow with GET

    try {
        // Login CSRF guard: a cross-site form must not log the visitor in.
        const origin = req.headers.get('origin');
        if (origin && origin !== url.origin) {
            console.warn(`[Auth:verify] rejected cross-origin POST from ${origin}`);
            return NextResponse.redirect(new URL('/magic-login?error=verify_failed', url.origin), SEE_OTHER);
        }

        const form = await req.formData();
        const token = form.get('token');
        const redirectRaw = form.get('redirect');
        const redirectPath = getSafeRedirectPath(typeof redirectRaw === 'string' ? redirectRaw : null);

        if (typeof token !== 'string' || !token) {
            return NextResponse.redirect(new URL('/magic-login?error=missing_token', url.origin), SEE_OTHER);
        }

        const outcome = await verifyLoginLink(token, deps);
        if (outcome.kind === 'expired') return await linkUnusable(url, redirectPath, SEE_OTHER);
        if (outcome.kind === 'failed') {
            return NextResponse.redirect(new URL('/magic-login?error=verify_failed', url.origin), SEE_OTHER);
        }

        const cookieStore = await cookies();
        cookieStore.set(AUTH_SESSION_COOKIE, createSessionCookieValue(outcome.userId), {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 30 * 24 * 60 * 60,
        });

        return NextResponse.redirect(new URL(redirectPath, url.origin), SEE_OTHER);
    } catch (error) {
        console.error('[Auth:verify] unexpected POST failure', error);
        return NextResponse.redirect(new URL('/magic-login?error=verify_failed', url.origin), SEE_OTHER);
    }
}

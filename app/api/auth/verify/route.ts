import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { AUTH_SESSION_COOKIE, createSessionCookieValue } from '@/lib/auth/magicLinkSession';

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

    if (!token) {
        return NextResponse.redirect(new URL('/magic-login?error=missing_token', url.origin));
    }

    const loginToken = await prisma.loginToken.findUnique({ where: { token } });

    if (!loginToken || loginToken.expiresAt < new Date()) {
        if (loginToken) {
            await prisma.loginToken.delete({ where: { token } }).catch(() => undefined);
        }
        return NextResponse.redirect(new URL('/magic-login?error=expired_token', url.origin));
    }

    const user = await prisma.user.upsert({
        where: { email: loginToken.identifier },
        update: {},
        create: { email: loginToken.identifier },
    });

    await prisma.loginToken.delete({ where: { token } });

    const cookieStore = await cookies();
    cookieStore.set(AUTH_SESSION_COOKIE, createSessionCookieValue(user.id), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
    });

    return NextResponse.redirect(new URL(redirectPath, url.origin));
}

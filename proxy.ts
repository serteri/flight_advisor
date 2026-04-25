import NextAuth from "next-auth";
import authConfig from "@/auth.config";
import createMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const { auth } = NextAuth(authConfig);

const intlMiddleware = createMiddleware({
    locales: ['en', 'tr', 'de'],
    defaultLocale: 'en'
});

function apiBypass(req: NextRequest) {
    const pathname = req.nextUrl.pathname;

    if (pathname.startsWith('/api/')) {
        console.log('[PROXY] API bypass - direct passthrough:', pathname);
        return NextResponse.next();
    }

    return null;
}

function notifyCompanyVisit(req: NextRequest) {
    const company = req.nextUrl.searchParams.get('c');
    if (!company) {
        return;
    }

    const notifyUrl = new URL('/api/notify-visit', req.url);

    void fetch(notifyUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            company,
            path: req.nextUrl.pathname,
            timestamp: Date.now(),
        }),
    }).catch(() => undefined);
}

// @ts-ignore
export default auth((req) => {
    const apiBypassResult = apiBypass(req as NextRequest);
    if (apiBypassResult !== null) {
        return apiBypassResult;
    }

    notifyCompanyVisit(req as NextRequest);

    const pathname = req.nextUrl.pathname;

    const isLoggedIn = !!req.auth;
    const isDashboard = pathname.includes('/dashboard');
    const isLogin = pathname === '/login' || /^\/(en|tr|de)\/login$/.test(pathname);

    const host = req.headers.get('host') || req.nextUrl.host;
    const protocol = req.nextUrl.protocol;

    if (isDashboard && !isLoggedIn) {
        const loginUrl = new URL('/login', `${protocol}//${host}`);
        if (req.nextUrl.search) loginUrl.search = req.nextUrl.search;
        return NextResponse.redirect(loginUrl);
    }

    if (isLogin && isLoggedIn) {
        const callbackUrl = req.nextUrl.searchParams.get('callbackUrl');
        if (callbackUrl && callbackUrl.startsWith('/')) {
            return NextResponse.redirect(new URL(callbackUrl, `${protocol}//${host}`));
        }

        const dashboardUrl = new URL('/dashboard', `${protocol}//${host}`);
        return NextResponse.redirect(dashboardUrl);
    }

    const response = intlMiddleware(req);

    // @ts-ignore
    const cfCity = req.cf?.city || null;
    // @ts-ignore
    const cfCountry = req.cf?.country || null;

    const finalResponse = response || NextResponse.next();

    if (cfCity) finalResponse.headers.set('x-geo-city', cfCity);
    if (cfCountry) finalResponse.headers.set('x-geo-country', cfCountry);

    return finalResponse;
});

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico|airlines|\.well-known).*)'
    ]
};
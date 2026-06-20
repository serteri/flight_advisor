import NextAuth from "next-auth";
import authConfig from "@/auth.config";
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const { auth } = NextAuth(authConfig);

// Only these locales ever appear as a URL prefix. "en" (the default) never
// does — it's the bare, unprefixed path.
const PREFIXED_LOCALES = ['tr', 'de'] as const;
type PrefixedLocale = (typeof PREFIXED_LOCALES)[number];

function apiBypass(req: NextRequest) {
    const pathname = req.nextUrl.pathname;

    if (pathname.startsWith('/api/')) {
        console.log('[PROXY] API bypass - direct passthrough:', pathname);
        return NextResponse.next();
    }

    return null;
}

function notifyCompanyVisit(req: NextRequest, origin: string) {
    const company = req.nextUrl.searchParams.get('c');
    if (!company) {
        return;
    }

    const notifyUrl = new URL('/api/notify-visit', origin);

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

// Detects an explicit /tr or /de prefix. Anything else (including "/" and
// "/en...") is treated as the default locale and is never redirected.
function matchPrefixedLocale(pathname: string): PrefixedLocale | null {
    for (const locale of PREFIXED_LOCALES) {
        if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
            return locale;
        }
    }
    return null;
}

// next-auth's `auth()` wrapper resolves `req.nextUrl`'s origin from
// NEXTAUTH_URL/trustHost internals, which doesn't necessarily match the
// domain the visitor actually requested (e.g. it can collapse
// www.flightagent.io down to flightagent.io). Building redirect targets
// from that origin fights with a www<->apex domain redirect and loops
// forever. Always derive the origin from the real request headers instead.
function getRequestOrigin(req: NextRequest) {
    const host =
        req.headers.get('x-forwarded-host') ||
        req.headers.get('host') ||
        req.nextUrl.host;
    const protocol = req.headers.get('x-forwarded-proto')
        ? `${req.headers.get('x-forwarded-proto')}:`
        : req.nextUrl.protocol;
    return `${protocol}//${host}`;
}

// @ts-ignore
export default auth((req) => {
    const apiBypassResult = apiBypass(req as NextRequest);
    if (apiBypassResult !== null) {
        return apiBypassResult;
    }

    const pathname = req.nextUrl.pathname;
    const origin = getRequestOrigin(req as NextRequest);

    notifyCompanyVisit(req as NextRequest, origin);

    // Loop guard: an explicit "/en" prefix is legacy/bookmarked. Strip it
    // with a single redirect and never re-add it — this path never reaches
    // the rewrite logic below, so it can't bounce back and forth.
    if (pathname === '/en' || pathname.startsWith('/en/')) {
        const url = new URL(pathname.slice(3) || '/', origin);
        url.search = req.nextUrl.search;
        return NextResponse.redirect(url);
    }

    const explicitLocale = matchPrefixedLocale(pathname);
    const localePrefix = explicitLocale ? `/${explicitLocale}` : '';

    const isLoggedIn = !!req.auth;
    const isDashboard = pathname.includes('/dashboard');
    const isLogin = pathname === '/login' || pathname === '/tr/login' || pathname === '/de/login';

    if (isDashboard && !isLoggedIn) {
        const loginUrl = new URL(`${localePrefix}/login`, origin);
        if (req.nextUrl.search) loginUrl.search = req.nextUrl.search;
        return NextResponse.redirect(loginUrl);
    }

    if (isLogin && isLoggedIn) {
        const callbackUrl = req.nextUrl.searchParams.get('callbackUrl');
        if (callbackUrl && callbackUrl.startsWith('/')) {
            return NextResponse.redirect(new URL(callbackUrl, origin));
        }

        const dashboardUrl = new URL(`${localePrefix}/dashboard`, origin);
        return NextResponse.redirect(dashboardUrl);
    }

    // Only /tr and /de are checked for a locale prefix. Everything else
    // (including bare "/") is the default locale: rewrite internally to
    // /en/... so the [locale] route segment resolves, without ever
    // changing the visible URL or issuing a redirect.
    //
    // Built from `origin` (the real request host via headers), not
    // `req.nextUrl`: next-auth's `auth()` wrapper resolves `req.nextUrl`'s
    // origin from NEXTAUTH_URL, ignoring the actual incoming Host header
    // entirely (confirmed: req.nextUrl.href stays NEXTAUTH_URL's origin no
    // matter what Host is sent). A rewrite target on the wrong origin is
    // what fights with the www<->apex domain redirect and loops forever.
    const response = explicitLocale
        ? NextResponse.next()
        : NextResponse.rewrite(new URL(`/en${pathname}${req.nextUrl.search}`, origin));

    // @ts-ignore
    const cfCity = req.cf?.city || null;
    // @ts-ignore
    const cfCountry = req.cf?.country || null;

    if (cfCity) response.headers.set('x-geo-city', cfCity);
    if (cfCountry) response.headers.set('x-geo-country', cfCountry);

    return response;
});

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico|airlines|\.well-known).*)'
    ]
};

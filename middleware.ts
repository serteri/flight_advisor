import NextAuth from "next-auth";
import authConfig from "@/auth.config";
import createMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';

// Initialize NextAuth with ONLY the config (no adapter) for usage in Middleware (Edge)
const { auth } = NextAuth(authConfig);

const intlMiddleware = createMiddleware({
    locales: ['en', 'tr', 'de'],
    defaultLocale: 'en'
});

// @ts-ignore
export default auth((req) => {
    // 1. Auth Guard for Dashboard
    const isLoggedIn = !!req.auth;
    const isDashboard = req.nextUrl.pathname.includes('/dashboard');
    const isLogin = req.nextUrl.pathname === '/login';

    // CORS Fix: Use the actual Host header to prevent cross-origin redirects (www vs non-www)
    const host = req.headers.get('host') || req.nextUrl.host;
    const protocol = req.nextUrl.protocol; // e.g. "https:"

    // If trying to access dashboard without login, redirect to login
    if (isDashboard && !isLoggedIn) {
        const loginUrl = new URL('/login', `${protocol}//${host}`);
        if (req.nextUrl.search) loginUrl.search = req.nextUrl.search;
        return NextResponse.redirect(loginUrl);
    }

    // If logged in and trying to access login, redirect to dashboard
    if (isLogin && isLoggedIn) {
        const dashboardUrl = new URL('/dashboard', `${protocol}//${host}`);
        return NextResponse.redirect(dashboardUrl);
    }

    // 2. Cloudflare Geo & Intl Middleware
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
    // Skip all internal paths
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico|airlines).*)']
};

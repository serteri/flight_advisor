import createMiddleware from 'next-intl/middleware';
import { type NextFetchEvent, type NextRequest, NextResponse } from 'next/server';

import { routing } from '@/i18n/routing';

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest, event: NextFetchEvent) {
    // API routes: skip intl middleware and ?c= detection entirely
    if (request.nextUrl.pathname.startsWith('/api/')) {
        return NextResponse.next();
    }

    const company = request.nextUrl.searchParams.get('c');

    if (company) {
        const notifyUrl = new URL('/api/notify-visit', request.url);
        event.waitUntil(
            fetch(notifyUrl.toString(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    company,
                    path: request.nextUrl.pathname,
                    timestamp: Date.now(),
                }),
            }).catch(() => undefined), // fire-and-forget, never throws
        );
    }

    return intlMiddleware(request);
}

export const config = {
    matcher: [
        // Match all paths except static files, _next internals, and vercel internals
        '/((?!_next|_vercel|.*\\..*).*)',
    ],
};

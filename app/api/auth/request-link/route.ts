import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendLoginMagicLink } from '@/lib/email/sender';
import {
    LOGIN_LINK_TTL_MS,
    isLoginLinkGlobalCapReached,
    isLoginLinkRateLimited,
    loginLinkGlobalCap,
    outstandingLoginLinkWindow,
} from '@/lib/auth/loginLinkRateLimit';
import { isEmailDeliveryReady } from '@/lib/featureFlags';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_TTL_MS = LOGIN_LINK_TTL_MS;

export async function POST(req: Request) {
    // Waitlist mode: no login emails until the sending domain is verified.
    // No token is created, so nothing is left behind for a later bulk send.
    if (!isEmailDeliveryReady()) {
        return NextResponse.json(
            { error: 'email_delivery_not_ready', message: 'Sign-in by email link will be active very soon.' },
            { status: 503 },
        );
    }

    let body: { email?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const email = (body.email || '').trim().toLowerCase();
    if (!email || !EMAIL_REGEX.test(email)) {
        return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const outstanding = await prisma.loginToken.count({
        where: { identifier: email, expiresAt: { gt: new Date() } },
    });
    if (isLoginLinkRateLimited(outstanding)) {
        console.warn('[POST /api/auth/request-link] Rate limited (outstanding login links)');
        return NextResponse.json(
            { error: 'Too many login links requested. Please use the latest email or try again in 15 minutes.' },
            { status: 429, headers: { 'Retry-After': String(TOKEN_TTL_MS / 1000) } },
        );
    }

    // Global cap: silently skip (same success response as below, so it can't be
    // used to probe) and warn on the server.
    const cap = loginLinkGlobalCap();
    const outstandingGlobal = await prisma.loginToken.count({
        where: { expiresAt: outstandingLoginLinkWindow(new Date()) },
    });
    if (isLoginLinkGlobalCapReached(outstandingGlobal, cap)) {
        console.warn(`[POST /api/auth/request-link] Global cap reached (${outstandingGlobal} outstanding login links >= ${cap}); no token created, no email sent`);
        return NextResponse.json({ success: true });
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    await prisma.loginToken.create({
        data: { identifier: email, token, expiresAt },
    });

    const emailResult = await sendLoginMagicLink(email, token);
    if (!emailResult.success) {
        const emailError = emailResult.error || 'Unknown email delivery failure';
        console.error(`[POST /api/auth/request-link] Failed to send magic link to ${email}: ${emailError}`);
        await prisma.loginToken.update({ where: { token }, data: { emailError } });
    }

    // Always respond with success regardless of whether the email exists or
    // send succeeded, so this endpoint can't be used to enumerate accounts.
    return NextResponse.json({ success: true });
}

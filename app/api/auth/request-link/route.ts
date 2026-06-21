import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendLoginMagicLink } from '@/lib/email/sender';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_TTL_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
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

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    await prisma.loginToken.create({
        data: { identifier: email, token, expiresAt },
    });

    const emailResult = await sendLoginMagicLink(email, token);
    if (!emailResult.success) {
        console.warn(`[POST /api/auth/request-link] Failed to send magic link to ${email}: ${emailResult.error}`);
    }

    // Always respond with success regardless of whether the email exists or
    // send succeeded, so this endpoint can't be used to enumerate accounts.
    return NextResponse.json({ success: true });
}

// lib/auth/magicLinkSession.ts
//
// Lightweight, NextAuth-free session for the magic-link login flow. The
// `auth_session` cookie value is `${userId}.${hmacSignature}` so it can't be
// forged without the server secret, without pulling in a full session/JWT
// library.

import { createHmac, timingSafeEqual } from 'node:crypto';

export const AUTH_SESSION_COOKIE = 'auth_session';

const getSecret = (): string => {
    const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
    if (!secret) {
        throw new Error('NEXTAUTH_SECRET (or AUTH_SECRET) must be set to sign magic-link sessions');
    }
    return secret;
};

const sign = (userId: string): string => {
    return createHmac('sha256', getSecret()).update(userId).digest('hex');
};

export function createSessionCookieValue(userId: string): string {
    return `${userId}.${sign(userId)}`;
}

export function verifySessionCookieValue(value: string | undefined | null): string | null {
    if (!value) return null;
    const separatorIndex = value.lastIndexOf('.');
    if (separatorIndex === -1) return null;

    const userId = value.slice(0, separatorIndex);
    const signature = value.slice(separatorIndex + 1);
    const expectedSignature = sign(userId);

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (signatureBuffer.length !== expectedBuffer.length) return null;
    if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

    return userId;
}

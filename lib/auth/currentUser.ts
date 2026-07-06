// lib/auth/currentUser.ts
//
// The app has two separate, intentionally-decoupled session systems:
// NextAuth (password login, Guardian dashboard) and the lightweight
// magic-link cookie (lead-capture users). Pages that can be reached from
// either flow — like the claim process, linked from the Guardian
// dashboard's CompensationCard — need to recognize a user from whichever
// system is active.

import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { AUTH_SESSION_COOKIE, verifySessionCookieValue } from '@/lib/auth/magicLinkSession';
import { prisma } from '@/lib/prisma';

export async function getCurrentUserId(): Promise<string | null> {
    const session = await auth();
    if (session?.user?.id) {
        return session.user.id;
    }

    const cookieStore = await cookies();
    return verifySessionCookieValue(cookieStore.get(AUTH_SESSION_COOKIE)?.value);
}

export async function getCurrentUserEmail(): Promise<string | null> {
    const session = await auth();
    if (session?.user?.email) {
        return session.user.email;
    }

    const cookieStore = await cookies();
    const userId = verifySessionCookieValue(cookieStore.get(AUTH_SESSION_COOKIE)?.value);
    if (!userId) {
        return null;
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
    });

    return user?.email ?? null;
}

export function isAdmin(email: string | null | undefined): boolean {
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (!adminEmail || !email) {
        return false;
    }

    return email.trim().toLowerCase() === adminEmail;
}

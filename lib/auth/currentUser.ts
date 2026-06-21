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

export async function getCurrentUserId(): Promise<string | null> {
    const session = await auth();
    if (session?.user?.id) {
        return session.user.id;
    }

    const cookieStore = await cookies();
    return verifySessionCookieValue(cookieStore.get(AUTH_SESSION_COOKIE)?.value);
}

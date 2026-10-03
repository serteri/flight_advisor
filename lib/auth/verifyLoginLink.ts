// lib/auth/verifyLoginLink.ts
//
// Core of /api/auth/verify, with its side effects injected so it can be
// tested. Contract: these functions never throw and the route never answers
// 500.
//
//  - inspectLoginLink (used by GET) is read-only. Mail clients and security
//    scanners open links before the human does, so a GET must never use the
//    token up; it only decides whether to show the "Confirm" page.
//  - verifyLoginLink (used by POST, the human's click) consumes the token
//    atomically before anything else can fail. Concurrent requests race on
//    the delete: exactly one wins, the others get 'expired'. Trip activation
//    problems never block the login, and every failure is logged.

export type VerifyOutcome =
    | { kind: 'ok'; userId: string }
    | { kind: 'expired' }
    | { kind: 'failed' };

export interface VerifyDeps {
    findToken(token: string): Promise<{ identifier: string; expiresAt: Date } | null>;
    // Atomic one-shot consume: true only for the caller that actually removed the row.
    consumeToken(token: string): Promise<boolean>;
    upsertUser(email: string): Promise<{ id: string }>;
    confirmPendingTrips(userId: string): Promise<unknown>;
    now?: () => Date;
}

export type InspectOutcome = { kind: 'pending' } | { kind: 'expired' } | { kind: 'failed' };

export async function inspectLoginLink(
    token: string,
    deps: Pick<VerifyDeps, 'findToken' | 'now'>,
): Promise<InspectOutcome> {
    try {
        const row = await deps.findToken(token);
        if (!row || row.expiresAt < (deps.now?.() ?? new Date())) return { kind: 'expired' };
        return { kind: 'pending' };
    } catch (error) {
        console.error('[Auth:verify] login link inspection failed', error);
        return { kind: 'failed' };
    }
}

export async function verifyLoginLink(token: string, deps: VerifyDeps): Promise<VerifyOutcome> {
    let userId: string;
    try {
        const row = await deps.findToken(token);
        if (!row) return { kind: 'expired' };

        // Consumed first (also when expired): a link is never usable twice,
        // and a later failure can't leave a live token behind.
        const consumed = await deps.consumeToken(token);
        if (!consumed || row.expiresAt < (deps.now?.() ?? new Date())) return { kind: 'expired' };

        userId = (await deps.upsertUser(row.identifier)).id;
    } catch (error) {
        console.error('[Auth:verify] login link verification failed', error);
        return { kind: 'failed' };
    }

    // Opening the link proves ownership of the address: this is the opt-in.
    // Trips that fail to activate stay PENDING_CONFIRMATION (or ACTIVE with an
    // approximate plan) and are picked up on the next verification; the user is
    // still logged in.
    try {
        await deps.confirmPendingTrips(userId);
    } catch (error) {
        console.error(`[Auth:verify] trip confirmation failed for user ${userId}`, error);
    }

    return { kind: 'ok', userId };
}

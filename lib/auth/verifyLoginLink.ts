// lib/auth/verifyLoginLink.ts
//
// Core of GET /api/auth/verify, with its side effects injected so it can be
// tested. Contract: this function never throws and the route never answers
// 500. The token is consumed before anything else can fail, trip activation
// problems never block the login, and every failure is logged.

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

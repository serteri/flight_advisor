// lib/auth/loginLinkRateLimit.ts
//
// /api/auth/request-link sends an email to any address it is given, so without
// limits it can be used to flood inboxes or burn the sending quota. LoginToken
// has no createdAt/IP column (and the Phase 1 schema is frozen), so both limits
// count *unexpired* tokens:
//
//  - per address: a login link lives 15 minutes and is deleted when used, so at
//    most MAX_OUTSTANDING_LOGIN_LINKS emails per address per 15 minutes (429).
//  - global cap: at most LOGIN_LINK_GLOBAL_CAP (env, default 30) outstanding
//    login links across all addresses. Above it no token is created and no email
//    is sent, but the caller gets the normal success response, so the cap reveals
//    nothing (no enumeration); the server logs a warning.
//
// Track-form opt-in tokens are LoginTokens too but live 24h; only tokens that
// expire within LOGIN_LINK_TTL_MS are counted for the global cap, so signups
// don't use it up (an opt-in token counts only in its last 15 minutes).

export const LOGIN_LINK_TTL_MS = 15 * 60 * 1000;
export const MAX_OUTSTANDING_LOGIN_LINKS = 3;
export const DEFAULT_LOGIN_LINK_GLOBAL_CAP = 30;

export function isLoginLinkRateLimited(outstandingUnexpiredTokens: number): boolean {
    return outstandingUnexpiredTokens >= MAX_OUTSTANDING_LOGIN_LINKS;
}

export function loginLinkGlobalCap(raw: string | undefined = process.env.LOGIN_LINK_GLOBAL_CAP): number {
    const parsed = Number(raw);
    return raw && Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_LOGIN_LINK_GLOBAL_CAP;
}

export function isLoginLinkGlobalCapReached(outstandingLoginLinks: number, cap: number = loginLinkGlobalCap()): boolean {
    return outstandingLoginLinks >= cap;
}

/** Prisma `where` for login-link tokens that are still valid (see header). */
export function outstandingLoginLinkWindow(now: Date): { gt: Date; lte: Date } {
    return { gt: now, lte: new Date(now.getTime() + LOGIN_LINK_TTL_MS) };
}

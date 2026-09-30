// lib/auth/loginLinkRateLimit.ts
//
// /api/auth/request-link sends an email to any address it is given, so without
// a limit it can be used to flood someone's inbox. LoginToken has no createdAt
// (and the Phase 1 schema is frozen), so the limit counts the address's
// *unexpired* tokens: a login link lives 15 minutes and is deleted when used,
// which caps a single address at MAX_OUTSTANDING_LOGIN_LINKS emails per
// 15 minutes. Applies to every address alike, so it reveals nothing about
// whether an account exists.

export const MAX_OUTSTANDING_LOGIN_LINKS = 3;

export function isLoginLinkRateLimited(outstandingUnexpiredTokens: number): boolean {
    return outstandingUnexpiredTokens >= MAX_OUTSTANDING_LOGIN_LINKS;
}

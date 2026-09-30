// lib/auth/dashboardAccess.ts
//
// The dashboard is gated by NextAuth in proxy.ts. Lead users only have the
// magic-link session, and the double opt-in link sends them to their trip
// page. Only the trip pages may be reached with that session: they re-check
// the session and 404 unless the caller owns the trip. Every other dashboard
// page still requires NextAuth.

// /dashboard/guardian/<id> and its subpages (e.g. /amenity), with an optional
// /tr, /de or /en prefix. Not the /dashboard/guardian list itself.
const TRIP_PAGE = /^(?:\/(?:en|tr|de))?\/dashboard\/guardian\/[^/]+(?:\/[^/]+)*\/?$/;

export function isMagicLinkTripPath(pathname: string): boolean {
    return TRIP_PAGE.test(pathname);
}

export function canEnterDashboard(input: {
    pathname: string;
    hasNextAuthSession: boolean;
    hasValidMagicLinkSession: boolean;
}): boolean {
    if (input.hasNextAuthSession) return true;
    return input.hasValidMagicLinkSession && isMagicLinkTripPath(input.pathname);
}

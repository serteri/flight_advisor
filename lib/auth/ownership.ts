// lib/auth/ownership.ts
//
// Single ownership predicate for user-scoped records (trips, claims, …).
// Lead-capture trips can have `userId = null`; a null owner must never match
// a null caller, otherwise anonymous requests could read ownerless records.

export function isOwnedBy(
    resource: { userId: string | null } | null | undefined,
    userId: string | null | undefined,
): boolean {
    if (!resource || !userId || !resource.userId) return false;
    return resource.userId === userId;
}

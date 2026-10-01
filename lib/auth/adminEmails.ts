// lib/auth/adminEmails.ts
//
// ADMIN_EMAILS is a comma-separated allow-list. Empty entries are dropped so an
// unset variable can never match a session without an email.

export function isListedAdminEmail(
    email: string | null | undefined,
    rawList: string | undefined = process.env.ADMIN_EMAILS,
): boolean {
    const normalized = email?.trim().toLowerCase();
    if (!normalized) return false;
    const list = (rawList || '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
    return list.includes(normalized);
}

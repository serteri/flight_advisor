// lib/auth/adminAccess.ts
//
// The single admin rule: the signed-in email equals ADMIN_EMAIL. Pure (env is
// a parameter) so it can be tested; lib/auth/currentUser.ts delegates here.
// An unset ADMIN_EMAIL grants nobody access.

export function isAdminEmail(
    email: string | null | undefined,
    adminEmail: string | undefined = process.env.ADMIN_EMAIL,
): boolean {
    const admin = adminEmail?.trim().toLowerCase();
    if (!admin || !email) return false;
    return email.trim().toLowerCase() === admin;
}

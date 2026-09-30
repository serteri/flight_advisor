// lib/auth/cronAuth.ts
//
// Cron-style endpoints must fail closed: if CRON_SECRET is not configured the
// request is rejected, never allowed through. (trial-reminder used to skip the
// check entirely when the secret was unset.)

export type CronAuthResult = 'OK' | 'NOT_CONFIGURED' | 'UNAUTHORIZED';

export function checkCronAuth(authorizationHeader: string | null, cronSecret: string | undefined): CronAuthResult {
    if (!cronSecret) return 'NOT_CONFIGURED';
    return authorizationHeader === `Bearer ${cronSecret}` ? 'OK' : 'UNAUTHORIZED';
}

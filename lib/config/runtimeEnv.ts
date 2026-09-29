// lib/config/runtimeEnv.ts
//
// Required runtime configuration with no silent fallbacks.
// - NOTIFICATION_FROM_EMAIL: Resend's shared onboarding@resend.dev sender only
//   delivers to the account owner, so falling back to it silently drops every
//   user-facing email.
// - APP_BASE_URL: every absolute link we send (emails, Stripe redirects, PDFs)
//   must point at the real deployment, never a hardcoded or localhost domain.

export class RuntimeEnvError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'RuntimeEnvError';
    }
}

export function getNotificationFromEmail(): string {
    const from = process.env.NOTIFICATION_FROM_EMAIL?.trim();
    if (!from) {
        throw new RuntimeEnvError('NOTIFICATION_FROM_EMAIL is not set');
    }
    return from;
}

export function getAppBaseUrl(): string {
    const raw = process.env.APP_BASE_URL?.trim();
    if (!raw) {
        throw new RuntimeEnvError('APP_BASE_URL is not set');
    }
    return raw.replace(/\/+$/, '');
}

// Builds an absolute URL on the app domain from a path such as "/pricing".
export function appUrl(path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${getAppBaseUrl()}${normalizedPath}`;
}

// Names of required env vars that are missing (empty when fully configured).
export function getMissingRequiredEnv(): string[] {
    const missing: string[] = [];
    if (!process.env.RESEND_API_KEY) missing.push('RESEND_API_KEY');
    if (!process.env.NOTIFICATION_FROM_EMAIL?.trim()) missing.push('NOTIFICATION_FROM_EMAIL');
    if (!process.env.APP_BASE_URL?.trim()) missing.push('APP_BASE_URL');
    if (!process.env.NEXTAUTH_SECRET && !process.env.AUTH_SECRET) missing.push('NEXTAUTH_SECRET (or AUTH_SECRET)');

    // Monitoring runs on QStash + AeroDataBox only in Vercel production;
    // development and preview use mocks and unpublished schedules.
    if (process.env.VERCEL_ENV === 'production') {
        for (const name of [
            'QSTASH_TOKEN',
            'QSTASH_CURRENT_SIGNING_KEY',
            'QSTASH_NEXT_SIGNING_KEY',
            'RAPID_API_KEY',
            'RAPID_API_HOST_AERODATABOX',
        ]) {
            if (!process.env[name]) missing.push(name);
        }
    }
    return missing;
}

export function assertRequiredRuntimeEnv(context: string): void {
    const missing = getMissingRequiredEnv();
    if (missing.length > 0) {
        throw new RuntimeEnvError(`[Startup Fail-Fast:${context}] Missing required runtime env vars: ${missing.join(', ')}`);
    }
}

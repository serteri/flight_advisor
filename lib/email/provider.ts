// lib/email/provider.ts
//
// Which email provider is selected (EMAIL_PROVIDER) and which env names it
// needs. Dependency-free so both the sender and the startup fail-fast use it.

export const EMAIL_PROVIDERS = ['resend', 'mailjet'] as const;
export type EmailProvider = (typeof EMAIL_PROVIDERS)[number];

export class UnknownEmailProviderError extends Error {
    constructor(value: string) {
        super(`EMAIL_PROVIDER "${value}" is invalid (expected: ${EMAIL_PROVIDERS.join(' | ')})`);
        this.name = 'UnknownEmailProviderError';
    }
}

// Unset/empty falls back to resend (the pre-Mailjet behaviour). A set but
// unrecognised value throws rather than silently picking a provider.
export function getEmailProvider(env: NodeJS.ProcessEnv = process.env): EmailProvider {
    const raw = env.EMAIL_PROVIDER?.trim();
    if (!raw) return 'resend';
    if ((EMAIL_PROVIDERS as readonly string[]).includes(raw)) return raw as EmailProvider;
    throw new UnknownEmailProviderError(raw);
}

// Env names the selected provider needs (used by the startup fail-fast).
export function requiredEnvForProvider(provider: EmailProvider): string[] {
    return provider === 'mailjet' ? ['MAILJET_API_KEY', 'MAILJET_SECRET_KEY'] : ['RESEND_API_KEY'];
}

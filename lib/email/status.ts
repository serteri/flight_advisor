// lib/email/status.ts
//
// What an email send can end as, and a read-only readiness report of the
// current environment. Names of environment variables only - never values.
//
//   DELIVERY_DISABLED   the policy blocks real sending here (not Vercel
//                       production, or EMAIL_DELIVERY_READY is not "true")
//   CONFIGURATION_ERROR sending is allowed but required configuration is
//                       missing or invalid
//   PROVIDER_ERROR      the provider rejected the message or the call failed
//   DELIVERED           the provider accepted the message

import { isRealEmailDeliveryAllowed } from '@/lib/email/deliveryPolicy';
import { EMAIL_PROVIDERS, requiredEnvForProvider, type EmailProvider } from '@/lib/email/provider';

export type EmailOutcome = 'DELIVERY_DISABLED' | 'CONFIGURATION_ERROR' | 'PROVIDER_ERROR' | 'DELIVERED';

export const isProductionDeployment = (env: NodeJS.ProcessEnv = process.env): boolean =>
    env.VERCEL_ENV === 'production';

export interface EmailReadiness {
    productionDeployment: boolean;
    deliveryEnabled: boolean;
    provider: EmailProvider | 'INVALID';
    providerConfigured: boolean;
    fromConfigured: boolean;
    appUrlValid: boolean;
    /** Env variable NAMES (or short descriptions) that block real sending. */
    configIssues: string[];
    state: 'DELIVERY_DISABLED' | 'CONFIGURATION_ERROR' | 'READY';
}

// Absolute http(s) URL; in production it must be https and not a local host,
// because every emailed link is built from it.
export function isValidAppUrl(raw: string | undefined, production: boolean): boolean {
    const value = raw?.trim();
    if (!value) return false;
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        return false;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    if (!production) return true;
    if (url.protocol !== 'https:') return false;
    return !/^(localhost|127\.0\.0\.1|\[::1\])$/i.test(url.hostname) && !url.hostname.endsWith('.localhost');
}

// Configuration problems for actually sending, independent of whether
// sending is currently switched on.
export function getEmailConfigIssues(env: NodeJS.ProcessEnv = process.env): string[] {
    const issues: string[] = [];
    const raw = env.EMAIL_PROVIDER?.trim();
    if (raw && !(EMAIL_PROVIDERS as readonly string[]).includes(raw)) {
        issues.push(`EMAIL_PROVIDER (invalid value; expected ${EMAIL_PROVIDERS.join(' | ')})`);
    } else {
        const provider = (raw || 'resend') as EmailProvider;
        for (const name of requiredEnvForProvider(provider)) {
            if (!env[name]?.trim()) issues.push(name);
        }
    }
    if (!env.NOTIFICATION_FROM_EMAIL?.trim()) issues.push('NOTIFICATION_FROM_EMAIL');
    if (!isValidAppUrl(env.APP_BASE_URL, isProductionDeployment(env))) {
        issues.push(env.APP_BASE_URL?.trim() ? 'APP_BASE_URL (not a valid public https URL)' : 'APP_BASE_URL');
    }
    return issues;
}

export function getEmailReadiness(env: NodeJS.ProcessEnv = process.env): EmailReadiness {
    const raw = env.EMAIL_PROVIDER?.trim();
    const provider: EmailProvider | 'INVALID' =
        !raw ? 'resend' : (EMAIL_PROVIDERS as readonly string[]).includes(raw) ? (raw as EmailProvider) : 'INVALID';
    const configIssues = getEmailConfigIssues(env);
    const deliveryEnabled = isRealEmailDeliveryAllowed(env);
    return {
        productionDeployment: isProductionDeployment(env),
        deliveryEnabled,
        provider,
        providerConfigured:
            provider !== 'INVALID' && requiredEnvForProvider(provider).every((name) => Boolean(env[name]?.trim())),
        fromConfigured: Boolean(env.NOTIFICATION_FROM_EMAIL?.trim()),
        appUrlValid: isValidAppUrl(env.APP_BASE_URL, isProductionDeployment(env)),
        configIssues,
        state: !deliveryEnabled ? 'DELIVERY_DISABLED' : configIssues.length > 0 ? 'CONFIGURATION_ERROR' : 'READY',
    };
}

// scripts/send-test-alert.ts
//
// Sends ONE real email through the configured provider (EMAIL_PROVIDER:
// resend | mailjet) using the production
// DisruptionAlertEmail template, then prints the provider's response (id or error).
// Use it to verify domain verification + NOTIFICATION_FROM_EMAIL end to end.
//
// Usage:
//   npx tsx scripts/send-test-alert.ts <to-email> [flightNumber] [ruleType]
//   ruleType: COMPENSATION_CANCELLED | COMPENSATION_DELAYED | REFUND_AND_EXPENSES
//
// Reads EMAIL_PROVIDER, the selected provider's key(s) (RESEND_API_KEY or
// MAILJET_API_KEY + MAILJET_SECRET_KEY), NOTIFICATION_FROM_EMAIL and APP_BASE_URL from
// .env.local / .env (in that order). Unlike the app, this always sends for
// real regardless of NODE_ENV.

import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

const RULE_TYPES = ['COMPENSATION_CANCELLED', 'COMPENSATION_DELAYED', 'REFUND_AND_EXPENSES'] as const;
type RuleType = (typeof RULE_TYPES)[number];

async function main() {
    const [to, flightNumberArg, ruleTypeArg] = process.argv.slice(2);

    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
        console.error('Usage: npx tsx scripts/send-test-alert.ts <to-email> [flightNumber] [ruleType]');
        process.exit(1);
    }

    const ruleType = (ruleTypeArg || 'COMPENSATION_DELAYED') as RuleType;
    if (!RULE_TYPES.includes(ruleType)) {
        console.error(`Invalid ruleType "${ruleTypeArg}". Expected one of: ${RULE_TYPES.join(', ')}`);
        process.exit(1);
    }
    const flightNumber = (flightNumberArg || 'TEST123').toUpperCase();

    // Imported after dotenv so runtime env getters see the loaded values.
    const { getMissingRequiredEnv, appUrl, getNotificationFromEmail } = await import('@/lib/config/runtimeEnv');
    const { renderDisruptionAlert, deliverEmail } = await import('@/lib/email/sender');
    const { getEmailProvider } = await import('@/lib/email/provider');

    let provider: string;
    try {
        provider = getEmailProvider();
    } catch (error: any) {
        console.error(error.message);
        process.exit(1);
    }

    // The script always sends for real, so the sender settings are required
    // here even when EMAIL_DELIVERY_READY is off (getMissingRequiredEnv skips them).
    const { requiredEnvForProvider } = await import('@/lib/email/provider');
    const missingProvider = [...requiredEnvForProvider(provider as 'resend' | 'mailjet'), 'NOTIFICATION_FROM_EMAIL'].filter(
        (name) => !process.env[name]?.trim(),
    );
    const missing = [...missingProvider, ...getMissingRequiredEnv()].filter((name) => !name.startsWith('NEXTAUTH_SECRET'));
    if (missing.length > 0) {
        console.error(`Missing env vars: ${missing.join(', ')}`);
        process.exit(1);
    }

    const claimLink = appUrl('/claim-process/test-trip');
    const { subject, html } = await renderDisruptionAlert(flightNumber, claimLink, ruleType);

    console.log(`Provider: ${provider}`);
    console.log(`From:    ${getNotificationFromEmail()}`);
    console.log(`To:      ${to}`);
    console.log(`Subject: [TEST] ${subject}`);

    const result = await deliverEmail('send-test-alert', { to, subject: `[TEST] ${subject}`, html }, { bypassDeliveryPolicy: true });

    if (result.success) {
        console.log(`${provider} accepted the message. id=${result.messageId}`);
        return;
    }

    console.error(`${provider} send failed: ${result.error}`);
    process.exit(2);
}

main().catch((error) => {
    console.error('Unexpected failure:', error);
    process.exit(3);
});

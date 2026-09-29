// lib/email/sender.ts
//
// Transactional email via Resend. Outside production nothing is sent: the
// magic/claim link is logged and a mocked success is returned, so local and
// preview environments never spend quota or email real users.
//
// In production every failure (missing config, Resend error, exception) is
// logged with console.error and returned as { success: false, error } so the
// caller can persist it — nothing is swallowed here.

import { Resend } from 'resend';
import { render } from '@react-email/components';
import { WelcomeTripEmail } from '@/components/emails/WelcomeTripEmail';
import { DisruptionAlertEmail } from '@/components/emails/DisruptionAlertEmail';
import { appUrl, getNotificationFromEmail } from '@/lib/config/runtimeEnv';
import { withLegalFooter } from '@/lib/email/legalFooter';

export interface SendEmailResult {
    success: boolean;
    mocked: boolean;
    messageId?: string;
    error?: string;
    previewUrl?: string;
}

type ClaimRuleType = 'COMPENSATION_CANCELLED' | 'COMPENSATION_DELAYED' | 'REFUND_AND_EXPENSES';

const isProduction = (): boolean => process.env.NODE_ENV === 'production';

const buildLoginLink = (token: string, redirectTo?: string): string => {
    const base = appUrl(`/api/auth/verify?token=${token}`);
    if (!redirectTo) {
        return base;
    }
    return `${base}&redirect=${encodeURIComponent(redirectTo)}`;
};

const buildClaimLink = (tripId: string): string => appUrl(`/claim-process/${tripId}`);

// Sends through Resend and normalises every failure mode into a result.
// `label` only identifies the email kind in logs.
export async function deliverViaResend(
    label: string,
    message: { to: string; subject: string; html: string; text?: string },
): Promise<SendEmailResult> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        const error = 'RESEND_API_KEY is not set';
        console.error(`[Email:${label}] ${error} — recipient ${message.to}`);
        return { success: false, mocked: false, error };
    }

    try {
        const resend = new Resend(apiKey);
        const { html, text } = withLegalFooter({ html: message.html, text: message.text });
        const response = await resend.emails.send({
            from: getNotificationFromEmail(),
            to: message.to,
            subject: message.subject,
            html,
            text,
        });

        if (response.error) {
            console.error(`[Email:${label}] Resend rejected message to ${message.to}: ${response.error.message}`);
            return { success: false, mocked: false, error: response.error.message };
        }

        return { success: true, mocked: false, messageId: response.data?.id };
    } catch (err: any) {
        const error = err?.message || 'Unknown email send error';
        console.error(`[Email:${label}] Exception sending to ${message.to}: ${error}`);
        return { success: false, mocked: false, error };
    }
}

export async function sendWelcomeEmail(
    email: string,
    token: string,
    flightNumber: string,
    redirectTo?: string,
): Promise<SendEmailResult> {
    const magicLink = buildLoginLink(token, redirectTo);

    if (!isProduction()) {
        console.log(
            `[Email] DEV MODE — would send welcome email to ${email} for flight ${flightNumber}. Magic link: ${magicLink}`,
        );
        return { success: true, mocked: true, previewUrl: magicLink };
    }

    const html = await render(WelcomeTripEmail({ flightNumber, magicLink }));
    const result = await deliverViaResend('welcome', {
        to: email,
        subject: `Your flight ${flightNumber} is now protected`,
        html,
    });
    return { ...result, previewUrl: magicLink };
}

export async function sendLoginMagicLink(email: string, token: string): Promise<SendEmailResult> {
    const loginLink = buildLoginLink(token);

    if (!isProduction()) {
        console.log(`[Email] DEV MODE — would send login magic link to ${email}. Link: ${loginLink}`);
        return { success: true, mocked: true };
    }

    return deliverViaResend('magic-link', {
        to: email,
        subject: 'Your FlightAgent login link',
        html: `<p>Click the link below to log in. This link expires in 15 minutes.</p><p><a href="${loginLink}">${loginLink}</a></p>`,
    });
}

export async function renderDisruptionAlert(
    flightNumber: string,
    claimLink: string,
    claimRuleType?: ClaimRuleType,
): Promise<{ subject: string; html: string }> {
    const html = await render(DisruptionAlertEmail({ flightNumber, claimLink, claimRuleType }));

    const subjectMap: Record<ClaimRuleType, string> = {
        COMPENSATION_CANCELLED: `Your flight ${flightNumber} was cancelled — check your rights`,
        COMPENSATION_DELAYED:   `Major delay on flight ${flightNumber} — check your rights`,
        REFUND_AND_EXPENSES:    `Flight ${flightNumber} disrupted — refund options available`,
    };
    const subject = claimRuleType ? subjectMap[claimRuleType] : `Urgent: Flight ${flightNumber} disruption detected`;

    return { subject, html };
}

export async function sendDisruptionAlert(
    email: string,
    tripId: string,
    flightNumber: string,
    claimRuleType?: ClaimRuleType,
): Promise<SendEmailResult> {
    const claimLink = buildClaimLink(tripId);

    if (!isProduction()) {
        console.log(
            `[Email] DEV MODE — would send disruption alert to ${email} for flight ${flightNumber} (rule: ${claimRuleType ?? 'default'}). Claim link: ${claimLink}`,
        );
        return { success: true, mocked: true, previewUrl: claimLink };
    }

    const { subject, html } = await renderDisruptionAlert(flightNumber, claimLink, claimRuleType);
    const result = await deliverViaResend('disruption-alert', { to: email, subject, html });
    return { ...result, previewUrl: claimLink };
}

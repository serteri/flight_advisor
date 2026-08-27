// lib/email/sender.ts
//
// Resend domain verification isn't finished yet, so this must never fire a
// real send outside production. Dev/test always log the magic link and
// return a mock success instead of touching the Resend API.

import { Resend } from 'resend';
import { render } from '@react-email/components';
import { WelcomeTripEmail } from '@/components/emails/WelcomeTripEmail';
import { DisruptionAlertEmail } from '@/components/emails/DisruptionAlertEmail';

export interface SendEmailResult {
    success: boolean;
    mocked: boolean;
    messageId?: string;
    error?: string;
    previewUrl?: string;
}

const usesLiveApi = (): boolean => {
    return process.env.NODE_ENV === 'production' && Boolean(process.env.RESEND_API_KEY);
};

const getBaseUrl = (): string => {
    if (process.env.NODE_ENV === 'production') {
        return process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    }

    return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
};

const buildLoginLink = (token: string, redirectTo?: string): string => {
    const base = `${getBaseUrl()}/api/auth/verify?token=${token}`;
    if (!redirectTo) {
        return base;
    }
    return `${base}&redirect=${encodeURIComponent(redirectTo)}`;
};

const buildClaimLink = (tripId: string): string => {
    return `${getBaseUrl()}/claim-process/${tripId}`;
};

export async function sendWelcomeEmail(
    email: string,
    token: string,
    flightNumber: string,
    redirectTo?: string,
): Promise<SendEmailResult> {
    const magicLink = buildLoginLink(token, redirectTo);

    if (!usesLiveApi()) {
        console.log(
            `[Email] DEV MODE — would send welcome email to ${email} for flight ${flightNumber}. Magic link: ${magicLink}`,
        );
        return { success: true, mocked: true, previewUrl: magicLink };
    }

    try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const html = await render(WelcomeTripEmail({ flightNumber, magicLink }));

        const response = await resend.emails.send({
            from: process.env.NOTIFICATION_FROM_EMAIL || 'onboarding@resend.dev',
            to: email,
            subject: `Your flight ${flightNumber} is now protected`,
            html,
        });

        if (response.error) {
            console.error('[Email] Resend error:', response.error.message);
            return { success: false, mocked: false, error: response.error.message };
        }

        return { success: true, mocked: false, messageId: response.data?.id, previewUrl: magicLink };
    } catch (err: any) {
        console.error('[Email] Exception while sending welcome email:', err.message);
        return { success: false, mocked: false, error: err.message || 'Unknown email send error' };
    }
}

export async function sendLoginMagicLink(email: string, token: string): Promise<SendEmailResult> {
    const loginLink = buildLoginLink(token);

    if (!usesLiveApi()) {
        console.log(`[Email] DEV MODE — would send login magic link to ${email}. Link: ${loginLink}`);
        return { success: true, mocked: true };
    }

    try {
        const resend = new Resend(process.env.RESEND_API_KEY);

        const response = await resend.emails.send({
            from: process.env.NOTIFICATION_FROM_EMAIL || 'onboarding@resend.dev',
            to: email,
            subject: 'Your FlightAgent login link',
            html: `<p>Click the link below to log in. This link expires in 15 minutes.</p><p><a href="${loginLink}">${loginLink}</a></p>`,
        });

        if (response.error) {
            console.error('[Email] Resend error:', response.error.message);
            return { success: false, mocked: false, error: response.error.message };
        }

        return { success: true, mocked: false, messageId: response.data?.id };
    } catch (err: any) {
        console.error('[Email] Exception while sending login magic link:', err.message);
        return { success: false, mocked: false, error: err.message || 'Unknown email send error' };
    }
}

type ClaimRuleType = 'COMPENSATION_CANCELLED' | 'COMPENSATION_DELAYED' | 'REFUND_AND_EXPENSES';

export async function sendDisruptionAlert(
    email: string,
    tripId: string,
    flightNumber: string,
    claimRuleType?: ClaimRuleType,
): Promise<SendEmailResult> {
    const claimLink = buildClaimLink(tripId);

    if (process.env.NODE_ENV !== 'production') {
        console.log(
            `[Email] DEV MODE — would send disruption alert to ${email} for flight ${flightNumber} (rule: ${claimRuleType ?? 'default'}). Claim link: ${claimLink}`,
        );
        return { success: true, mocked: true, previewUrl: claimLink };
    }

    if (!usesLiveApi()) {
        console.log(
            `[Email] Production delivery disabled — missing RESEND_API_KEY for disruption alert. Recipient: ${email}, tripId: ${tripId}`,
        );
        return { success: false, mocked: true, error: 'RESEND_API_KEY missing in production' };
    }

    try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const html = await render(DisruptionAlertEmail({ flightNumber, claimLink, claimRuleType }));

        const subjectMap: Record<ClaimRuleType, string> = {
            COMPENSATION_CANCELLED: `Your flight ${flightNumber} was cancelled — check your rights`,
            COMPENSATION_DELAYED:   `Major delay on flight ${flightNumber} — check your rights`,
            REFUND_AND_EXPENSES:    `Flight ${flightNumber} disrupted — refund options available`,
        };
        const subject = claimRuleType ? subjectMap[claimRuleType] : `Urgent: Flight ${flightNumber} disruption detected`;

        const response = await resend.emails.send({
            from: process.env.NOTIFICATION_FROM_EMAIL || 'onboarding@resend.dev',
            to: email,
            subject,
            html,
        });

        if (response.error) {
            console.error('[Email] Resend error (disruption alert):', response.error.message);
            return { success: false, mocked: false, error: response.error.message };
        }

        return { success: true, mocked: false, messageId: response.data?.id, previewUrl: claimLink };
    } catch (err: any) {
        console.error('[Email] Exception while sending disruption alert:', err.message);
        return { success: false, mocked: false, error: err.message || 'Unknown disruption email send error' };
    }
}


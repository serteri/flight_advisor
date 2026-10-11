// lib/email/sender.ts
//
// Transactional email templates. Actual delivery (provider selection, delivery
// policy, failure handling) lives in lib/email/deliver.ts. Outside production
// nothing is sent: the magic/claim link is logged and a mocked success is
// returned, so local and preview environments never email real users.

import { render } from '@react-email/components';
import { WelcomeTripEmail } from '@/components/emails/WelcomeTripEmail';
import { DisruptionAlertEmail } from '@/components/emails/DisruptionAlertEmail';
import { appUrl } from '@/lib/config/runtimeEnv';
import { deliverEmail, type SendEmailResult } from '@/lib/email/deliver';

export { deliverEmail };
export type { SendEmailResult };

type ClaimRuleType = 'COMPENSATION_CANCELLED' | 'COMPENSATION_DELAYED' | 'REFUND_AND_EXPENSES';

import { isRealEmailDeliveryAllowed } from '@/lib/email/deliveryPolicy';
import { isProductionDeployment } from '@/lib/email/status';

// True when the send must go through deliverEmail: real delivery is allowed,
// or this is the Vercel production deployment, where a disabled/misconfigured
// sender has to fail loudly instead of being mocked (lib/email/deliver.ts).
const isProduction = (): boolean => isRealEmailDeliveryAllowed() || isProductionDeployment();

// Mocked login links carry a live token. Print them for local work only, never
// into Vercel (preview) logs.
export const loggableLink = (link: string, env: NodeJS.ProcessEnv = process.env): string =>
    env.VERCEL_ENV ? '[link hidden on Vercel]' : link;

const buildLoginLink = (token: string, redirectTo?: string): string => {
    const base = appUrl(`/api/auth/verify?token=${token}`);
    if (!redirectTo) {
        return base;
    }
    return `${base}&redirect=${encodeURIComponent(redirectTo)}`;
};

const buildClaimLink = (tripId: string): string => appUrl(`/claim-process/${tripId}`);

export async function sendWelcomeEmail(
    email: string,
    token: string,
    flightNumber: string,
    redirectTo?: string,
): Promise<SendEmailResult> {
    const magicLink = buildLoginLink(token, redirectTo);

    if (!isProduction()) {
        console.log(
            `[Email] DEV MODE — would send welcome email to ${email} for flight ${flightNumber}. Magic link: ${loggableLink(magicLink)}`,
        );
        return { success: true, mocked: true, previewUrl: magicLink };
    }

    const html = await render(WelcomeTripEmail({ flightNumber, magicLink }));
    const result = await deliverEmail('welcome', {
        to: email,
        subject: `Confirm alerts for flight ${flightNumber}`,
        html,
    });
    return { ...result, previewUrl: magicLink };
}

export async function sendLoginMagicLink(email: string, token: string): Promise<SendEmailResult> {
    const loginLink = buildLoginLink(token);

    if (!isProduction()) {
        console.log(`[Email] DEV MODE — would send login magic link to ${email}. Link: ${loggableLink(loginLink)}`);
        return { success: true, mocked: true };
    }

    return deliverEmail('magic-link', {
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

// Month-name date ("7 Oct 2026"); never a numeric format (Faz 2 rule).
const formatFlightDate = (date: Date): string =>
    new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

// Sent once, when the provider reports that the tracked flight does not exist
// (lib/guardian/flightNotFound.ts). Monitoring has stopped for this trip.
export async function sendFlightNotFoundEmail(
    email: string,
    flightNumber: string,
    flightDate: Date,
    tripId: string,
): Promise<SendEmailResult> {
    const dateText = formatFlightDate(flightDate);
    const subject = `We couldn't find flight ${flightNumber} on ${dateText}`;

    if (!isProduction()) {
        console.log(`[Email] DEV MODE — would send flight-not-found email to ${email} for ${flightNumber} on ${dateText} (trip ${tripId})`);
        return { success: true, mocked: true };
    }
    const homeLink = appUrl('/');

    const f = escapeHtml(flightNumber);
    const d = escapeHtml(dateText);
    const html = [
        `<p>We couldn't find flight <strong>${f}</strong> on <strong>${d}</strong> in our flight data, so we are not monitoring it and won't send alerts for it.</p>`,
        '<p>Please check the flight number and date on your booking confirmation. If something was mistyped, you can add the flight again:</p>',
        `<p><a href="${homeLink}">${homeLink}</a></p>`,
    ].join('');
    const text = [
        `We couldn't find flight ${flightNumber} on ${dateText} in our flight data, so we are not monitoring it and won't send alerts for it.`,
        'Please check the flight number and date on your booking confirmation. If something was mistyped, you can add the flight again:',
        homeLink,
    ].join('\n\n');

    return deliverEmail('flight-not-found', { to: email, subject, html, text });
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
    const result = await deliverEmail('disruption-alert', { to: email, subject, html });
    return { ...result, previewUrl: claimLink };
}

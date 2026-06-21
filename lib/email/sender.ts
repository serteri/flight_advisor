// lib/email/sender.ts
//
// Resend domain verification isn't finished yet, so this must never fire a
// real send outside production. Dev/test always log the magic link and
// return a mock success instead of touching the Resend API.

import { Resend } from 'resend';
import { render } from '@react-email/components';
import { WelcomeTripEmail } from '@/components/emails/WelcomeTripEmail';

export interface SendEmailResult {
    success: boolean;
    mocked: boolean;
    messageId?: string;
    error?: string;
}

const usesLiveApi = (): boolean => {
    return process.env.NODE_ENV === 'production' && Boolean(process.env.RESEND_API_KEY);
};

const buildMagicLink = (tripId: string): string => {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    return `${baseUrl}/trip/${tripId}`;
};

export async function sendWelcomeEmail(
    email: string,
    tripId: string,
    flightNumber: string,
): Promise<SendEmailResult> {
    const magicLink = buildMagicLink(tripId);

    if (!usesLiveApi()) {
        console.log(
            `[Email] DEV MODE — would send welcome email to ${email} for flight ${flightNumber}. Magic link: ${magicLink}`,
        );
        return { success: true, mocked: true };
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

        return { success: true, mocked: false, messageId: response.data?.id };
    } catch (err: any) {
        console.error('[Email] Exception while sending welcome email:', err.message);
        return { success: false, mocked: false, error: err.message || 'Unknown email send error' };
    }
}

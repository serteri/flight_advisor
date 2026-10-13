// lib/email/deliver.ts
//
// The single outbound-email entry point. Provider is chosen by EMAIL_PROVIDER
// (resend | mailjet; unset = resend). The delivery policy (Vercel production +
// EMAIL_DELIVERY_READY, or EMAIL_FORCE_LIVE) and the legal footer are applied
// here, once, for every provider — adapters only talk to their API.
//
// Every failure (missing config, provider rejection, exception) is logged with
// console.error and returned as { success: false, error } so the caller can
// persist it on the record — nothing is swallowed.

import { Resend } from 'resend';
import { getNotificationFromEmail } from '@/lib/config/runtimeEnv';
import { isRealEmailDeliveryAllowed } from '@/lib/email/deliveryPolicy';
import { withLegalFooter } from '@/lib/email/legalFooter';
import { getEmailProvider } from '@/lib/email/provider';
import { getEmailConfigIssues, isProductionDeployment, type EmailOutcome } from '@/lib/email/status';

export { EMAIL_PROVIDERS, getEmailProvider, requiredEnvForProvider, UnknownEmailProviderError } from '@/lib/email/provider';
export type { EmailProvider } from '@/lib/email/provider';

export interface SendEmailResult {
    success: boolean;
    mocked: boolean;
    /** How the send ended; see lib/email/status.ts. */
    outcome?: EmailOutcome;
    messageId?: string;
    error?: string;
    previewUrl?: string;
}

export interface EmailAttachment {
    filename: string;
    contentType: string;
    base64: string;
}

export interface EmailMessage {
    to: string;
    subject: string;
    html?: string;
    text?: string;
    attachments?: EmailAttachment[];
}

// "Name <a@b.c>" or "a@b.c" -> Mailjet's { Email, Name? }.
export function parseFromAddress(from: string): { Email: string; Name?: string } {
    const m = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
    if (m) {
        const name = m[1].trim();
        return name ? { Email: m[2].trim(), Name: name } : { Email: m[2].trim() };
    }
    return { Email: from.trim() };
}

type AdapterBody = { to: string; subject: string; html?: string; text?: string; attachments?: EmailAttachment[]; from: string };

async function sendViaResend(label: string, m: AdapterBody): Promise<SendEmailResult> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        const error = 'RESEND_API_KEY is not set';
        console.error(`[Email:${label}] ${error} — recipient ${m.to}`);
        return { success: false, mocked: false, error };
    }
    const resend = new Resend(apiKey);
    const response = await resend.emails.send({
        from: m.from,
        to: m.to,
        subject: m.subject,
        html: m.html,
        text: m.text,
        ...(m.attachments?.length
            ? { attachments: m.attachments.map((a) => ({ filename: a.filename, content: a.base64 })) }
            : {}),
    } as Parameters<typeof resend.emails.send>[0]);

    if (response.error) {
        console.error(`[Email:${label}] Resend rejected message to ${m.to}: ${response.error.message}`);
        return { success: false, mocked: false, error: response.error.message };
    }
    return { success: true, mocked: false, messageId: response.data?.id };
}

const MAILJET_SEND_URL = 'https://api.mailjet.com/v3.1/send';
const MAILJET_TIMEOUT_MS = 15_000;

// Mailjet Send API v3.1: Basic auth (key:secret), one message per call.
// Rejections come back as HTTP 4xx/5xx and/or Messages[].Status === 'error'.
async function sendViaMailjet(label: string, m: AdapterBody): Promise<SendEmailResult> {
    const apiKey = process.env.MAILJET_API_KEY;
    const secret = process.env.MAILJET_SECRET_KEY;
    const missing = [!apiKey && 'MAILJET_API_KEY', !secret && 'MAILJET_SECRET_KEY'].filter(Boolean);
    if (missing.length > 0) {
        const error = `${missing.join(', ')} is not set`;
        console.error(`[Email:${label}] ${error} — recipient ${m.to}`);
        return { success: false, mocked: false, error };
    }

    const res = await fetch(MAILJET_SEND_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${Buffer.from(`${apiKey}:${secret}`).toString('base64')}`,
        },
        body: JSON.stringify({
            Messages: [
                {
                    From: parseFromAddress(m.from),
                    To: [{ Email: m.to }],
                    Subject: m.subject,
                    ...(m.text ? { TextPart: m.text } : {}),
                    ...(m.html ? { HTMLPart: m.html } : {}),
                    ...(m.attachments?.length
                        ? {
                              Attachments: m.attachments.map((a) => ({
                                  ContentType: a.contentType,
                                  Filename: a.filename,
                                  Base64Content: a.base64,
                              })),
                          }
                        : {}),
                },
            ],
        }),
        signal: AbortSignal.timeout(MAILJET_TIMEOUT_MS),
    });

    const raw = await res.text();
    let data: any = null;
    try {
        data = raw ? JSON.parse(raw) : null;
    } catch {
        /* non-JSON body: reported below via status + raw snippet */
    }

    const msg = data?.Messages?.[0];
    if (res.ok && msg?.Status === 'success') {
        const sent = msg.To?.[0];
        const id = sent?.MessageID ?? sent?.MessageUUID;
        return { success: true, mocked: false, messageId: id !== undefined ? String(id) : undefined };
    }

    const detail =
        msg?.Errors?.map((e: any) => [e.ErrorCode, e.ErrorMessage].filter(Boolean).join(': ')).filter(Boolean).join('; ') ||
        data?.ErrorMessage ||
        (raw ? raw.slice(0, 200) : '') ||
        'no response body';
    const error = `Mailjet HTTP ${res.status}: ${detail}`;
    console.error(`[Email:${label}] Mailjet rejected message to ${m.to}: ${error}`);
    return { success: false, mocked: false, error };
}

// `label` only identifies the email kind in logs.
//
// Outcomes (every one is logged with its name):
//  - DELIVERY_DISABLED: outside Vercel production this is a quiet mock (success,
//    so local and preview flows keep working). In Vercel PRODUCTION it is a
//    failure logged with console.error: nothing was sent and the caller must
//    not record the email as delivered.
//  - CONFIGURATION_ERROR: sending allowed but required env is missing/invalid.
//  - PROVIDER_ERROR: the provider rejected the message or the call threw.
//  - DELIVERED: the provider accepted the message.
export async function deliverEmail(
    label: string,
    message: EmailMessage,
    // Only scripts/send-test-alert.ts sets this: an explicit, manual real send.
    options: { bypassDeliveryPolicy?: boolean } = {},
): Promise<SendEmailResult> {
    if (!options.bypassDeliveryPolicy && !isRealEmailDeliveryAllowed()) {
        if (isProductionDeployment()) {
            const error = 'Email delivery is disabled in production (EMAIL_DELIVERY_READY is not "true"); nothing was sent';
            console.error(`[Email:${label}] DELIVERY_DISABLED: "${message.subject}" to ${message.to} NOT sent - ${error}`);
            return { success: false, mocked: false, outcome: 'DELIVERY_DISABLED', error };
        }
        console.log(`[Email:${label}] DELIVERY_DISABLED (not Vercel production): "${message.subject}" to ${message.to} not sent`);
        return { success: true, mocked: true, outcome: 'DELIVERY_DISABLED' };
    }

    const issues = getEmailConfigIssues();
    if (issues.length > 0) {
        const error = `Email configuration error: ${issues.join(', ')}`;
        console.error(`[Email:${label}] CONFIGURATION_ERROR: ${error} - recipient ${message.to} NOT emailed`);
        return { success: false, mocked: false, outcome: 'CONFIGURATION_ERROR', error };
    }

    try {
        const provider = getEmailProvider();
        const { html, text } = withLegalFooter({ html: message.html, text: message.text });
        const body: AdapterBody = {
            to: message.to,
            subject: message.subject,
            html,
            text,
            attachments: message.attachments,
            from: getNotificationFromEmail(),
        };
        const result = provider === 'mailjet' ? await sendViaMailjet(label, body) : await sendViaResend(label, body);
        const outcome: EmailOutcome = result.success ? 'DELIVERED' : 'PROVIDER_ERROR';
        if (result.success) console.log(`[Email:${label}] DELIVERED via ${provider}${result.messageId ? ` (message ${result.messageId})` : ''}`);
        else console.error(`[Email:${label}] PROVIDER_ERROR via ${provider}: ${result.error}`);
        return { ...result, outcome };
    } catch (err: any) {
        const error = err?.message || 'Unknown email send error';
        console.error(`[Email:${label}] PROVIDER_ERROR: exception sending to ${message.to}: ${error}`);
        return { success: false, mocked: false, outcome: 'PROVIDER_ERROR', error };
    }
}

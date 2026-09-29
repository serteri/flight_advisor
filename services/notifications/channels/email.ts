// services/notifications/channels/email.ts
import { NotificationPayload } from '../types';
import { ResendProvider } from '../providers/resend';
import { appUrl } from '@/lib/config/runtimeEnv';

export class EmailChannel {
    private static instance: EmailChannel;
    private provider: ResendProvider | null;

    private constructor() {
        const apiKey = process.env.RESEND_API_KEY;
        this.provider = apiKey ? new ResendProvider(apiKey) : null;
    }

    public static getInstance(): EmailChannel {
        if (!EmailChannel.instance) {
            EmailChannel.instance = new EmailChannel();
        }
        return EmailChannel.instance;
    }

    public async send(to: string, payload: NotificationPayload): Promise<{ success: boolean; id?: string; error?: string }> {
        if (!this.provider) {
            console.error(`[EmailChannel] RESEND_API_KEY is not set — email to ${to} not sent`);
            return { success: false, error: 'RESEND_API_KEY is not set' };
        }

        let html: string;
        try {
            html = this.generateHtml(payload);
        } catch (error: any) {
            const message = error?.message || 'Failed to build email HTML';
            console.error(`[EmailChannel] ${message} — email to ${to} not sent`);
            return { success: false, error: message };
        }

        const result = await this.provider.sendEmail({
            to,
            subject: payload.title,
            html,
            text: payload.message,
        });

        return {
            success: result.success,
            id: result.providerMessageId,
            error: result.error,
        };
    }

    // HTML Template Generator (Simplified)
    public generateHtml(payload: NotificationPayload): string {
        const ctaUrl = payload.data?.ctaUrl
            ? String(payload.data.ctaUrl)
            : payload.tripId
                ? appUrl(`/dashboard/guardian/${payload.tripId}`)
                : appUrl('/dashboard');
        const ctaLabel = payload.data?.ctaLabel
            ? String(payload.data.ctaLabel)
            : payload.tripId
                ? 'View Trip Details'
                : 'Open Dashboard';

        return `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                <h2 style="color: #333;">${payload.title}</h2>
                <p style="font-size: 16px; color: #555;">${payload.message}</p>
                <br/>
                <a href="${ctaUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">${ctaLabel}</a>
            </div>
        `;
    }
}

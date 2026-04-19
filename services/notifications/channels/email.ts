// services/notifications/channels/email.ts
import { NotificationPayload } from '../types';
import { ResendProvider } from '../providers/resend';

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

    public async send(to: string, payload: NotificationPayload): Promise<{ success: boolean; id?: string }> {
        if (!this.provider) {
            return { success: false };
        }

        const result = await this.provider.sendEmail({
            to,
            subject: payload.title,
            html: this.generateHtml(payload),
            text: payload.message,
        });

        return {
            success: result.success,
            id: result.providerMessageId,
        };
    }

    // HTML Template Generator (Simplified)
    public generateHtml(payload: NotificationPayload): string {
        const ctaUrl = payload.data?.ctaUrl
            ? String(payload.data.ctaUrl)
            : payload.tripId
                ? `https://flight-guardian.com/trips/${payload.tripId}`
                : 'https://flight-guardian.com/dashboard';
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

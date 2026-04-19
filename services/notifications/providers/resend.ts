import { Resend } from 'resend';

import type { ChannelResponse, EmailRequest } from '../types';

export class ResendProvider {
    private readonly client: Resend;
    private readonly fromEmail: string;

    constructor(apiKey: string, fromEmail?: string) {
        this.client = new Resend(apiKey);
        this.fromEmail = fromEmail || process.env.NOTIFICATION_FROM_EMAIL || 'onboarding@resend.dev';
    }

    async sendEmail(request: EmailRequest): Promise<ChannelResponse> {
        try {
            const response = await this.client.emails.send({
                from: this.fromEmail,
                to: request.to,
                subject: request.subject,
                html: request.html || `<p>${request.text}</p>`,
                text: request.text,
            });

            if (response.error) {
                return {
                    success: false,
                    channel: 'EMAIL',
                    error: response.error.message,
                };
            }

            return {
                success: true,
                channel: 'EMAIL',
                providerMessageId: response.data?.id,
            };
        } catch (error: any) {
            return {
                success: false,
                channel: 'EMAIL',
                error: error?.message || 'Unknown resend error',
            };
        }
    }
}

import { Resend } from 'resend';

import type { ChannelResponse, EmailRequest } from '../types';
import { getNotificationFromEmail } from '@/lib/config/runtimeEnv';

export class ResendProvider {
    private readonly client: Resend;
    private readonly fromEmail: string | undefined;

    constructor(apiKey: string, fromEmail?: string) {
        this.client = new Resend(apiKey);
        this.fromEmail = fromEmail;
    }

    async sendEmail(request: EmailRequest): Promise<ChannelResponse> {
        try {
            // Resolved per send (not in the constructor) so a missing
            // NOTIFICATION_FROM_EMAIL surfaces as a recorded delivery failure
            // instead of crashing module initialisation.
            const response = await this.client.emails.send({
                from: this.fromEmail ?? getNotificationFromEmail(),
                to: request.to,
                subject: request.subject,
                html: request.html || `<p>${request.text}</p>`,
                text: request.text,
            });

            if (response.error) {
                console.error(`[ResendProvider] Resend rejected message to ${request.to}: ${response.error.message}`);
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
            console.error(`[ResendProvider] Exception sending to ${request.to}: ${error?.message || error}`);
            return {
                success: false,
                channel: 'EMAIL',
                error: error?.message || 'Unknown resend error',
            };
        }
    }
}

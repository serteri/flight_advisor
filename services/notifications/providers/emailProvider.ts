import type { ChannelResponse, EmailRequest } from '../types';
import { deliverEmail } from '@/lib/email/deliver';

// Provider-agnostic: deliverEmail picks Resend or Mailjet (EMAIL_PROVIDER) and
// applies the delivery policy and legal footer, so none of that lives here.
export class EmailDeliveryProvider {
    async sendEmail(request: EmailRequest): Promise<ChannelResponse> {
        const result = await deliverEmail('notification', {
            to: request.to,
            subject: request.subject,
            html: request.html || `<p>${request.text}</p>`,
            text: request.text,
        });

        if (!result.success) {
            return { success: false, channel: 'EMAIL', error: result.error };
        }
        return {
            success: true,
            channel: 'EMAIL',
            providerMessageId: result.mocked ? 'mock-non-production' : result.messageId,
        };
    }
}

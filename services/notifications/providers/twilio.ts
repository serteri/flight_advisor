import twilio, { Twilio } from 'twilio';

import type { ChannelResponse, SmsRequest } from '../types';

export class TwilioProvider {
    private readonly client: Twilio;
    private readonly fromNumber: string;

    constructor(accountSid: string, authToken: string, fromNumber: string) {
        this.client = twilio(accountSid, authToken);
        this.fromNumber = fromNumber;
    }

    async sendSMS(request: SmsRequest): Promise<ChannelResponse> {
        try {
            const result = await this.client.messages.create({
                to: request.to,
                from: this.fromNumber,
                body: request.text,
            });

            return {
                success: true,
                channel: 'SMS',
                providerMessageId: result.sid,
            };
        } catch (error: any) {
            return {
                success: false,
                channel: 'SMS',
                error: error?.message || 'Unknown twilio error',
            };
        }
    }
}

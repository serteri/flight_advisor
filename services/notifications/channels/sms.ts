// services/notifications/channels/sms.ts
import { NotificationPayload } from '../types';
import { TwilioProvider } from '../providers/twilio';

export class SmsChannel {
    private static instance: SmsChannel;
    private provider: TwilioProvider | null;

    private constructor() {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_PHONE_NUMBER;
        this.provider = accountSid && authToken && fromNumber
            ? new TwilioProvider(accountSid, authToken, fromNumber)
            : null;
    }

    public static getInstance(): SmsChannel {
        if (!SmsChannel.instance) {
            SmsChannel.instance = new SmsChannel();
        }
        return SmsChannel.instance;
    }

    public async send(to: string, payload: NotificationPayload): Promise<{ success: boolean; id?: string }> {
        if (!this.provider) {
            return { success: false };
        }

        const result = await this.provider.sendSMS({
            to,
            text: payload.message.substring(0, 160),
        });

        return {
            success: result.success,
            id: result.providerMessageId,
        };
    }
}

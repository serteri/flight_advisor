import type {
    ChannelResponse,
    EmailRequest,
    NotificationProvider,
    PushRequest,
    SmsRequest,
} from '../types';
import { PushProvider } from './push';
import { ResendProvider } from './resend';
import { TwilioProvider } from './twilio';

export class NotificationProviderManager implements NotificationProvider {
    private static instance: NotificationProviderManager;

    private readonly resendProvider: ResendProvider | null;
    private readonly twilioProvider: TwilioProvider | null;
    private readonly pushProvider: PushProvider;

    private constructor() {
        const resendApiKey = process.env.RESEND_API_KEY;
        this.resendProvider = resendApiKey ? new ResendProvider(resendApiKey) : null;

        const twilioSid = process.env.TWILIO_ACCOUNT_SID;
        const twilioToken = process.env.TWILIO_AUTH_TOKEN;
        const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
        this.twilioProvider = twilioSid && twilioToken && twilioPhone
            ? new TwilioProvider(twilioSid, twilioToken, twilioPhone)
            : null;

        this.pushProvider = new PushProvider();
    }

    static getInstance(): NotificationProviderManager {
        if (!NotificationProviderManager.instance) {
            NotificationProviderManager.instance = new NotificationProviderManager();
        }
        return NotificationProviderManager.instance;
    }

    async sendEmail(request: EmailRequest): Promise<ChannelResponse> {
        if (!this.resendProvider) {
            return {
                success: false,
                channel: 'EMAIL',
                error: 'RESEND_API_KEY is missing',
            };
        }
        return this.resendProvider.sendEmail(request);
    }

    async sendSMS(request: SmsRequest): Promise<ChannelResponse> {
        if (!this.twilioProvider) {
            return {
                success: false,
                channel: 'SMS',
                error: 'Twilio credentials are missing',
            };
        }
        return this.twilioProvider.sendSMS(request);
    }

    async sendPush(request: PushRequest): Promise<ChannelResponse> {
        return this.pushProvider.sendPush(request);
    }
}

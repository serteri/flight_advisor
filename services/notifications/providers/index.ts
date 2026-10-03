import type {
    ChannelResponse,
    EmailRequest,
    NotificationProvider,
    PushRequest,
    SmsRequest,
} from '../types';
import { PushProvider } from './push';
import { EmailDeliveryProvider } from './emailProvider';
import { TwilioProvider } from './twilio';

export class NotificationProviderManager implements NotificationProvider {
    private static instance: NotificationProviderManager;

    private readonly emailProvider = new EmailDeliveryProvider();
    private readonly twilioProvider: TwilioProvider | null;
    private readonly pushProvider: PushProvider;

    private constructor() {
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
        return this.emailProvider.sendEmail(request);
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

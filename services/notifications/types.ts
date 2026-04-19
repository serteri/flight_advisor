// services/notifications/types.ts

export type NotificationPriority = 'OPPORTUNITY' | 'WARNING' | 'CRITICAL';
export type NotificationChannel = 'EMAIL' | 'SMS' | 'PUSH' | 'TELEGRAM';
export type UserTier = 'FREE' | 'PRO' | 'ELITE';
export type ToneOfVoice = 'STANDARD' | 'JUNIOR_GUARDIAN';

export interface NotificationPayload {
    userId: string;
    tripId?: string;
    type: 'DISRUPTION' | 'UPGRADE' | 'GATE_CHANGE' | 'PRICE_DROP' | 'CHECK_IN' | 'SCHEDULE_CHANGE';
    title: string;
    message: string;
    priority: NotificationPriority;
    data?: Record<string, any>; // Extra data (pnr, flightNumber, etc.)
}

export interface ChannelResponse {
    success: boolean;
    providerMessageId?: string;
    error?: string;
    channel: NotificationChannel;
}

export interface EmailRequest {
    to: string;
    subject: string;
    html?: string;
    text: string;
}

export interface SmsRequest {
    to: string;
    text: string;
}

export interface PushRequest {
    userId: string;
    title: string;
    body: string;
    data?: Record<string, any>;
}

export interface NotificationProvider {
    sendEmail(request: EmailRequest): Promise<ChannelResponse>;
    sendSMS(request: SmsRequest): Promise<ChannelResponse>;
    sendPush(request: PushRequest): Promise<ChannelResponse>;
}

export interface UserPreferences {
    tier: UserTier;
    tone: ToneOfVoice;
    channels: {
        email: boolean;
        sms: boolean;
        push: boolean;
        telegram: boolean;
    };
    contact: {
        email: string;
        phone?: string; // E.164 format (+90555...)
        telegramId?: string;
    };
}

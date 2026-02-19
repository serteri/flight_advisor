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

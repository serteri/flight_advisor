// services/notifications/channels/sms.ts
import { NotificationPayload } from '../types';

export class SmsChannel {
    private static instance: SmsChannel;
    
    // Replace with real Twilio API Key in prod
    private mockTwilio = true;

    private constructor() {}

    public static getInstance(): SmsChannel {
        if (!SmsChannel.instance) {
            SmsChannel.instance = new SmsChannel();
        }
        return SmsChannel.instance;
    }

    public async send(to: string, payload: NotificationPayload): Promise<{ success: boolean; id?: string }> {
        console.log(`📱 [SMS SERVICE] Sending to: ${to}`);
        console.log(`   Text: ${payload.message}`);
        
        // Mocking Twilio API Call
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log(`✅ [SMS SENT] Delivered via Twilio (Priority: HIGH).`);
                resolve({ success: true, id: `SM${Date.now()}` });
            }, 500);
        });
    }

    // SMS Template Generator (Ultra Short)
    public generateShortText(payload: NotificationPayload): string {
        let prefix = "✈️ FLIGHT GUARDIAN:";
        if (payload.priority === 'CRITICAL') prefix = "🚨 ALERT:";
        
        // Twilio costs per segment, keep it short
        const shortUrl = `flt.ai/${payload.tripId?.substring(0,6)}`;
        return `${prefix} ${payload.message.substring(0, 100)}... Action: ${shortUrl}`;
    }
}

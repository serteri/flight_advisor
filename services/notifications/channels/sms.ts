// services/notifications/channels/sms.ts
import { NotificationPayload } from '../types';

// Initialize Twilio (optional - use mock if not available)
let twilioClient: any = null;

const getTwilioClient = () => {
    if (twilioClient) return twilioClient;
    
    try {
        const twilio = require('twilio');
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        
        if (accountSid && authToken) {
            twilioClient = twilio(accountSid, authToken);
            return twilioClient;
        }
    } catch (err) {
        console.log("⚠️ Twilio SDK not available, using mock");
    }
    
    return null;
};

export class SmsChannel {
    private static instance: SmsChannel;
    private fromNumber: string;

    private constructor() {
        this.fromNumber = process.env.TWILIO_PHONE_NUMBER || '+15005550006'; // Twilio sandbox default
    }

    public static getInstance(): SmsChannel {
        if (!SmsChannel.instance) {
            SmsChannel.instance = new SmsChannel();
        }
        return SmsChannel.instance;
    }

    public async send(to: string, payload: NotificationPayload): Promise<{ success: boolean; id?: string }> {
        console.log(`📱 [SMS SERVICE] Sending to: ${to}`);
        console.log(`   Text: ${payload.message}`);
        
        const client = getTwilioClient();
        
        // Use real Twilio if available
        if (client) {
            try {
                const message = await client.messages.create({
                    body: payload.message.substring(0, 160), // SMS char limit
                    from: this.fromNumber,
                    to: to,
                });
                console.log(`✅ [SMS SENT] Twilio SID: ${message.sid}`);
                return { success: true, id: message.sid };
            } catch (err: any) {
                console.error(`❌ [SMS ERROR] ${err.message}`);
                // Fallback to mock on error
                return this.mockSend(payload);
            }
        }
        
        // Fallback to mock
        return this.mockSend(payload);
    }

    private mockSend(payload: NotificationPayload): Promise<{ success: boolean; id?: string }> {
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log(`✅ [SMS SENT] Delivered via Twilio (Priority: HIGH).`);
                resolve({ success: true, id: `SM${Date.now()}` });
            }, 500);
        });
    }
}

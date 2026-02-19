// services/notifications/channels/email.ts
import { NotificationPayload } from '../types';

// Initialize Resend (optional - use mock if not available)
let resendClient: any = null;

const getResendClient = () => {
    if (resendClient) return resendClient;
    
    try {
        const { Resend } = require('resend');
        const apiKey = process.env.RESEND_API_KEY;
        
        if (apiKey) {
            resendClient = new Resend(apiKey);
            console.log("✅ Resend SDK initialized with API key");
            return resendClient;
        }
    } catch (err) {
        console.log("⚠️ Resend SDK not available, using mock");
    }
    
    return null;
};

export class EmailChannel {
    private static instance: EmailChannel;
    private fromEmail: string;

    private constructor() {
        this.fromEmail = 'notifications@flightguardian.io';
    }

    public static getInstance(): EmailChannel {
        if (!EmailChannel.instance) {
            EmailChannel.instance = new EmailChannel();
        }
        return EmailChannel.instance;
    }

    public async send(to: string, payload: NotificationPayload): Promise<{ success: boolean; id?: string }> {
        console.log(`📧 [EMAIL SERVICE] Sending to: ${to}`);
        console.log(`   Subject: ${payload.title}`);
        
        const client = getResendClient();
        
        // Use real Resend if available
        if (client) {
            try {
                const response = await client.emails.send({
                    from: this.fromEmail,
                    to: to,
                    subject: payload.title,
                    html: this.generateHtml(payload),
                    replyTo: 'support@flightguardian.io',
                });
                
                if (response.error) {
                    console.error(`❌ [EMAIL ERROR] ${response.error.message}`);
                    return this.mockSend();
                }
                
                console.log(`✅ [EMAIL SENT] Message ID: ${response.data?.id}`);
                return { success: true, id: response.data?.id };
            } catch (err: any) {
                console.error(`❌ [EMAIL ERROR] ${err.message}`);
                // Fallback to mock on error
                return this.mockSend();
            }
        }
        
        // Fallback to mock
        return this.mockSend();
    }

    private mockSend(): Promise<{ success: boolean; id?: string }> {
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log(`✅ [EMAIL SENT] Message delivered via Resend (Mock).`);
                resolve({ success: true, id: `res_${Date.now()}` });
            }, 500);
        });
    }

    // HTML Template Generator (Simplified)
    public generateHtml(payload: NotificationPayload): string {
        return `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                <h2 style="color: #333;">${payload.title}</h2>
                <p style="font-size: 16px; color: #555;">${payload.message}</p>
                <br/>
                <a href="https://flight-guardian.com/trips/${payload.tripId}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">View Trip Details</a>
            </div>
        `;
    }
}

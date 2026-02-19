// services/notifications/channels/email.ts
import { NotificationPayload } from '../types';

export class EmailChannel {
    private static instance: EmailChannel;
    
    // Replace with real Resend API Key in prod
    private mockResend = true;

    private constructor() {}

    public static getInstance(): EmailChannel {
        if (!EmailChannel.instance) {
            EmailChannel.instance = new EmailChannel();
        }
        return EmailChannel.instance;
    }

    public async send(to: string, payload: NotificationPayload): Promise<{ success: boolean; id?: string }> {
        console.log(`📧 [EMAIL SERVICE] Sending to: ${to}`);
        console.log(`   Subject: ${payload.title}`);
        
        // Mocking Resend API Call
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log(`✅ [EMAIL SENT] Message delivered via Resend.`);
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

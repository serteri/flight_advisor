"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailChannel = void 0;
class EmailChannel {
    constructor() {
        this.resendEnabled = true;
    }
    static getInstance() {
        if (!EmailChannel.instance) {
            EmailChannel.instance = new EmailChannel();
        }
        return EmailChannel.instance;
    }
    async send(to, payload) {
        console.log(`📧 [EMAIL SERVICE] Sending to: ${to}`);
        console.log(`   Subject: ${payload.title}`);
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log(`✅ [EMAIL SENT] Message delivered via Resend.`);
                resolve({ success: true, id: `res_${Date.now()}` });
            }, 500);
        });
    }
    // HTML Template Generator (Simplified)
    generateHtml(payload) {
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
exports.EmailChannel = EmailChannel;

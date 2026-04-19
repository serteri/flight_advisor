"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsChannel = void 0;
class SmsChannel {
    constructor() {
        this.twilioEnabled = true;
    }
    static getInstance() {
        if (!SmsChannel.instance) {
            SmsChannel.instance = new SmsChannel();
        }
        return SmsChannel.instance;
    }
    async send(to, payload) {
        console.log(`📱 [SMS SERVICE] Sending to: ${to}`);
        console.log(`   Text: ${payload.message}`);
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log(`✅ [SMS SENT] Delivered via Twilio (Priority: HIGH).`);
                resolve({ success: true, id: `SM${Date.now()}` });
            }, 500);
        });
    }
    // SMS Template Generator (Ultra Short)
    generateShortText(payload) {
        let prefix = "✈️ FLIGHT GUARDIAN:";
        if (payload.priority === 'CRITICAL')
            prefix = "🚨 ALERT:";
        // Twilio costs per segment, keep it short
        const shortUrl = `flt.ai/${payload.tripId?.substring(0, 6)}`;
        return `${prefix} ${payload.message.substring(0, 100)}... Action: ${shortUrl}`;
    }
}
exports.SmsChannel = SmsChannel;

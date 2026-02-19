"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationDispatcher = void 0;
const email_1 = require("./channels/email");
const sms_1 = require("./channels/sms");
const templates_1 = require("./templates");
class NotificationDispatcher {
    constructor() {
        this.emailService = email_1.EmailChannel.getInstance();
        this.smsService = sms_1.SmsChannel.getInstance();
    }
    static getInstance() {
        if (!NotificationDispatcher.instance) {
            NotificationDispatcher.instance = new NotificationDispatcher();
        }
        return NotificationDispatcher.instance;
    }
    /**
     * MAIN BRAIN: Determines which channels to use based on Priority & User Tier
     */
    async dispatch(user, payload) {
        console.log(`\n🧠 [DISPATCHER] Processing Alert: ${payload.type} (${payload.priority}) for Tier: ${user.tier}`);
        // 1. SELECT CHANNELS (Logic Matrix)
        const channels = this.selectChannels(user.tier, payload.priority);
        console.log(`   Selected Channels: [${channels.join(', ')}]`);
        // 2. GENERATE CONTENT (Standard vs Junior Guardian)
        const content = (0, templates_1.getTemplate)(payload.type, user.tone, {
            flight: payload.data?.flightNumber || 'UNKNOWN',
            destination: payload.data?.destination || 'Destination',
            amount: payload.data?.amount || 'N/A',
            gate: payload.data?.gate || 'N/A',
            terminal: payload.data?.terminal || 'N/A'
        });
        // Use template content if payload message is generic
        const finalPayload = {
            ...payload,
            title: content.title || payload.title,
            message: content.message || payload.message
        };
        // 3. SEND (Parallel Execution)
        const tasks = [];
        if (channels.includes('EMAIL') && user.contact.email) {
            tasks.push(this.emailService.send(user.contact.email, finalPayload));
        }
        if (channels.includes('SMS') && user.contact.phone) {
            // Only send SMS if configured and critical (or Elite tier)
            tasks.push(this.smsService.send(user.contact.phone, finalPayload));
        }
        if (channels.includes('PUSH')) {
            // Push Notification Service (TODO: Implement OneSignal/FCM)
            console.log(`📲 [PUSH] Sending to device: ${finalPayload.title}`);
        }
        await Promise.all(tasks);
        console.log(`✅ [DISPATCHER] All notifications sent.`);
    }
    /**
     * LOGIC MATRIX: Channel Selection Strategy
     */
    selectChannels(tier, priority) {
        const channels = ['EMAIL']; // Email is always base
        // 1. CRITICAL ALERTS (Flight Cancelled, Gate Change)
        if (priority === 'CRITICAL') {
            if (tier === 'ELITE') {
                channels.push('SMS', 'PUSH'); // Wake up!
            }
            else if (tier === 'PRO') {
                channels.push('PUSH'); // Urgent notification
            }
            else {
                // FREE users get only Email (slow) - Upsell opportunity!
                // "Upgrade to get instant SMS alerts for cancellations"
            }
            return channels;
        }
        // 2. WARNING ALERTS (Check-in, Delay < 30min)
        if (priority === 'WARNING') {
            if (tier === 'ELITE' || tier === 'PRO') {
                channels.push('PUSH');
            }
            return channels;
        }
        // 3. OPPORTUNITY (Price Drop, Upgrade)
        // Only email to avoid spamming, unless user opted in for push deals
        return channels;
    }
}
exports.NotificationDispatcher = NotificationDispatcher;

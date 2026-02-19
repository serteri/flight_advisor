// services/notifications/types.js (Transpiled manually for quick test)
// Bu dosya JS oldugu icin TypeScript type'larini kaldiriyorum.

// services/notifications/channels/email.js
class EmailChannel {
    static instance;
    constructor() {}
    static getInstance() {
        if (!EmailChannel.instance) EmailChannel.instance = new EmailChannel();
        return EmailChannel.instance;
    }
    async send(to, payload) {
        console.log(`📧 [EMAIL SERVICE] Sending to: ${to}`);
        console.log(`   Subject: ${payload.title}`);
        return new Promise(resolve => setTimeout(() => {
            console.log(`✅ [EMAIL SENT] Message delivered via Resend.`);
            resolve({ success: true });
        }, 200));
    }
}

// services/notifications/channels/sms.js
class SmsChannel {
    static instance;
    constructor() {}
    static getInstance() {
        if (!SmsChannel.instance) SmsChannel.instance = new SmsChannel();
        return SmsChannel.instance;
    }
    async send(to, payload) {
        console.log(`📱 [SMS SERVICE] Sending to: ${to}`);
        console.log(`   Text: ${payload.message.substring(0, 50)}...`);
        return new Promise(resolve => setTimeout(() => {
            console.log(`✅ [SMS SENT] Delivered via Twilio (Priority: HIGH).`);
            resolve({ success: true });
        }, 200));
    }
}

// services/notifications/templates.js
const Templates = {
    DISRUPTION: {
        STANDARD: (data) => ({
            title: `🚨 Flight ${data.flight} Cancelled`,
            message: `Your flight has been disrupted. Compensation: ${data.amount}. Claim now.`
        }),
        JUNIOR_GUARDIAN: (data) => ({
            title: `✈️ Ops! Uçak Biraz Geç Kalacak 🐢`,
            message: `Merak etme! Uçağımız dinleniyor. ${data.amount} tazminat hakkın var. Terminal 2'deki Lego Alanı'na gidebilirsin! 🎡`
        })
    },
    GATE_CHANGE: {
        STANDARD: (data) => ({
            title: `🚪 Gate Changed to ${data.gate}`,
            message: `Flight ${data.flight} is now boarding at Gate ${data.gate}.`
        }),
        JUNIOR_GUARDIAN: (data) => ({
            title: `🏃‍♂️ Yarış Başlıyor! Yeni Kapı: ${data.gate}`,
            message: `Hadi bakalım! Uçağımız saklambaç oynuyor ve ${data.gate} kapısına saklandı. Oraya ilk kim varacak? 🏁`
        })
    }
};

function getTemplate(type, tone, data) {
    const category = Templates[type];
    if (!category) return { title: 'Alert', message: 'Update available.' };
    const fn = category[tone] || category['STANDARD'];
    return fn(data);
}

// services/notifications/dispatcher.js
class NotificationDispatcher {
    static instance;
    emailService = EmailChannel.getInstance();
    smsService = SmsChannel.getInstance();

    constructor() {}
    static getInstance() {
        if (!NotificationDispatcher.instance) NotificationDispatcher.instance = new NotificationDispatcher();
        return NotificationDispatcher.instance;
    }

    async dispatch(user, payload) {
        console.log(`\n🧠 [DISPATCHER] Alert: ${payload.type} (${payload.priority}) | User: ${user.tier} | Tone: ${user.tone}`);
        
        // 1. SELECT CHANNELS
        const channels = ['EMAIL'];
        if (payload.priority === 'CRITICAL') {
            if (user.tier === 'ELITE') channels.push('SMS', 'PUSH');
            else if (user.tier === 'PRO') channels.push('PUSH');
        } else if (payload.priority === 'WARNING') {
            if (user.tier !== 'FREE') channels.push('PUSH');
        }
        console.log(`   Selected Channels: [${channels.join(', ')}]`);

        // 2. GENERATE CONTENT
        const content = getTemplate(payload.type, user.tone, payload.data || {});
        const finalPayload = { ...payload, ...content };

        // 3. SEND
        const tasks = [];
        if (channels.includes('EMAIL')) tasks.push(this.emailService.send(user.contact.email, finalPayload));
        if (channels.includes('SMS') && user.contact.phone) tasks.push(this.smsService.send(user.contact.phone, finalPayload));
        
        await Promise.all(tasks);
        console.log(`✅ [DISPATCHER] Complete.`);
    }
}

// TEST RUNNER
const freeUser = { tier: 'FREE', tone: 'STANDARD', contact: { email: 'free@user.com' } };
const eliteUser = { tier: 'ELITE', tone: 'STANDARD', contact: { email: 'vip@ceo.com', phone: '+905559999999' } };
const juniorFamily = { tier: 'PRO', tone: 'JUNIOR_GUARDIAN', contact: { email: 'mom@family.com', phone: '+905551234567' } };

async function run() {
    const dispatcher = NotificationDispatcher.getInstance();

    console.log("--- TEST 1: FREE USER (Critical) ---");
    await dispatcher.dispatch(freeUser, { type: 'DISRUPTION', priority: 'CRITICAL', data: { flight: 'TK123', amount: '600€' } });

    console.log("\n--- TEST 2: ELITE USER (Critical) ---");
    await dispatcher.dispatch(eliteUser, { type: 'DISRUPTION', priority: 'CRITICAL', data: { flight: 'QR555', amount: '600€' } });

    console.log("\n--- TEST 3: JUNIOR FAMILY (Gate Change) ---");
    await dispatcher.dispatch(juniorFamily, { type: 'GATE_CHANGE', priority: 'WARNING', data: { flight: 'LH999', gate: 'B12' } });
}

run();

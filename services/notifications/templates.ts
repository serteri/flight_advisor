// services/notifications/templates.ts
import { NotificationPayload, ToneOfVoice } from './types';

// ============================================
// TEMPLATE ENGINE
// ============================================

interface TemplateData {
    flight: string; // TK123
    destination: string; // Istanbul
    time?: string;
    amount?: string; // 600€
    gate?: string; // B12
    terminal?: string; // T2
}

/**
 * JUNIOR GUARDIAN: Çocuklu aileler için oyun alanı ve sakinleştirici ton.
 * STANDARD: Yetişkinler için kısa, net ve aksiyon odaklı.
 */

export const Templates = {
    DISRUPTION: {
        STANDARD: (data: TemplateData) => ({
            title: `🚨 Flight ${data.flight} Cancelled/Delayed`,
            message: `Your flight to ${data.destination} has a major disruption. You are eligible for ${data.amount} compensation. File claim now.`
        }),
        JUNIOR_GUARDIAN: (data: TemplateData) => ({
            title: `✈️ Ops! Uçak Biraz Geç Kalacak 🐢`,
            message: `Merak etme! Uçağımız biraz dinleniyor. ${data.amount} tazminat hakkın var. Bu sırada Terminal ${data.terminal || '2'}'deki Lego Alanı'na gidebilirsin! 🎡`
        })
    },

    UPGRADE: {
        STANDARD: (data: TemplateData) => ({
            title: `💎 Business Class Upgrade Available`,
            message: `Price drop alert! Upgrade your seat to Business Class for only ${data.amount}. Offer expires in 2 hours.`
        }),
        JUNIOR_GUARDIAN: (data: TemplateData) => ({
            title: `👑 Prenses/Prens Gibi Uçmak İster misin?`,
            message: `Sihirli koltuklar (Business Class) indirime girdi! Sadece ${data.amount} farkla yataklı koltuğa geçebilirsin. Çocuğun mışıl mışıl uyur! 🛌`
        })
    },

    GATE_CHANGE: {
        STANDARD: (data: TemplateData) => ({
            title: `🚪 Gate Changed to ${data.gate}`,
            message: `Attention! Flight ${data.flight} is now boarding at Gate ${data.gate}. Proceed immediately.`
        }),
        JUNIOR_GUARDIAN: (data: TemplateData) => ({
            title: `🏃‍♂️ Yarış Başlıyor! Yeni Kapı: ${data.gate}`,
            message: `Hadi bakalım! Uçağımız saklambaç oynuyor ve ${data.gate} kapısına saklandı. Oraya ilk kim varacak? (Koşmadan hızlı yürüyelim!) 🏁`
        })
    }
};

export function getTemplate(type: string, tone: ToneOfVoice, data: TemplateData): { title: string, message: string } {
    const category = Templates[type as keyof typeof Templates];
    if (!category) return { title: 'Notification', message: 'You have a new update.' };

    const templateFn = category[tone] || category['STANDARD'];
    return templateFn(data);
}

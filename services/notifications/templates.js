"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Templates = void 0;
exports.getTemplate = getTemplate;
/**
 * JUNIOR GUARDIAN: Çocuklu aileler için oyun alanı ve sakinleştirici ton.
 * STANDARD: Yetişkinler için kısa, net ve aksiyon odaklı.
 */
exports.Templates = {
    DISRUPTION: {
        STANDARD: (data) => ({
            title: `🚨 Flight ${data.flight} Cancelled/Delayed`,
            message: `Your flight to ${data.destination} has a major disruption. You are eligible for ${data.amount} compensation. File claim now.`
        }),
        JUNIOR_GUARDIAN: (data) => ({
            title: `✈️ Ops! Uçak Biraz Geç Kalacak 🐢`,
            message: `Merak etme! Uçağımız biraz dinleniyor. ${data.amount} tazminat hakkın var. Bu sırada Terminal ${data.terminal || '2'}'deki Lego Alanı'na gidebilirsin! 🎡`
        })
    },
    UPGRADE: {
        STANDARD: (data) => ({
            title: `💎 Business Class Upgrade Available`,
            message: `Price drop alert! Upgrade your seat to Business Class for only ${data.amount}. Offer expires in 2 hours.`
        }),
        JUNIOR_GUARDIAN: (data) => ({
            title: `👑 Prenses/Prens Gibi Uçmak İster misin?`,
            message: `Sihirli koltuklar (Business Class) indirime girdi! Sadece ${data.amount} farkla yataklı koltuğa geçebilirsin. Çocuğun mışıl mışıl uyur! 🛌`
        })
    },
    GATE_CHANGE: {
        STANDARD: (data) => ({
            title: `🚪 Gate Changed to ${data.gate}`,
            message: `Attention! Flight ${data.flight} is now boarding at Gate ${data.gate}. Proceed immediately.`
        }),
        JUNIOR_GUARDIAN: (data) => ({
            title: `🏃‍♂️ Yarış Başlıyor! Yeni Kapı: ${data.gate}`,
            message: `Hadi bakalım! Uçağımız saklambaç oynuyor ve ${data.gate} kapısına saklandı. Oraya ilk kim varacak? (Koşmadan hızlı yürüyelim!) 🏁`
        })
    }
};
function getTemplate(type, tone, data) {
    const category = exports.Templates[type];
    if (!category)
        return { title: 'Notification', message: 'You have a new update.' };
    const templateFn = category[tone] || category['STANDARD'];
    return templateFn(data);
}

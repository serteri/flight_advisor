export type AirlineTier = 'TIER_1' | 'TIER_2' | 'LCC';

export interface AirlineInfo {
    name: string;
    tier: AirlineTier;
    hasFreeBag: boolean;      // Uzun uçuşlarda standart ekonomide bagaj var mı?
    hasMeals: boolean;        // Yemek ücretsiz mi?
    hasEntertainment: boolean; // Koltuk arkası ekran var mı?
}

export const AIRLINE_DB: Record<string, AirlineInfo> = {
    // ----------------------------------------------------------------
    // ⭐ TIER 1: DÜNYA DEVLERİ (5 Yıldız Potansiyeli, Tam Hizmet)
    // ----------------------------------------------------------------
    'QR': { name: 'Qatar Airways', tier: 'TIER_1', hasFreeBag: true, hasMeals: true, hasEntertainment: true },
    'SQ': { name: 'Singapore Airlines', tier: 'TIER_1', hasFreeBag: true, hasMeals: true, hasEntertainment: true },
    'EK': { name: 'Emirates', tier: 'TIER_1', hasFreeBag: true, hasMeals: true, hasEntertainment: true },
    'TK': { name: 'Turkish Airlines', tier: 'TIER_1', hasFreeBag: true, hasMeals: true, hasEntertainment: true },
    'QF': { name: 'Qantas', tier: 'TIER_1', hasFreeBag: true, hasMeals: true, hasEntertainment: true },
    'NH': { name: 'ANA (All Nippon)', tier: 'TIER_1', hasFreeBag: true, hasMeals: true, hasEntertainment: true },
    'JL': { name: 'Japan Airlines', tier: 'TIER_1', hasFreeBag: true, hasMeals: true, hasEntertainment: true },
    'BR': { name: 'EVA Air', tier: 'TIER_1', hasFreeBag: true, hasMeals: true, hasEntertainment: true },
    'CX': { name: 'Cathay Pacific', tier: 'TIER_1', hasFreeBag: true, hasMeals: true, hasEntertainment: true },
    'KE': { name: 'Korean Air', tier: 'TIER_1', hasFreeBag: true, hasMeals: true, hasEntertainment: true },
    'OZ': { name: 'Asiana Airlines', tier: 'TIER_1', hasFreeBag: true, hasMeals: true, hasEntertainment: true },
    'NZ': { name: 'Air New Zealand', tier: 'TIER_1', hasFreeBag: true, hasMeals: true, hasEntertainment: true },
    'EY': { name: 'Etihad Airways', tier: 'TIER_1', hasFreeBag: true, hasMeals: true, hasEntertainment: true },
    'CI': { name: 'China Airlines', tier: 'TIER_1', hasFreeBag: true, hasMeals: true, hasEntertainment: true },

    // ----------------------------------------------------------------
    // 😐 TIER 2: STANDART LEGACY (Güvenilir, Yemekli, Bagajlı)
    // ----------------------------------------------------------------
    // Avrupa
    'LH': { name: 'Lufthansa', tier: 'TIER_2', hasFreeBag: true, hasMeals: true, hasEntertainment: true },
    'BA': { name: 'British Airways', tier: 'TIER_2', hasFreeBag: true, hasMeals: true, hasEntertainment: true },
    'AF': { name: 'Air France', tier: 'TIER_2', hasFreeBag: true, hasMeals: true, hasEntertainment: true },
    'KL': { name: 'KLM', tier: 'TIER_2', hasFreeBag: true, hasMeals: true, hasEntertainment: true },
    'AY': { name: 'Finnair', tier: 'TIER_2', hasFreeBag: true, hasMeals: true, hasEntertainment: true },
    'SK': { name: 'SAS', tier: 'TIER_2', hasFreeBag: true, hasMeals: false, hasEntertainment: false }, // SAS bazen kısıtlıdır
    'IB': { name: 'Iberia', tier: 'TIER_2', hasFreeBag: true, hasMeals: true, hasEntertainment: true },

    // Asya & Ortadoğu
    'CZ': { name: 'China Southern', tier: 'TIER_2', hasFreeBag: true, hasMeals: true, hasEntertainment: true },
    'MU': { name: 'China Eastern', tier: 'TIER_2', hasFreeBag: true, hasMeals: true, hasEntertainment: true },
    'MH': { name: 'Malaysia Airlines', tier: 'TIER_2', hasFreeBag: true, hasMeals: true, hasEntertainment: true },
    'TG': { name: 'Thai Airways', tier: 'TIER_2', hasFreeBag: true, hasMeals: true, hasEntertainment: true },
    'VN': { name: 'Vietnam Airlines', tier: 'TIER_2', hasFreeBag: true, hasMeals: true, hasEntertainment: true },
    'GA': { name: 'Garuda Indonesia', tier: 'TIER_2', hasFreeBag: true, hasMeals: true, hasEntertainment: true },
    'SV': { name: 'Saudia', tier: 'TIER_2', hasFreeBag: true, hasMeals: true, hasEntertainment: true }, // Alkol yok ama konforlu
    'WY': { name: 'Oman Air', tier: 'TIER_2', hasFreeBag: true, hasMeals: true, hasEntertainment: true },
    'GF': { name: 'Gulf Air', tier: 'TIER_2', hasFreeBag: true, hasMeals: true, hasEntertainment: true },
    'KU': { name: 'Kuwait Airways', tier: 'TIER_2', hasFreeBag: true, hasMeals: true, hasEntertainment: true },
    'MS': { name: 'EgyptAir', tier: 'TIER_2', hasFreeBag: true, hasMeals: true, hasEntertainment: false }, // Ekranlar bazen eski

    // Amerika (ABD havayolları uluslararası uçuşta Tier 2'dir)
    'UA': { name: 'United Airlines', tier: 'TIER_2', hasFreeBag: true, hasMeals: true, hasEntertainment: true },
    'DL': { name: 'Delta Air Lines', tier: 'TIER_2', hasFreeBag: true, hasMeals: true, hasEntertainment: true },
    'AA': { name: 'American Airlines', tier: 'TIER_2', hasFreeBag: true, hasMeals: true, hasEntertainment: true },
    'AC': { name: 'Air Canada', tier: 'TIER_2', hasFreeBag: true, hasMeals: true, hasEntertainment: true },

    // ----------------------------------------------------------------
    // 🎒 LCC: LOW COST (Ucuzcu, Her Şey Paralı, Dar Koltuk)
    // ----------------------------------------------------------------
    // Asya & Pasifik
    'D7': { name: 'AirAsia X', tier: 'LCC', hasFreeBag: false, hasMeals: false, hasEntertainment: false },
    'AK': { name: 'AirAsia', tier: 'LCC', hasFreeBag: false, hasMeals: false, hasEntertainment: false },
    'XJ': { name: 'Thai AirAsia X', tier: 'LCC', hasFreeBag: false, hasMeals: false, hasEntertainment: false },
    'JQ': { name: 'Jetstar', tier: 'LCC', hasFreeBag: false, hasMeals: false, hasEntertainment: false },
    'TR': { name: 'Scoot', tier: 'LCC', hasFreeBag: false, hasMeals: false, hasEntertainment: false }, // Dreamliner kullanırlar ama içi boştur
    '5J': { name: 'Cebu Pacific', tier: 'LCC', hasFreeBag: false, hasMeals: false, hasEntertainment: false },
    'SL': { name: 'Thai Lion Air', tier: 'LCC', hasFreeBag: false, hasMeals: false, hasEntertainment: false },
    'VJ': { name: 'VietJet Air', tier: 'LCC', hasFreeBag: false, hasMeals: false, hasEntertainment: false }, // Koltuklar çok dar

    // Avrupa & Ortadoğu LCC
    'PC': { name: 'Pegasus', tier: 'LCC', hasFreeBag: false, hasMeals: false, hasEntertainment: false },
    'VF': { name: 'AJet', tier: 'LCC', hasFreeBag: false, hasMeals: false, hasEntertainment: false },
    'W6': { name: 'Wizz Air', tier: 'LCC', hasFreeBag: false, hasMeals: false, hasEntertainment: false }, // Çok katı bagaj kuralı
    'FR': { name: 'Ryanair', tier: 'LCC', hasFreeBag: false, hasMeals: false, hasEntertainment: false },
    'U2': { name: 'EasyJet', tier: 'LCC', hasFreeBag: false, hasMeals: false, hasEntertainment: false },
    'HV': { name: 'Transavia', tier: 'LCC', hasFreeBag: false, hasMeals: false, hasEntertainment: false },
    'TO': { name: 'Transavia France', tier: 'LCC', hasFreeBag: false, hasMeals: false, hasEntertainment: false },
    'G9': { name: 'Air Arabia', tier: 'LCC', hasFreeBag: false, hasMeals: false, hasEntertainment: false },
    'J9': { name: 'Jazeera Airways', tier: 'LCC', hasFreeBag: false, hasMeals: false, hasEntertainment: false },

    // ----------------------------------------------------------------
    // ⚖️ HYBRID / ÖZEL DURUMLAR (Dikkat Edilmesi Gerekenler)
    // ----------------------------------------------------------------
    // Batik Air: LCC sayılır ama bagaj verir, bazen ekran da vardır.
    'OD': { name: 'Batik Air Malaysia', tier: 'LCC', hasFreeBag: true, hasMeals: true, hasEntertainment: true },
    'ID': { name: 'Batik Air Indonesia', tier: 'LCC', hasFreeBag: true, hasMeals: false, hasEntertainment: false },

    // FlyDubai: Emirates'in kardeşidir ama LCC'dir (Yemek paralı olabilir)
    'FZ': { name: 'FlyDubai', tier: 'LCC', hasFreeBag: false, hasMeals: false, hasEntertainment: true },

    // Norse & Zipair: Uzun menzil LCC (Atlantik/Pasifik)
    'N0': { name: 'Norse Atlantic', tier: 'LCC', hasFreeBag: false, hasMeals: false, hasEntertainment: true }, // Ekran var, yemek yok
    'ZG': { name: 'Zipair', tier: 'LCC', hasFreeBag: false, hasMeals: false, hasEntertainment: false }, // Wifi bedava ama yemek/bagaj yok
};

// Bilinmeyen havayolu için varsayılan değerler
export function getAirlineInfo(code: string): AirlineInfo {
    // Eğer listede varsa döndür
    if (AIRLINE_DB[code]) return AIRLINE_DB[code];

    // Listede yoksa "Güvenli Varsayım" yap:
    // Çoğu bilinmeyen havayolu standart hizmet verir ama LCC gibi davranmak daha güvenli (Puanı şişirmemek için)
    return {
        name: code,
        tier: 'TIER_2', // Ortalama kabul et
        hasFreeBag: true,
        hasMeals: true,
        hasEntertainment: false // Ekran garantisi verme
    };
}

// Standart Bagaj Ücretleri (Bilinmiyorsa kullanılacak)
export const BAGGAGE_FEES: Record<string, number> = {
    'JQ': 45, // Jetstar
    'TR': 40, // Scoot
    'AK': 35, // AirAsia
    'D7': 45, // AirAsia X
    'PC': 30, // Pegasus
    'VF': 25, // AJet
    'W6': 40, // Wizz Air
    'FR': 35, // Ryanair
    'U2': 30, // EasyJet
    'TK': 0,  // THY (Genelde dahil)
    'SQ': 0,  // Singapore Airlines
    'EK': 0,  // Emirates
    'QR': 0,  // Qatar
};

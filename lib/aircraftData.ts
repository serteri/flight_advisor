/**
 * Aircraft Data Mapping
 * Uçak tipine göre konfor bilgisi sağlar
 */

export interface AircraftInfo {
    name: string;
    type: 'wide-body' | 'narrow-body' | 'regional';
    pitch: string;          // Diz mesafesi
    wifi: boolean;
    wifiPaid: boolean;
    power: boolean;         // USB/Priz
    entertainment: boolean; // Koltuk arkası ekran
    badge: string;
    comfort: 1 | 2 | 3 | 4 | 5; // 1=En kötü, 5=En iyi
}

// Yaygın uçak tipleri
const aircraftData: Record<string, AircraftInfo> = {
    // Geniş Gövde (Wide-body) - Uzun mesafe
    '388': {
        name: 'Airbus A380',
        type: 'wide-body',
        pitch: '84cm',
        wifi: true,
        wifiPaid: true,
        power: true,
        entertainment: true,
        badge: '👑 Uçan Saray',
        comfort: 5
    },
    '77W': {
        name: 'Boeing 777-300ER',
        type: 'wide-body',
        pitch: '81cm',
        wifi: true,
        wifiPaid: true,
        power: true,
        entertainment: true,
        badge: '✈️ Konforlu',
        comfort: 4
    },
    '789': {
        name: 'Boeing 787-9 Dreamliner',
        type: 'wide-body',
        pitch: '81cm',
        wifi: true,
        wifiPaid: true,
        power: true,
        entertainment: true,
        badge: '🌟 Dreamliner',
        comfort: 5
    },
    '788': {
        name: 'Boeing 787-8 Dreamliner',
        type: 'wide-body',
        pitch: '79cm',
        wifi: true,
        wifiPaid: true,
        power: true,
        entertainment: true,
        badge: '🌟 Dreamliner',
        comfort: 4
    },
    '359': {
        name: 'Airbus A350-900',
        type: 'wide-body',
        pitch: '81cm',
        wifi: true,
        wifiPaid: true,
        power: true,
        entertainment: true,
        badge: '💎 Premium',
        comfort: 5
    },
    '35K': {
        name: 'Airbus A350-1000',
        type: 'wide-body',
        pitch: '81cm',
        wifi: true,
        wifiPaid: true,
        power: true,
        entertainment: true,
        badge: '💎 Premium XL',
        comfort: 5
    },
    '773': {
        name: 'Boeing 777-300',
        type: 'wide-body',
        pitch: '79cm',
        wifi: true,
        wifiPaid: true,
        power: true,
        entertainment: true,
        badge: '✈️ Standart WB',
        comfort: 4
    },
    '772': {
        name: 'Boeing 777-200',
        type: 'wide-body',
        pitch: '79cm',
        wifi: false,
        wifiPaid: false,
        power: true,
        entertainment: true,
        badge: '✈️ Klasik WB',
        comfort: 3
    },
    '333': {
        name: 'Airbus A330-300',
        type: 'wide-body',
        pitch: '79cm',
        wifi: true,
        wifiPaid: true,
        power: true,
        entertainment: true,
        badge: '✈️ Standart WB',
        comfort: 3
    },
    '332': {
        name: 'Airbus A330-200',
        type: 'wide-body',
        pitch: '79cm',
        wifi: false,
        wifiPaid: false,
        power: true,
        entertainment: true,
        badge: '✈️ Eski WB',
        comfort: 3
    },

    // Dar Gövde (Narrow-body) - Kısa/Orta mesafe
    '32N': {
        name: 'Airbus A321neo',
        type: 'narrow-body',
        pitch: '76cm',
        wifi: true,
        wifiPaid: true,
        power: true,
        entertainment: false,
        badge: '🚀 Yeni Nesil',
        comfort: 3
    },
    '321': {
        name: 'Airbus A321',
        type: 'narrow-body',
        pitch: '74cm',
        wifi: false,
        wifiPaid: false,
        power: false,
        entertainment: false,
        badge: '🚌 Dar Gövde',
        comfort: 2
    },
    '320': {
        name: 'Airbus A320',
        type: 'narrow-body',
        pitch: '74cm',
        wifi: false,
        wifiPaid: false,
        power: false,
        entertainment: false,
        badge: '🚌 Dar Gövde',
        comfort: 2
    },
    '319': {
        name: 'Airbus A319',
        type: 'narrow-body',
        pitch: '74cm',
        wifi: false,
        wifiPaid: false,
        power: false,
        entertainment: false,
        badge: '🚌 Kompakt',
        comfort: 2
    },
    '738': {
        name: 'Boeing 737-800',
        type: 'narrow-body',
        pitch: '74cm',
        wifi: false,
        wifiPaid: false,
        power: false,
        entertainment: false,
        badge: '🚌 Dar Gövde',
        comfort: 2
    },
    '7M8': {
        name: 'Boeing 737 MAX 8',
        type: 'narrow-body',
        pitch: '76cm',
        wifi: true,
        wifiPaid: true,
        power: true,
        entertainment: false,
        badge: '🚀 Yeni MAX',
        comfort: 3
    },
};

export function getAircraftInfo(aircraftCode: string): AircraftInfo | null {
    return aircraftData[aircraftCode] || null;
}

export function getComfortStars(comfort: number): string {
    return '⭐'.repeat(comfort) + '☆'.repeat(5 - comfort);
}

export function getAircraftBadge(aircraftCode: string): string {
    const info = aircraftData[aircraftCode];
    if (!info) return '✈️ Bilinmiyor';
    return info.badge;
}

// Uçak tipine göre konfor özeti
export function getAircraftSummary(aircraftCode: string): string {
    const info = aircraftData[aircraftCode];
    if (!info) return 'Uçak bilgisi mevcut değil';

    const features: string[] = [];
    if (info.pitch) features.push(`🦵 ${info.pitch}`);
    if (info.wifi) features.push(info.wifiPaid ? '📶 Wifi (Ücretli)' : '📶 Wifi (Ücretsiz)');
    if (info.power) features.push('🔌 Priz/USB');
    if (info.entertainment) features.push('📺 Ekran');

    return features.join(' • ');
}

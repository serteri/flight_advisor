// --- TİPLER ---
export type RegionCode = 'NA' | 'SA' | 'EU_WEST' | 'EU_EAST' | 'EU_SOUTH' | 'EU_NORTH' | 'ME' | 'AFRICA' | 'ASIA_SE' | 'ASIA_EAST' | 'ASIA_SOUTH' | 'OCEANIA';
export type HubType = 'LCC' | 'LEGACY' | 'HYBRID'; // LCC: Ucuzcu, LEGACY: Bayrak taşıyıcı, HYBRID: İkisi de

interface HubInfo {
    code: string;
    city: string;
    region: RegionCode;
    type: HubType;
    rank: 1 | 2 | 3; // 1: Süper Hub (Mutlaka bak), 2: Bölgesel, 3: Niş (Sadece LCC için)
}

// --- MASTER HUB DATABASE (STRATEJİK SEÇKİ) ---
export const MASTER_HUB_DB: HubInfo[] = [
    // 🌏 OKYANUSYA
    { code: 'SYD', city: 'Sydney', region: 'OCEANIA', type: 'LEGACY', rank: 1 },
    { code: 'MEL', city: 'Melbourne', region: 'OCEANIA', type: 'LEGACY', rank: 1 },
    { code: 'AVV', city: 'Melbourne (Avalon)', region: 'OCEANIA', type: 'LCC', rank: 3 }, // AirAsia Üssü
    { code: 'BNE', city: 'Brisbane', region: 'OCEANIA', type: 'LEGACY', rank: 1 },
    { code: 'OOL', city: 'Gold Coast', region: 'OCEANIA', type: 'LCC', rank: 2 }, // Ucuz tatil rotası
    { code: 'PER', city: 'Perth', region: 'OCEANIA', type: 'LEGACY', rank: 1 }, // Avrupa'ya direkt kapı
    { code: 'ADL', city: 'Adelaide', region: 'OCEANIA', type: 'HYBRID', rank: 2 },
    { code: 'AKL', city: 'Auckland', region: 'OCEANIA', type: 'LEGACY', rank: 1 },

    // 🍜 GÜNEYDOĞU ASYA (Hacker Cenneti)
    { code: 'KUL', city: 'Kuala Lumpur', region: 'ASIA_SE', type: 'LCC', rank: 1 }, // DÜNYANIN EN UCUZ HUB'I
    { code: 'SIN', city: 'Singapore', region: 'ASIA_SE', type: 'HYBRID', rank: 1 },
    { code: 'BKK', city: 'Bangkok', region: 'ASIA_SE', type: 'LEGACY', rank: 1 },
    { code: 'DMK', city: 'Bangkok (Don Mueang)', region: 'ASIA_SE', type: 'LCC', rank: 1 }, // LCC Üssü
    { code: 'HKT', city: 'Phuket', region: 'ASIA_SE', type: 'HYBRID', rank: 2 },
    { code: 'SGN', city: 'Ho Chi Minh', region: 'ASIA_SE', type: 'LCC', rank: 2 }, // VietJet
    { code: 'MNL', city: 'Manila', region: 'ASIA_SE', type: 'LCC', rank: 2 }, // Cebu Pacific
    { code: 'DPS', city: 'Bali', region: 'ASIA_SE', type: 'HYBRID', rank: 2 },
    { code: 'CGK', city: 'Jakarta', region: 'ASIA_SE', type: 'LCC', rank: 2 },

    // 🎎 DOĞU ASYA
    { code: 'HKG', city: 'Hong Kong', region: 'ASIA_EAST', type: 'LEGACY', rank: 1 },
    { code: 'PVG', city: 'Shanghai', region: 'ASIA_EAST', type: 'LEGACY', rank: 1 }, // China Eastern (Ucuz)
    { code: 'CAN', city: 'Guangzhou', region: 'ASIA_EAST', type: 'LEGACY', rank: 1 }, // China Southern (Ucuz)
    { code: 'TPE', city: 'Taipei', region: 'ASIA_EAST', type: 'HYBRID', rank: 1 },
    { code: 'ICN', city: 'Seoul', region: 'ASIA_EAST', type: 'LEGACY', rank: 1 },
    { code: 'NRT', city: 'Tokyo (Narita)', region: 'ASIA_EAST', type: 'HYBRID', rank: 1 },
    { code: 'HND', city: 'Tokyo (Haneda)', region: 'ASIA_EAST', type: 'LEGACY', rank: 1 },
    { code: 'KIX', city: 'Osaka', region: 'ASIA_EAST', type: 'LCC', rank: 2 }, // Peach Aviation

    // 🍛 GÜNEY ASYA
    { code: 'DEL', city: 'Delhi', region: 'ASIA_SOUTH', type: 'HYBRID', rank: 1 },
    { code: 'BOM', city: 'Mumbai', region: 'ASIA_SOUTH', type: 'LEGACY', rank: 1 },
    { code: 'CMB', city: 'Colombo', region: 'ASIA_SOUTH', type: 'LEGACY', rank: 2 },

    // 🕌 ORTADOĞU (LCC + Legacy)
    { code: 'DXB', city: 'Dubai', region: 'ME', type: 'LEGACY', rank: 1 },
    { code: 'DWC', city: 'Dubai (Al Maktoum)', region: 'ME', type: 'LCC', rank: 3 },
    { code: 'AUH', city: 'Abu Dhabi', region: 'ME', type: 'HYBRID', rank: 1 }, // Wizz Air Üssü!
    { code: 'SHJ', city: 'Sharjah', region: 'ME', type: 'LCC', rank: 2 }, // Air Arabia (Çok ucuz)
    { code: 'DOH', city: 'Doha', region: 'ME', type: 'LEGACY', rank: 1 },
    { code: 'IST', city: 'Istanbul', region: 'ME', type: 'LEGACY', rank: 1 },
    { code: 'SAW', city: 'Istanbul (Sabiha)', region: 'ME', type: 'LCC', rank: 1 }, // Pegasus Kalesi
    { code: 'JED', city: 'Jeddah', region: 'ME', type: 'HYBRID', rank: 2 },
    { code: 'MCT', city: 'Muscat', region: 'ME', type: 'LEGACY', rank: 2 },

    // 🏰 AVRUPA (Batı)
    { code: 'LHR', city: 'London (Heathrow)', region: 'EU_WEST', type: 'LEGACY', rank: 1 },
    { code: 'LGW', city: 'London (Gatwick)', region: 'EU_WEST', type: 'HYBRID', rank: 1 }, // Norse/EasyJet
    { code: 'STN', city: 'London (Stansted)', region: 'EU_WEST', type: 'LCC', rank: 1 }, // Ryanair Kalesi
    { code: 'CDG', city: 'Paris', region: 'EU_WEST', type: 'LEGACY', rank: 1 },
    { code: 'BVA', city: 'Paris (Beauvais)', region: 'EU_WEST', type: 'LCC', rank: 3 }, // Aşırı Ucuz
    { code: 'AMS', city: 'Amsterdam', region: 'EU_WEST', type: 'LEGACY', rank: 1 },
    { code: 'FRA', city: 'Frankfurt', region: 'EU_WEST', type: 'LEGACY', rank: 1 },
    { code: 'HHN', city: 'Frankfurt (Hahn)', region: 'EU_WEST', type: 'LCC', rank: 3 }, // Kargo/Ryanair
    { code: 'MUC', city: 'Munich', region: 'EU_WEST', type: 'LEGACY', rank: 1 },
    { code: 'CRL', city: 'Brussels (Charleroi)', region: 'EU_WEST', type: 'LCC', rank: 1 }, // Hacker Merkezi

    // 🏰 AVRUPA (Güney)
    { code: 'MAD', city: 'Madrid', region: 'EU_SOUTH', type: 'LEGACY', rank: 1 },
    { code: 'BCN', city: 'Barcelona', region: 'EU_SOUTH', type: 'HYBRID', rank: 1 },
    { code: 'FCO', city: 'Rome', region: 'EU_SOUTH', type: 'LEGACY', rank: 1 },
    { code: 'BGY', city: 'Milan (Bergamo)', region: 'EU_SOUTH', type: 'LCC', rank: 1 }, // Ryanair Hub
    { code: 'LIS', city: 'Lisbon', region: 'EU_SOUTH', type: 'LEGACY', rank: 1 },
    { code: 'ATH', city: 'Athens', region: 'EU_SOUTH', type: 'HYBRID', rank: 2 }, // Scoot bağlantısı

    // 🏰 AVRUPA (Doğu - Wizz Air Bölgesi)
    { code: 'BUD', city: 'Budapest', region: 'EU_EAST', type: 'LCC', rank: 1 },
    { code: 'WAW', city: 'Warsaw', region: 'EU_EAST', type: 'LEGACY', rank: 2 },
    { code: 'WMI', city: 'Warsaw (Modlin)', region: 'EU_EAST', type: 'LCC', rank: 3 },
    { code: 'KUT', city: 'Kutaisi', region: 'EU_EAST', type: 'LCC', rank: 3 }, // Gürcistan (Asya kapısı)

    // 🗽 KUZEY AMERİKA
    { code: 'JFK', city: 'New York', region: 'NA', type: 'LEGACY', rank: 1 },
    { code: 'SWF', city: 'New York (Stewart)', region: 'NA', type: 'LCC', rank: 3 }, // Norse
    { code: 'LAX', city: 'Los Angeles', region: 'NA', type: 'LEGACY', rank: 1 },
    { code: 'SFO', city: 'San Francisco', region: 'NA', type: 'LEGACY', rank: 1 },
    { code: 'MIA', city: 'Miami', region: 'NA', type: 'LEGACY', rank: 1 },
    { code: 'FLL', city: 'Fort Lauderdale', region: 'NA', type: 'LCC', rank: 2 }, // Spirit/JetBlue
    { code: 'ORD', city: 'Chicago', region: 'NA', type: 'LEGACY', rank: 1 },
    { code: 'YYZ', city: 'Toronto', region: 'NA', type: 'LEGACY', rank: 1 },
    { code: 'YVR', city: 'Vancouver', region: 'NA', type: 'LEGACY', rank: 1 },
    { code: 'HNL', city: 'Honolulu', region: 'NA', type: 'HYBRID', rank: 2 },

    // 💃 GÜNEY AMERİKA
    { code: 'GRU', city: 'Sao Paulo', region: 'SA', type: 'LEGACY', rank: 1 },
    { code: 'BOG', city: 'Bogota', region: 'SA', type: 'LEGACY', rank: 1 },

    // 🦁 AFRİKA
    { code: 'CAI', city: 'Cairo', region: 'AFRICA', type: 'HYBRID', rank: 2 }, // Ucuz geçiş
    { code: 'ADD', city: 'Addis Ababa', region: 'AFRICA', type: 'LEGACY', rank: 2 },
    { code: 'JNB', city: 'Johannesburg', region: 'AFRICA', type: 'LEGACY', rank: 1 }
];

// ---------------------------------------------------------
// 🧠 ROTA MOTORU (The Smart Router)
// ---------------------------------------------------------
export function getSmartHubs(originCode: string, destCode: string): string[] {
    const origin = MASTER_HUB_DB.find(h => h.code === originCode);
    const dest = MASTER_HUB_DB.find(h => h.code === destCode);

    // Veritabanında yoksa genel büyük hubları dön
    if (!origin || !dest) return ['IST', 'DXB', 'LHR', 'SIN', 'KUL', 'JFK'];

    console.log(`🧭 Rota Stratejisi: ${origin.city} -> ${dest.city}`);

    let hubs: string[] = [];

    // 1. KANGURU ROTASI (Okyanusya <-> Avrupa)
    // En önemli hacker rotası budur.
    if (
        (origin.region === 'OCEANIA' && dest.region.startsWith('EU')) ||
        (origin.region.startsWith('EU') && dest.region === 'OCEANIA')
    ) {
        // Asya'nın ucuzları
        hubs.push('KUL', 'SIN', 'DMK', 'BKK', 'SGN');
        // Çin'in ucuzları
        hubs.push('PVG', 'CAN');
        // Ortadoğu'nun LCC'leri (Önemli!)
        hubs.push('AUH', 'SHJ', 'SAW', 'IST');
    }

    // 2. PASİFİK ROTASI (Asya <-> Amerika)
    else if (
        (origin.region.startsWith('ASIA') && dest.region === 'NA') ||
        (origin.region === 'NA' && dest.region.startsWith('ASIA'))
    ) {
        hubs.push('NRT', 'KIX'); // Japonya (ZipAir)
        hubs.push('TPE', 'ICN');
        hubs.push('HNL'); // Hawaii
        hubs.push('YVR'); // Vancouver
    }

    // 3. ATLANTİK ROTASI (Avrupa <-> Amerika)
    else if (
        (origin.region.startsWith('EU') && dest.region === 'NA') ||
        (origin.region === 'NA' && dest.region.startsWith('EU'))
    ) {
        hubs.push('KEF'); // İzlanda (En ucuz köprü)
        hubs.push('DUB'); // İrlanda
        hubs.push('LIS'); // Portekiz
        hubs.push('LGW'); // Londra (Norse)
        hubs.push('SWF'); // New York Stewart (Norse)
    }

    // 4. AVRUPA İÇİ HACKER (Wizz/Ryanair Bağlantıları)
    else if (origin.region.startsWith('EU') && dest.region.startsWith('EU')) {
        hubs.push('CRL'); // Brüksel Charleroi
        hubs.push('BGY'); // Milano Bergamo
        hubs.push('LTN', 'STN'); // Londra
        hubs.push('BUD'); // Budapeşte
        hubs.push('WMI'); // Varşova Modlin
    }

    // 5. ASYA İÇİ
    else if (origin.region.startsWith('ASIA') && dest.region.startsWith('ASIA')) {
        hubs.push('KUL', 'DMK', 'SIN', 'MNL');
    }

    // Varsayılan: Eğer strateji yoksa, yol üzerindeki en büyük "Rank 1" hub'ları al
    if (hubs.length === 0) {
        hubs.push('DXB', 'IST', 'DOH', 'LHR', 'FRA', 'SIN');
    }

    // Tekrarları temizle
    return Array.from(new Set(hubs));
}

import type { UnifiedFlight } from '@/types/unifiedFlight';

type ScoringFlight = {
    price: UnifiedFlight['price'];
    stops: UnifiedFlight['stops'];
    airline: UnifiedFlight['airline'];
} & {
    legal?: {
        isRefundable?: boolean;
    };
    amenities?: {
        hasWifi?: boolean;
        hasPower?: boolean;
        hasMeal?: boolean;
        baggage?: string;
    };
    baggageSummary?: {
        totalWeight?: string;
    };
};

export interface ScoreDetails {
    total: number;
    breakdown: {
        priceScore: number;
        durationScore: number;
        amenityScore: number;
        airlineBonus: number;
    };
    pros: string[];
    cons: string[];
}

export function calculateAgentScore(
    flight: any,
    context: { minPrice: number; minDuration: number }
): ScoreDetails {
    let score = 10.0; // 10'dan başlayıp düşeceğiz (Ceza Sistemi)
    const pros: string[] = [];
    const cons: string[] = [];

    // 1. FİYAT CEZASI (Acımasız)
    // En ucuz bilete göre ne kadar pahalı?
    const priceDiff = flight.price - context.minPrice;
    const priceRatio = flight.price / context.minPrice;

    if (priceRatio === 1) {
        pros.push("En İyi Fiyat 💰");
    } else if (priceRatio <= 1.15) {
        score -= 0.5; // %15 pahalıysa az kır
    } else if (priceRatio <= 1.5) {
        score -= 1.5; // %50 pahalıysa sert kır
        cons.push("Pahalı 💸");
    } else {
        score -= 3.0; // 2 katına yakınsa bitir
        cons.push("Çok Pahalı 📉");
    }

    // 2. SÜRE CEZASI (Dakika bazlı)
    // RapidAPI'den gelen süreyi parse et veya number ise kullan
    const parseDuration = (dur: any) => {
        if (typeof dur === 'number') return dur;
        if (!dur) return 9999;
        const parts = dur.split(' ');
        let mins = 0;
        for (const p of parts) {
            if (p.includes('s')) mins += parseInt(p) * 60;
            if (p.includes('dk')) mins += parseInt(p);
        }
        return mins || 9999;
    };

    const flightDuration = parseDuration(flight.duration);
    const minDuration = context.minDuration > 0 ? context.minDuration : flightDuration;

    // Fazladan geçen her saat için puan kır
    const extraHours = (flightDuration - minDuration) / 60;

    if (extraHours < 1) {
        pros.push("En Hızlı 🚀");
    } else if (extraHours > 10) {
        score -= 3.5; // 10 saat fark varsa öldür
        cons.push("Yolculuk Bitmez 🐢");
    } else if (extraHours > 5) {
        score -= 2.0;
        cons.push("Uzun Yolculuk ⏳");
    } else {
        score -= (extraHours * 0.2); // Her saat için 0.2 kır
    }

    // 3. AKTARMA VE KONFOR
    if (flight.stops === 0) {
        score += 1.0; // Direkt uçuş bonusu
        pros.push("Direkt Uçuş ✨");
    } else if (flight.stops === 1) {
        score -= 0.5; // 1 aktarma normaldir
    } else {
        score -= 2.5; // 2+ aktarma işkencedir
        cons.push("Çok Aktarma 🛑");
    }

    // 4. HAVAYOLU KALİTESİ (Tier List)
    const tierS = ["Qatar", "Singapore", "Emirates", "ANA", "Turkish Airlines"];
    const tierA = ["Lufthansa", "British Airways", "Qantas", "Etihad", "Virgin"];
    const tierC = ["Ryanair", "EasyJet", "Pegasus", "Wizz"];

    if (tierS.some(a => flight.airline.includes(a))) {
        score += 1.0;
        pros.push("Premium Havayolu 🏆");
    } else if (tierC.some(a => flight.airline.includes(a))) {
        score -= 1.0;
        cons.push("Düşük Konfor 💺");
    }

    // Amenities Kontrolü
    if (!flight.amenities?.hasMeal) {
        score -= 0.5;
        cons.push("Yemek Yok 🍔❌");
    }
    if (!flight.amenities?.baggage || flight.amenities?.baggage.includes("Kontrol")) {
        score -= 0.5;
        cons.push("Bagaj? 🧳");
    }

    // 5. SONUÇ SINIRLAMA (1.0 - 9.9)
    score = Math.max(1.0, Math.min(9.9, score));

    return {
        total: score,
        breakdown: { priceScore: 0, durationScore: 0, amenityScore: 0, airlineBonus: 0 }, // Detay şimdilik önemsiz
        pros,
        cons
    };
}

interface ScoringContext {
    minPrice: number;
    hasChild: boolean;
}

export function scoreFlightV3(flight: ScoringFlight, context: ScoringContext): { score: number, penalties: string[], pros: string[] } {
    let score = 10.0;
    const penalties: string[] = [];
    const pros: string[] = [];

    // --- 1. PRICE MASSACRE (Market Comparison) ---
    // Formula: If price > 1.5 * minPrice => score -= (ratio * 2)
    const priceRatio = flight.price / context.minPrice;

    // Base Price Score (0-4 points of the total)
    // ideal: ratio=1 -> +4 points. ratio=2 -> +0 points.
    const priceScore = Math.max(0, 4 - (priceRatio - 1) * 4);

    // Penalty for being expensive
    if (priceRatio > 1.5) {
        const penalty = (priceRatio * 2);
        score -= penalty;
        penalties.push(`Aşırı Pahalı (${priceRatio.toFixed(1)}x)`);
    } else {
        pros.push("Rekabetçi Fiyat");
    }

    // --- 2. JUNIOR GUARDIAN (Family Logic) ---
    if (context.hasChild && flight.stops > 1) {
        score -= 2.5;
        penalties.push("Çocukla 2+ Aktarma: YÜKSEK STRES");
    }

    // --- 3. DURATION & STOPS (Time Factor) ---
    // Base Time Score (0-4 points)
    // Long duration penalty
    if (flight.stops === 0) {
        score += 1.0;
        pros.push("Aktarmasız");
    } else if (flight.stops === 1) {
        // Neutral
    } else {
        score -= 1.5; // 2+ stops
        penalties.push("Çok Fazla Durak");
    }

    // Layover Stress
    // Note: We need detailed segments to do this accurately. 
    // Assuming we might have segment data or approximations.
    // For now, using duration overhead as a proxy if segments missing
    // or if we have specific layover data (future improvement).

    // --- 4. LEGAL & AMENITIES (Comfort Factor) ---
    // Refund
    if (flight.legal && !flight.legal.isRefundable) {
        score -= 1.5;
        penalties.push("İade Yok (Para Yanar)");
    } else if (flight.legal?.isRefundable) {
        score += 0.5;
        pros.push("İade Edilebilir");
    }

    // Amenities
    if (flight.amenities?.hasWifi) { score += 0.3; pros.push("Wi-Fi"); }
    if (flight.amenities?.hasPower) { score += 0.2; pros.push("Priz/USB"); }
    if (flight.amenities?.hasMeal) { score += 0.5; pros.push("Yemek Dahil"); }

    // Baggage
    if (flight.baggageSummary?.totalWeight === "0") {
        score -= 1.0;
        penalties.push("Bagaj Yok");
    }

    // --- 5. CALCULATION ---

    // Normalize properties for the "Formula" requested:
    // Total = (Time * 0.4) + (Price * 0.4) + (Comfort * 0.2) - Penalties
    // We implemented a hybrid approach where we start at 10 and deduct/add.
    // Let's refine to match the "Ruthless" vibe requested.

    // Cap Score
    if (score > 10) score = 10;
    if (score < 0.1) score = 0.1; // Never 0

    return {
        score: Number(score.toFixed(1)),
        penalties,
        pros
    };
}

// Wrapper for backward compatibility or simple usage
export function scoreFlight(flight: ScoringFlight): number {
    // Default context if not provided (assume no child, minPrice = price)
    return scoreFlightV3(flight, { minPrice: flight.price, hasChild: false }).score;
}

export function generateInsights(flight: ScoringFlight): { pros: string[], cons: string[], stressMap: string[], recommendationText: string } {
    // Re-use V3 logic for consistency
    // Note: In a real app, calculate context properly
    const { score, penalties, pros } = scoreFlightV3(flight, { minPrice: flight.price, hasChild: false });

    let recommendationText = "";
    if (score >= 8) recommendationText = "Mükemmel Fırsat. Hem fiyatı iyi hem de sizi yormaz.";
    else if (score >= 5) recommendationText = "Ortalama bir uçuş. Fiyat/performans dengesi standart.";
    else recommendationText = "Dikkatli olun. Bu uçuş sizi yorabilir veya gereksiz pahalı.";

    return {
        pros,
        cons: penalties,
        stressMap: flight.stops > 0 ? ['Check-in: Düşük', 'Aktarma: Yüksek', 'Varış: Orta'] : ['Check-in: Düşük', 'Uçuş: Düşük', 'Varış: Düşük'],
        recommendationText
    };
}

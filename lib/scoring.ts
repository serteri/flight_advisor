import { EnrichedFlightResult } from "@/types/flight";

// lib/scoring.ts
export function scoreFlight(f: EnrichedFlightResult): number {
    let score = 0;

    // 1. Fiyat Skoru (Ters orantılı, 1000 USD referans noktası)
    // Düşük fiyat daha yüksek skor demektir.
    score += 1000 / (f.price || 1000);

    // 2. Aktarma Skoru
    if (f.stops === 0) {
        score += 50; // Aktarmasız uçuşlar için büyük bonus
    } else if (f.stops === 1) {
        score += 10; // Tek aktarma kabul edilebilir.
    }
    // Çok aktarma (2+) bonus almaz.

    // 3. Bilet Esnekliği
    if (f.fareType === "flex") {
        score += 40;
    } else if (f.fareType === "standard") {
        score += 20;
    }

    // 4. Koltuk Konforu
    score += (f.seatComfortScore || 5) * 5;

    // 5. Ekstra Özellikler
    if (f.wifi) {
        score += 10;
    }
    if (f.baggage === "checked") {
        score += 15;
    }

    // 6. Fiyat Nadirliği
    score += (f.rarityScore || 0) * 3;

    // 7. Gecikme Riski
    if (f.delayRisk === "low") {
        score += 20;
    } else if (f.delayRisk === "high") {
        score -= 30; // Yüksek risk için ceza puanı
    }

    // Skoru 0-100 arasına normalize edebiliriz veya ham bırakabiliriz. Şimdilik ham bırakalım.
    // Daha sonra tüm sonuçlar içinde bir normalizasyon yapılabilir.
    return Math.round(score);
}
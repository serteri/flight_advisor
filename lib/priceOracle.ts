/**
 * Smart Price Oracle - Akıllı Fiyat Kahini
 * 4 Sinyal Bazlı Ağırlıklı Risk Algoritması
 * 
 * Sinyaller:
 * 1. Mevsimsellik (Seasonality) - Yüksek/Düşük sezon
 * 2. Zamanlama Eğrisi (Booking Curve) - Kalan gün sayısı
 * 3. Koltuk Kıtlığı (Scarcity) - Son kaç koltuk
 * 4. Hafta Günü (Day of Week) - Hafta sonu/içi
 */

export interface PriceForecast {
    action: 'BUY_NOW' | 'WAIT' | 'MONITOR';
    riskScore: number;      // 0 (Risk Yok) - 100 (Fiyat Patlamak Üzere)
    trendDirection: 'UP' | 'DOWN' | 'FLAT';
    signals: string[];      // Kullanıcıya göstereceğimiz ipuçları
    badge: {
        text: string;
        color: 'red' | 'green' | 'yellow' | 'blue';
        emoji: string;
    };
    confidence: number;     // % güven oranı
}

interface FlightData {
    departureTime: string;
    price: number;
    effectivePrice?: number;
    seatsAvailable?: number;
}

// Yüksek sezon ayları (0-indexed: 0=Ocak)
const HIGH_SEASON_MONTHS = [5, 6, 7, 11]; // Haziran, Temmuz, Ağustos, Aralık

export function predictSmartTrend(
    flight: FlightData,
    currentDate: Date = new Date()
): PriceForecast {

    let riskScore = 50; // Orta noktadan başla
    const signals: string[] = [];

    const departureDate = new Date(flight.departureTime);
    const daysLeft = Math.ceil((departureDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
    const month = departureDate.getMonth();

    // -----------------------------------------------------------
    // 1. MEVSİMSELLİK ANALİZİ ☀️
    // -----------------------------------------------------------
    const isHighSeason = HIGH_SEASON_MONTHS.includes(month);

    if (isHighSeason) {
        riskScore += 25;
        signals.push("🌞 Yüksek Sezon - Talep çok yüksek, fiyat düşmez");
    } else if ([1, 2, 10].includes(month)) { // Şubat, Mart, Kasım - Düşük sezon
        riskScore -= 15;
        signals.push("❄️ Düşük Sezon - İndirim olasılığı yüksek");
    }

    // -----------------------------------------------------------
    // 2. ZAMANLAMA EĞRİSİ (Booking Curve) ⏳
    // -----------------------------------------------------------
    if (daysLeft < 7) {
        riskScore += 40;
        signals.push("🔥 Son Hafta! Fiyatlar her an fırlayabilir");
    } else if (daysLeft < 14) {
        riskScore += 30;
        signals.push("⚠️ Son 2 Hafta - Artık bekleme riski yüksek");
    } else if (daysLeft < 30) {
        riskScore += 15;
        signals.push("⏰ 1 Aydan Az - İdeal alım dönemi");
    } else if (daysLeft < 60) {
        riskScore += 5;
        // Sweet spot - sinyal ekleme
    } else if (daysLeft > 180) {
        riskScore -= 25;
        signals.push("📅 6+ Ay Var - Kampanya beklenebilir");
    } else if (daysLeft > 120) {
        riskScore -= 15;
        signals.push("📆 4+ Ay Var - Acele etme, izle");
    }

    // -----------------------------------------------------------
    // 3. KOLTUK KITLIĞI (Scarcity) 💺
    // -----------------------------------------------------------
    const seatsLeft = flight.seatsAvailable ?? 9;

    if (seatsLeft <= 3) {
        riskScore += 30;
        signals.push(`🚨 Son ${seatsLeft} koltuk! Uçak dolmak üzere`);
    } else if (seatsLeft <= 5) {
        riskScore += 20;
        signals.push(`⚡ Son ${seatsLeft} koltuk - Doluluk yüksek`);
    } else if (seatsLeft <= 9) {
        riskScore += 5;
    }

    // -----------------------------------------------------------
    // 4. HAFTA GÜNÜ ETKİSİ 📅
    // -----------------------------------------------------------
    const dayOfWeek = departureDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
    const isTuesdayWednesday = dayOfWeek === 2 || dayOfWeek === 3;

    if (isWeekend) {
        riskScore += 10;
        signals.push("📍 Hafta sonu uçuşu - Genelde pahalı");
    } else if (isTuesdayWednesday) {
        riskScore -= 10;
        signals.push("💡 Salı/Çarşamba - Genelde en ucuz günler");
    }

    // -----------------------------------------------------------
    // 5. SONUÇ HESAPLAMA
    // -----------------------------------------------------------

    // Risk Skoru Normalizasyonu (0-100 arası tut)
    riskScore = Math.max(0, Math.min(100, riskScore));

    // Güven oranı hesapla
    const confidence = riskScore > 70 || riskScore < 30 ? 85 : 60;

    if (riskScore >= 75) {
        return {
            action: 'BUY_NOW',
            riskScore,
            trendDirection: 'UP',
            signals,
            badge: {
                text: 'HEMEN AL',
                color: 'red',
                emoji: '🔥'
            },
            confidence
        };
    } else if (riskScore >= 55) {
        return {
            action: 'BUY_NOW',
            riskScore,
            trendDirection: 'UP',
            signals,
            badge: {
                text: 'AL',
                color: 'yellow',
                emoji: '✅'
            },
            confidence
        };
    } else if (riskScore <= 30) {
        return {
            action: 'WAIT',
            riskScore,
            trendDirection: 'DOWN',
            signals,
            badge: {
                text: 'BEKLE',
                color: 'green',
                emoji: '📉'
            },
            confidence
        };
    } else {
        return {
            action: 'MONITOR',
            riskScore,
            trendDirection: 'FLAT',
            signals,
            badge: {
                text: 'TAKİP ET',
                color: 'blue',
                emoji: '👀'
            },
            confidence
        };
    }
}

// Risk skoru görsel bar için
export function getRiskBar(riskScore: number): string {
    const filled = Math.round(riskScore / 10);
    const empty = 10 - filled;

    if (riskScore >= 70) {
        return '🔴'.repeat(filled) + '⚪'.repeat(empty);
    } else if (riskScore >= 40) {
        return '🟡'.repeat(filled) + '⚪'.repeat(empty);
    } else {
        return '🟢'.repeat(filled) + '⚪'.repeat(empty);
    }
}

// Kısa tavsiye metni
export function getAdviceShort(forecast: PriceForecast): string {
    const { badge, riskScore } = forecast;
    return `${badge.emoji} ${badge.text} (Risk: ${riskScore}%)`;
}

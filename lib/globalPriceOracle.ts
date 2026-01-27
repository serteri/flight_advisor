/**
 * Global Price Oracle - Evrensel Fiyat Motoru
 * 
 * Coğrafyadan bağımsız çalışır ve şu 3 Evrensel Gerçeği analiz eder:
 * 1. Global Takvim (Universal Calendar) - Noel, Yılbaşı, Yaz Sezonu
 * 2. Matematiksel Konum (Statistical Position) - Standart Sapma analizi
 * 3. Havayolu Algoritmaları (Airline Logic) - 21-14-7 gün kuralı
 */

export interface GlobalPriceForecast {
    action: 'BUY_NOW' | 'WAIT' | 'MONITOR';
    riskScore: number; // 0-100
    trend: 'RISING' | 'FALLING' | 'STABLE';
    reasons: {
        icon: 'alert' | 'check' | 'chart' | 'info';
        textKey: string; // i18n translation key
        textParams?: Record<string, string | number>; // Parameters for translation
        impact: 'high' | 'medium' | 'low';
    }[];
    confidence: number;
    badgeKey: string; // i18n key for badge text
}

export interface MarketStats {
    minPrice: number;
    avgPrice: number;
    totalFlights: number;
}

interface FlightData {
    departureTime: string;
    price: number;
    effectivePrice?: number;
}

// Global Peak Months (0-indexed: 0=January)
// Northern Hemisphere Summer: 5,6,7 (June-August)
// Global Holiday Season: 11, 0 (December-January)
const GLOBAL_PEAK_MONTHS = [5, 6, 7, 11, 0];

// Low Season Months (February, March, October, November)
const LOW_SEASON_MONTHS = [1, 2, 9, 10];

export function predictGlobalTrend(
    flight: FlightData,
    marketStats: MarketStats,
    currentDate: Date = new Date()
): GlobalPriceForecast {

    const depDate = new Date(flight.departureTime);
    const daysLeft = Math.ceil((depDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
    const month = depDate.getMonth();
    const currentPrice = flight.effectivePrice || flight.price;

    let riskScore = 50; // Start neutral
    const reasons: GlobalPriceForecast['reasons'] = [];

    // ----------------------------------------------------------------
    // 1. TIME PRESSURE (Advance Purchase Rules) ⏳
    // Universal airline "AP" rules
    // ----------------------------------------------------------------
    if (daysLeft <= 3) {
        riskScore += 45;
        reasons.push({
            icon: 'alert',
            textKey: 'priceOracle.signals.last72Hours',
            impact: 'high'
        });
    } else if (daysLeft <= 7) {
        riskScore += 40;
        reasons.push({
            icon: 'alert',
            textKey: 'priceOracle.signals.lastWeek',
            impact: 'high'
        });
    } else if (daysLeft <= 14) {
        riskScore += 30;
        reasons.push({
            icon: 'chart',
            textKey: 'priceOracle.signals.twoWeekRule',
            impact: 'high'
        });
    } else if (daysLeft >= 21 && daysLeft <= 60) {
        riskScore -= 10;
        reasons.push({
            icon: 'check',
            textKey: 'priceOracle.signals.idealTime',
            impact: 'medium'
        });
    } else if (daysLeft > 180) {
        riskScore -= 15;
        reasons.push({
            icon: 'info',
            textKey: 'priceOracle.signals.tooEarly',
            impact: 'low'
        });
    } else if (daysLeft > 120) {
        riskScore -= 10;
        reasons.push({
            icon: 'info',
            textKey: 'priceOracle.signals.plentyOfTime',
            impact: 'low'
        });
    } else if (daysLeft < 30) {
        riskScore += 15;
        reasons.push({
            icon: 'chart',
            textKey: 'priceOracle.signals.lessThanMonth',
            impact: 'medium'
        });
    }

    // ----------------------------------------------------------------
    // 2. STATISTICAL MARKET POSITION 📊
    // Where is this flight in the current market?
    // ----------------------------------------------------------------
    if (marketStats.avgPrice > 0) {
        const deviationFromAvg = ((currentPrice - marketStats.avgPrice) / marketStats.avgPrice) * 100;
        const deviationFromMin = ((currentPrice - marketStats.minPrice) / marketStats.minPrice) * 100;

        if (deviationFromMin <= 2) {
            // Within 2% of the cheapest price
            riskScore += 20;
            reasons.push({
                icon: 'check',
                textKey: 'priceOracle.signals.bottomPrice',
                impact: 'high'
            });
        } else if (deviationFromAvg < -20) {
            // 20%+ below average
            riskScore += 15;
            reasons.push({
                icon: 'check',
                textKey: 'priceOracle.signals.belowAverage',
                textParams: { percent: Math.abs(Math.round(deviationFromAvg)) },
                impact: 'medium'
            });
        } else if (deviationFromAvg > 30) {
            // 30%+ above average
            riskScore -= 25;
            reasons.push({
                icon: 'alert',
                textKey: 'priceOracle.signals.aboveAverage',
                textParams: { percent: Math.round(deviationFromAvg) },
                impact: 'high'
            });
        }
    }

    // ----------------------------------------------------------------
    // 3. GLOBAL SEASONALITY 🌍
    // ----------------------------------------------------------------
    if (GLOBAL_PEAK_MONTHS.includes(month)) {
        riskScore += 25;
        reasons.push({
            icon: 'chart',
            textKey: 'priceOracle.signals.peakSeason',
            impact: 'medium'
        });
    } else if (LOW_SEASON_MONTHS.includes(month)) {
        riskScore -= 10;
        reasons.push({
            icon: 'info',
            textKey: 'priceOracle.signals.lowSeason',
            impact: 'low'
        });
    }

    // ----------------------------------------------------------------
    // 4. DAY OF WEEK LOGIC 📅
    // ----------------------------------------------------------------
    const dayOfWeek = depDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
    const isTuesdayWednesday = dayOfWeek === 2 || dayOfWeek === 3;

    if (isWeekend) {
        riskScore += 10;
        reasons.push({
            icon: 'info',
            textKey: 'priceOracle.signals.weekend',
            impact: 'low'
        });
    } else if (isTuesdayWednesday) {
        riskScore -= 10;
        reasons.push({
            icon: 'check',
            textKey: 'priceOracle.signals.tuesdayWednesday',
            impact: 'low'
        });
    }

    // ----------------------------------------------------------------
    // 5. RESULT CALCULATION
    // ----------------------------------------------------------------
    riskScore = Math.min(99, Math.max(1, riskScore));

    let action: GlobalPriceForecast['action'] = 'MONITOR';
    let trend: GlobalPriceForecast['trend'] = 'STABLE';
    let badgeKey = 'priceOracle.badges.monitor';

    if (riskScore >= 75) {
        action = 'BUY_NOW';
        trend = 'RISING';
        badgeKey = 'priceOracle.badges.buyNow';
    } else if (riskScore >= 55) {
        action = 'BUY_NOW';
        trend = 'RISING';
        badgeKey = 'priceOracle.badges.buy';
    } else if (riskScore <= 30) {
        action = 'WAIT';
        trend = 'FALLING';
        badgeKey = 'priceOracle.badges.wait';
    }

    // Confidence calculation
    const confidence = riskScore > 70 || riskScore < 30 ? 80 : 60;

    return {
        action,
        riskScore,
        trend,
        reasons,
        confidence,
        badgeKey
    };
}

// Calculate market statistics from flight list
export function calculateMarketStats(flights: { price: number; effectivePrice?: number }[]): MarketStats {
    if (flights.length === 0) {
        return { minPrice: 0, avgPrice: 0, totalFlights: 0 };
    }

    const prices = flights.map(f => f.effectivePrice || f.price);
    const minPrice = Math.min(...prices);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

    return {
        minPrice,
        avgPrice,
        totalFlights: flights.length
    };
}

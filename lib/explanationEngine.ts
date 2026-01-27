/**
 * Flight Explanation Engine (MVP - Rule-Based)
 * 
 * Purpose: Generate human-readable "Reasons," "Risks," and "Trade-offs"
 * to build user trust through transparent decision-making.
 * 
 * Philosophy: Unlike AI/ML, this is pure rule-based logic that users can understand.
 */

// ----------------------------
// INTERFACES
// ----------------------------

export type AirlineTier = 'PREMIUM' | 'STANDARD' | 'LCC';

export interface FlightData {
    id: string;
    price: number;
    totalDuration: number; // minutes
    stops: number;
    layoverDuration: number; // max layover in minutes, 0 if direct
    airlineTier: AirlineTier;
    aircraftScore: number; // 0-10
    isOvernight: boolean;
    hasAirportChange: boolean;
    carrierName?: string;
}

export interface MarketContext {
    marketMinPrice: number;
    marketMinDuration: number;
    marketMedianPrice: number;
}

export interface RiskFlag {
    type: string;
    label: string;
}

export interface TradeOffComparison {
    text: string;
    gains: string[];
    losses: string[];
}

export interface FlightExplanation {
    badge: string;
    pros: string[];
    risks: RiskFlag[];
    tradeOffs: {
        vsCheapest?: TradeOffComparison;
        vsFastest?: TradeOffComparison;
    };
}

// ----------------------------
// 1. PROS GENERATOR
// ----------------------------
/**
 * User Psychology: Users want to know WHY they should pick a flight.
 * We prioritize Speed > Comfort > Value > Efficiency > Hardware.
 * Returns top 3 strongest selling points.
 */
export function getFlightPros(flight: FlightData, context: MarketContext): string[] {
    const pros: { priority: number; text: string }[] = [];

    // Priority 1: Speed - Being fast is the #1 concern for travelers
    const durationThreshold = context.marketMinDuration * 1.10; // Within 10%
    if (flight.totalDuration <= durationThreshold) {
        pros.push({ priority: 1, text: "⚡ En hızlı seçeneklerden biri" });
    }

    // Priority 2: Comfort - Premium airlines provide peace of mind
    if (flight.airlineTier === 'PREMIUM') {
        pros.push({ priority: 2, text: "💎 Premium havayolu konforu" });
    }

    // Priority 3: Value - Good price relative to market
    if (flight.price <= context.marketMedianPrice) {
        pros.push({ priority: 3, text: "💰 Fiyat/performans oranı yüksek" });
    }

    // Priority 4: Efficiency - Quick connection = less stress
    if (flight.stops === 1 && flight.layoverDuration < 180 && flight.layoverDuration > 75) {
        pros.push({ priority: 4, text: "✅ Verimli aktarma süresi" });
    }

    // Priority 5: Hardware - Modern aircraft = better experience
    if (flight.aircraftScore >= 8) {
        pros.push({ priority: 5, text: "✈️ Yeni nesil uçak, modern kabin" });
    }

    // Direct flight is always a pro
    if (flight.stops === 0) {
        pros.push({ priority: 1.5, text: "🎯 Direkt uçuş, aktarma yok" });
    }

    // Sort by priority and return top 3
    pros.sort((a, b) => a.priority - b.priority);
    return pros.slice(0, 3).map(p => p.text);
}

// ----------------------------
// 2. RISK ENGINE
// ----------------------------
/**
 * User Psychology: Transparency builds trust.
 * If there are risks, we tell the user upfront.
 * An empty risks array = user feels confident.
 */
export function getRiskFlags(flight: FlightData): RiskFlag[] {
    const risks: RiskFlag[] = [];

    // Tight connection: High stress, risk of missing flight
    if (flight.layoverDuration > 0 && flight.layoverDuration < 75) {
        risks.push({
            type: "tight_connection",
            label: "⚠️ Riskli Aktarma (<1s 15dk)"
        });
    }

    // Airport change: Major hassle, requires leaving terminal
    if (flight.hasAirportChange) {
        risks.push({
            type: "airport_change",
            label: "🚨 Havalimanı Değişikliği"
        });
    }

    // Overnight layover: Fatigue, need for hotel
    if (flight.isOvernight) {
        risks.push({
            type: "overnight",
            label: "🌙 Gece Aktarması"
        });
    }

    // Long layover: Time wasted, boredom
    if (flight.layoverDuration > 360) {
        risks.push({
            type: "long_layover",
            label: "⏳ Uzun Bekleme (+6 saat)"
        });
    }

    // Old cabin: Less comfort on long flights
    if (flight.aircraftScore < 5) {
        risks.push({
            type: "old_cabin",
            label: "🏚️ Eski Kabin"
        });
    }

    // LCC on long haul: Discomfort warning
    if (flight.airlineTier === 'LCC' && flight.totalDuration > 360) {
        risks.push({
            type: "lcc_long_haul",
            label: "💺 Düşük maliyetli havayolu (uzun yolculuk)"
        });
    }

    return risks;
}

// ----------------------------
// 3. TRADE-OFF LOGIC
// ----------------------------
/**
 * User Psychology: Users want to understand opportunity cost.
 * "What am I gaining/losing by picking this instead of the cheapest/fastest?"
 */
export function getTradeOffs(
    selectedFlight: FlightData,
    cheapestFlight: FlightData,
    fastestFlight: FlightData,
    currency: string = "TRY"
): { vsCheapest?: TradeOffComparison; vsFastest?: TradeOffComparison } {
    const tradeOffs: { vsCheapest?: TradeOffComparison; vsFastest?: TradeOffComparison } = {};

    // VS CHEAPEST
    if (selectedFlight.id !== cheapestFlight.id) {
        const priceDiff = selectedFlight.price - cheapestFlight.price;
        const timeSavedMinutes = cheapestFlight.totalDuration - selectedFlight.totalDuration;
        const timeSavedHours = (timeSavedMinutes / 60).toFixed(1);

        const gains: string[] = [];
        const losses: string[] = [];

        // What the user gains by paying more
        if (timeSavedMinutes > 60) {
            gains.push(`+${timeSavedHours} saat zaman kazanıyorsun`);
        }
        if (selectedFlight.stops < cheapestFlight.stops) {
            gains.push(`Daha az aktarma (${selectedFlight.stops} vs ${cheapestFlight.stops})`);
        }
        if (selectedFlight.airlineTier === 'PREMIUM' && cheapestFlight.airlineTier !== 'PREMIUM') {
            gains.push("Premium havayolu konforu");
        }
        if (cheapestFlight.hasAirportChange && !selectedFlight.hasAirportChange) {
            gains.push("Havalimanı değişikliği yok");
        }

        // What the user loses
        if (priceDiff > 0) {
            losses.push(`-${formatPrice(priceDiff, currency)} daha pahalı`);
        }

        if (gains.length > 0 || losses.length > 0) {
            tradeOffs.vsCheapest = {
                text: priceDiff > 0
                    ? `Bu uçuşu seçerek ${formatPrice(priceDiff, currency)} fazla ödüyorsun ama...`
                    : "Bu uçuş en ucuz seçenek!",
                gains,
                losses
            };
        }
    }

    // VS FASTEST
    if (selectedFlight.id !== fastestFlight.id) {
        const moneySaved = fastestFlight.price - selectedFlight.price;
        const timeAddedMinutes = selectedFlight.totalDuration - fastestFlight.totalDuration;
        const timeAddedHours = (timeAddedMinutes / 60).toFixed(1);

        const gains: string[] = [];
        const losses: string[] = [];

        // What the user gains by going slower
        if (moneySaved > 0) {
            gains.push(`+${formatPrice(moneySaved, currency)} tasarruf`);
        }

        // What the user loses
        if (timeAddedMinutes > 60) {
            losses.push(`-${timeAddedHours} saat daha uzun yolculuk`);
        }
        if (selectedFlight.stops > fastestFlight.stops) {
            losses.push(`Daha fazla aktarma (${selectedFlight.stops} vs ${fastestFlight.stops})`);
        }

        if (gains.length > 0 || losses.length > 0) {
            tradeOffs.vsFastest = {
                text: moneySaved > 0
                    ? `En hızlı yerine bunu seçerek ${formatPrice(moneySaved, currency)} tasarruf edebilirsin.`
                    : "Bu zaten en hızlı veya benzer sürede!",
                gains,
                losses
            };
        }
    }

    return tradeOffs;
}

// ----------------------------
// 4. BADGE GENERATOR
// ----------------------------
/**
 * User Psychology: Badges provide instant recognition.
 * Only assign special badges when criteria are truly met.
 */
export function getFlightBadge(
    flight: FlightData,
    context: MarketContext,
    score: number
): string {
    // BEST DEAL: Must be top scorer AND meet value criteria
    if (score >= 8.5) {
        const isPriceGood = flight.price <= context.marketMinPrice * 1.15;
        const isDurationGood = flight.totalDuration <= context.marketMinDuration * 1.2;
        const isLowStops = flight.stops <= 1;

        if (isPriceGood && isDurationGood && isLowStops) {
            return "🏆 BEST DEAL";
        }
    }

    // FASTEST
    if (flight.totalDuration === context.marketMinDuration) {
        return "⚡ FASTEST";
    }

    // CHEAPEST
    if (flight.price === context.marketMinPrice) {
        return "💰 CHEAPEST";
    }

    // PREMIUM COMFORT
    if (flight.airlineTier === 'PREMIUM' && flight.aircraftScore >= 8) {
        return "💎 PREMIUM COMFORT";
    }

    // NO HASSLE
    if (flight.stops === 0 && !flight.hasAirportChange) {
        return "✅ NO HASSLE";
    }

    return "";
}

// ----------------------------
// 5. FULL EXPLANATION GENERATOR
// ----------------------------
/**
 * Main function that combines all explanation components.
 * Returns a complete explanation object ready for UI.
 */
export function generateFlightExplanation(
    flight: FlightData,
    context: MarketContext,
    cheapestFlight: FlightData,
    fastestFlight: FlightData,
    score: number,
    currency: string = "TRY"
): FlightExplanation {
    return {
        badge: getFlightBadge(flight, context, score),
        pros: getFlightPros(flight, context),
        risks: getRiskFlags(flight),
        tradeOffs: getTradeOffs(flight, cheapestFlight, fastestFlight, currency)
    };
}

// ----------------------------
// HELPER FUNCTIONS
// ----------------------------

function formatPrice(amount: number, currency: string): string {
    if (currency === "TRY") {
        return `₺${amount.toLocaleString('tr-TR')}`;
    }
    return `${amount.toLocaleString()} ${currency}`;
}

/**
 * Convert FlightForScoring (from main engine) to FlightData for explanation
 */
export function toFlightData(
    flight: any,
    airlineTier: 'PREMIUM' | 'STANDARD' | 'LCC' = 'STANDARD'
): FlightData {
    return {
        id: flight.id,
        price: flight.price,
        totalDuration: flight.duration,
        stops: flight.stops,
        layoverDuration: (flight.layoverHoursTotal || 0) * 60,
        airlineTier,
        aircraftScore: 7, // Default to neutral, can be enhanced later
        isOvernight: (flight.layoverHoursTotal || 0) > 8,
        hasAirportChange: false, // Can be enhanced later
        carrierName: flight.carrierName
    };
}

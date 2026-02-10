import { FlightResult, HybridSearchParams } from '@/types/hybridFlight';

interface ScoringContext {
    minPrice: number;
    hasChild: boolean;
}

export function scoreFlightV3(flight: FlightResult, context: ScoringContext): { score: number, penalties: string[], pros: string[] } {
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
export function scoreFlight(flight: FlightResult): number {
    // Default context if not provided (assume no child, minPrice = price)
    return scoreFlightV3(flight, { minPrice: flight.price, hasChild: false }).score;
}

export function generateInsights(flight: FlightResult): { pros: string[], cons: string[], stressMap: string[], recommendationText: string } {
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

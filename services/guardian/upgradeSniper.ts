// services/agents/upgradeSniper.ts

export interface SniperResult {
    isSniperDeal: boolean;
    ratio: number;
    message: string;
}

export function analyzeUpgradeOpportunity(economyPrice: number, businessPrice: number): SniperResult {
    const ratio = businessPrice / economyPrice;

    // Sniper Formülü: Oran 1.5'in altındaysa "Sniper Alert" çalar
    if (ratio <= 1.5) {
        return {
            isSniperDeal: true,
            ratio: ratio,
            message: `SNIPER ALERT: Business Class sadece %${Math.round((ratio - 1) * 100)} daha pahalı! Fırsatı kaçırma.`
        };
    }

    return { isSniperDeal: false, ratio: ratio, message: "" };
}

// Legacy wrapper for backwards compatibility
export interface UpgradeOpportunity {
    flightId: string;
    originalClass: 'ECONOMY';
    upgradePrice: number;
    currency: string;
    savings: number;
    isRareDeal: boolean;
    actionUrl: string;
}

export function checkUpgradeAvailability(flight: any): UpgradeOpportunity | null {
    const economyPrice = flight.price?.raw || flight.price || 500;

    // In production: would fetch business class price from API
    // For now: simulate or extract from flight data if available
    const businessPrice = flight.businessPrice || (economyPrice * 2.5);

    const sniperResult = analyzeUpgradeOpportunity(economyPrice, businessPrice);

    if (!sniperResult.isSniperDeal) return null;

    return {
        flightId: flight.id,
        originalClass: 'ECONOMY',
        upgradePrice: businessPrice,
        currency: flight.price?.currency || 'EUR',
        savings: Math.round((1 - sniperResult.ratio) * 100),
        isRareDeal: true,
        actionUrl: flight.deepLink
    };
}

export type FlightSource = "duffel" | "kiwi" | "travelpayouts" | "rapidapi" | "RAPID_API" | "DUFFEL" | "SKY_RAPID" | "AIR_RAPID" | "OPENCLAW" | "SKY_SCANNER_PRO";

export type CabinClass = "economy" | "premium" | "business" | "first";

export type BaggageType = "none" | "cabin" | "checked";

export type FareType = "basic" | "standard" | "flex";

export type DelayRisk = "low" | "medium" | "high";

export type HybridSearchParams = {
    origin: string;
    destination: string;
    date: string;
    returnDate?: string;
    adults: number;
    children?: number; // For Junior Guardian logic
    infants?: number;
    cabin?: "economy" | "business" | "first";
    currency?: string;
};

export type FlightResult = {
    id: string;
    source: FlightSource;
    airline: string;
    airlineLogo?: string; // Duffel'dan geliyor, burada eksikti
    flightNumber: string;
    aircraft?: string;
    from: string;
    to: string;
    departTime: string;
    arriveTime: string;
    duration: number; // minutes or whatever format you use
    durationLabel?: string;
    stops: number;
    segments?: any[];
    price: number;
    currency: string;
    cabinClass: CabinClass;
    baggage?: BaggageType;
    fareType?: FareType;
    seatComfortScore?: number;
    wifi?: boolean;
    entertainment?: boolean;
    power?: boolean;
    meal?: "included" | "paid" | "none";
    legroom?: string; // e.g. "79cm"
    aircraftAge?: number; // years
    layout?: string; // e.g. "3-3-3"
    delayRisk?: DelayRisk;
    rarityScore?: number;
    score?: number;
    insights?: string[];
    analysis?: {
        pros: string[];
        cons: string[];
        stressMap: string[]; // e.g. ["Pre-flight: Low", "Connection: High"]
        recommendationText?: string;
    };
    bookingLink?: string;
    deepLink?: string; // RapidAPI veya OpenClaw kullanabilir

    // V3 Premium Data
    amenities?: {
        hasWifi: boolean;
        hasPower?: boolean;
        hasMeal: boolean;
        seatType?: string;
        baggage?: string; // OpenClaw formatı için
        entertainment?: string; // OpenClaw formatı için
        seatPitch?: string; // OpenClaw formatı için
        food?: string; // OpenClaw formatı için
    };
    // OpenClaw'ın policies alanı
    policies?: {
        baggageKg?: number;
        cabinBagKg?: number;
        refundable?: boolean;
        changeAllowed?: boolean;
        changeFee?: string;
        upgradeAllowed?: boolean;
    };
    
    baggageSummary?: {
        checked: string;
        cabin: string;
        totalWeight: string;
    };
    legal?: {
        refundStatus: string;
        changeStatus: string;
        formattedRefund: string;
        formattedChange: string;
        isRefundable: boolean;
        isChangeable: boolean;
    };
    agentScore?: number;
    scoreDetails?: {
        total: number;
        breakdown?: {
            priceScore?: number;
            durationScore?: number;
            amenityScore?: number;
            airlineBonus?: number;
        };
        penalties?: string[]; // Keeping for backward compatibility if needed
        pros?: string[];     // Keeping for backward compatibility if needed
    };
    scoreReason?: string; // OpenClaw reason
    scorePros?: string[];
    scoreCons?: string[];
};

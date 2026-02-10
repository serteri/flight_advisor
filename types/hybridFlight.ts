export type FlightSource = "duffel" | "kiwi" | "travelpayouts" | "rapidapi" | "RAPID_API" | "DUFFEL";

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
    flightNumber: string;
    aircraft?: string;
    from: string;
    to: string;
    departTime: string;
    arriveTime: string;
    duration: number;
    stops: number;
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

    // V3 Premium Data
    amenities?: {
        hasWifi: boolean;
        hasPower: boolean;
        hasMeal: boolean;
        seatType: string;
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
            priceScore: number;
            durationScore: number;
            amenityScore: number;
            airlineBonus: number;
        };
        penalties?: string[]; // Keeping for backward compatibility if needed
        pros?: string[];     // Keeping for backward compatibility if needed
    };
    scorePros?: string[];
    scoreCons?: string[];
};

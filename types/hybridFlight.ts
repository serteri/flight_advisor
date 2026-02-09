export type FlightSource = "duffel" | "kiwi" | "travelpayouts" | "rapidapi";

export type CabinClass = "economy" | "premium" | "business" | "first";

export type BaggageType = "none" | "cabin" | "checked";

export type FareType = "basic" | "standard" | "flex";

export type DelayRisk = "low" | "medium" | "high";

export type HybridSearchParams = {
    origin: string;
    destination: string;
    date: string;
    adults?: number;
    cabin?: CabinClass;
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
};

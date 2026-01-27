
import { AirlineTier } from './airlineDB';

// ----------------------------
// INTERFACES
// ----------------------------
// ----------------------------
// INTERFACES
// ----------------------------

export interface FlightSegment {
    from: string;
    to: string;
    carrier: string;
    carrierName: string;
    flightNumber: string;
    departure: string;
    arrival: string;
    duration: number;
    cabin?: string;
    baggageWeight?: number;
    baggageQuantity?: number;
    baggageDisplay?: string;
    origin?: string;
    destination?: string;
}

export interface FlightForScoring {
    id: string;
    // --- RAW METRICS ---
    price: number;
    currency: string;
    duration: number; // minutes
    stops: number;
    carrier: string; // "TK"
    carrierName: string;
    flightNumber?: string;

    departureTime: string; // ISO String
    arrivalTime: string;   // ISO String

    segments: FlightSegment[];

    // --- ENRICHED DATA ---
    effectivePrice?: number; // Gizli maliyetler eklenmis
    baggageWeight?: number; // kg
    baggageIncluded?: boolean; // legacy
    hasMeal?: boolean;
    isSelfTransfer?: boolean;
    isLCC?: boolean;
    isOvernight?: boolean;

    layoverHoursTotal?: number;
    layovers?: { airport: string; duration: number; city?: string }[];
    amenities?: {
        hasEntertainment: boolean;
        hasMeals: boolean;
        tier: any;
        baggage?: { weight: number; quantity: number };
    };

    // --- SCORING ENGINE OUTPUTS ---
    scores?: {
        total: number;      // 0.0 - 10.0 (Final)
        price: number;      // 0-100
        time: number;       // 0-100
        comfort: number;    // 0-100
        regret: number;     // 0-100
        deltaPrice?: number;
    };

    // --- HUMAN LAYER ---
    identity?: {
        label: string;
        emoji: string;
        description: string;
        color: string;
    };

    stress?: {
        checkIn: 'low' | 'medium' | 'high';
        transfer: 'low' | 'medium' | 'high' | 'critical';
        baggage: 'low' | 'high';
        timeline: 'smooth' | 'exhausting';
        totalScore?: number;
        reliability?: string;
    };

    // --- VERDICT ---
    aiVerdict?: {
        decision: 'recommended' | 'consider' | 'avoid';
        badge: string; // "🏆 BEST PICK"
        headline: string;
        reason: string;
        pros: string[];
        cons: string[];
        warning?: string;
        tradeoff?: string;
        scenario?: string;
        socialProof?: string[]; // e.g. "62% of users avoided this layover"
    };

    // UI Compatibility
    score?: number;
    badge?: string;
    analysis?: any; // Legacy hook
    explanation?: string;

    [key: string]: any;
}


export type Flight = FlightForScoring; // Alias for new code usage
export type ScoredFlight = FlightForScoring; // Legacy compatibility


export interface FlightIdentity {
    label: string;
    emoji: string;
    description: string;
    color: string;
}


export interface StressMap {
    checkIn: 'low' | 'medium' | 'high';
    layover?: 'low' | 'medium' | 'high'; // Optional as used differently in Consultant vs Types previously
    transfer?: 'low' | 'medium' | 'high' | 'critical';
    baggage: 'low' | 'high';
    timeline?: 'smooth' | 'exhausting';
    reliability?: string;
    totalScore?: number;
}

export interface ValueTriangle {
    money: 'gain' | 'neutral' | 'loss';
    time: 'gain' | 'neutral' | 'loss';
    comfort: 'gain' | 'neutral' | 'loss';
    summary: string;
}

export interface FlightScoreAnalysis {
    score: number;
    decisionScore: number;
    regretScore: number;
    penalties: string[];
    bonuses: string[];
    identity: FlightIdentity;
    stress: StressMap;
    value: ValueTriangle;
    components: {
        priceScore: number;
        timeScore: number;
        comfortScore: number;
    };
}

export interface FlightScoreResult {
    score: number;
    label: string;
    explanation: string;
    breakdown: {
        priceScore: number;
        durationScore: number;
        layoverScore: number;
        airlineScore: number;
        penalties: string[];
    };
}

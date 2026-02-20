import { AirlineTier } from './airlineDB';

// ----------------------------
// MASTER SCORE TYPES (Imported from masterFlightScore)
// ----------------------------
export interface ScorePenalty {
    reason: string;
    points: number;
    category: 'RISK' | 'COMFORT' | 'TIME' | 'PRICE';
}

export interface ScoreBonus {
    reason: string;
    points: number;
    category: 'VALUE' | 'EXPERIENCE' | 'TIMING';
}

export interface MasterScoreBreakdown {
    total: number; // 0-100
    
    // CORE FACTORS (60 points max)
    priceScore: number;      // 0-25
    durationScore: number;   // 0-15
    stopsScore: number;      // 0-10
    layoverScore: number;    // 0-10
    
    // QUALITY FACTORS (25 points max)
    airlineScore: number;    // 0-8
    baggageScore: number;    // 0-5
    mealScore: number;       // 0-3
    entertainmentScore: number; // 0-3
    aircraftScore: number;   // 0-6
    
    // SMART FACTORS (15 points max)
    priceStabilityScore: number; // 0-5
    reliabilityScore: number;    // 0-5
    flexibilityScore: number;    // 0-5
    
    // PENALTIES (Unlimited negative)
    penalties: ScorePenalty[];
    totalPenalties: number;
    
    // BONUS (Capped at +5)
    bonuses: ScoreBonus[];
    totalBonuses: number;
}

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
    aircraft?: string; // Aircraft type (e.g., "A350", "B787")
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
    baggageQuantity?: number; // pieces
    baggageIncluded?: boolean; // legacy
    hasMeal?: boolean;
    isSelfTransfer?: boolean;
    isLCC?: boolean;
    isOvernight?: boolean;
    
    // ✅ NEW: Duffel conditions (Real Data from API)
    refundable?: boolean; // From Duffel conditions.refund_before_departure
    changeAllowed?: boolean; // From Duffel conditions.change_before_departure
    changeFee?: string; // e.g. "50 USD"

    layoverHoursTotal?: number;
    layovers?: { airport: string; duration: number; city?: string }[];
    amenities?: {
        hasEntertainment: boolean;
        hasMeals: boolean;
        tier: any;
        baggage?: { weight: number; quantity: number };
    };

    // --- SCORING ENGINE OUTPUTS ---
    masterScore?: MasterScoreBreakdown; // NEW: 100-point Master Score breakdown
    
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

    bookingProviders?: {
        name: string;
        price: number;
        currency: string;
        logo?: string;
        link: string;
        type: 'airline' | 'agency';
        rating?: number;       // New: Agent rating (e.g., 4.2)
        reviewCount?: number;  // New: Number of reviews
        isOfficial?: boolean;  // New: Official airline site?
    }[];

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

/**
 * MASTER FLIGHT SCORE ENGINE v1.0
 * 
 * Vision: "Not a Ticket Seller, but a Flight Guardian"
 * 
 * Scoring Architecture (0-100 points):
 * - CORE FACTORS (60%) - Wallet & Logic
 * - QUALITY FACTORS (25%) - Comfort & Luxury  
 * - SMART FACTORS (15%) - AI Predictions
 */

import { FlightForScoring, MasterScoreBreakdown, ScorePenalty, ScoreBonus } from './flightTypes';
import { getAirlineInfo } from './airlineDB';

// =====================================================
// TYPES & INTERFACES
// =====================================================

export interface MarketContext {
    minPrice: number;
    maxPrice: number;
    avgPrice: number;
    medianPrice: number;
    
    minDuration: number;
    maxDuration: number;
    avgDuration: number;
    
    totalFlights: number;
    directFlightsCount: number;
}

// =====================================================
// A. CORE FACTORS (60 points)
// =====================================================

/**
 * Price Score (0-25 points)
 * Formula: 25 * (minPrice / thisPrice) with decay curve
 */
function calculatePriceScore(flight: FlightForScoring, market: MarketContext): number {
    const price = flight.effectivePrice || flight.price;
    const ratio = market.minPrice / price;
    
    // Perfect: Same as cheapest = 25 pts
    // 15% more expensive = 20 pts
    // 50% more expensive = 12 pts
    // 2x expensive = 5 pts
    
    if (ratio >= 1.0) return 25; // Cheapest or better
    if (ratio >= 0.85) return 20; // Within 15%
    if (ratio >= 0.67) return 12; // Within 50%
    if (ratio >= 0.50) return 5;  // Within 2x
    
    return Math.max(0, 25 * ratio); // Exponential decay
}

/**
 * Duration Score (0-15 points)
 * Formula: 15 * (minDuration / thisDuration) with threshold
 */
function calculateDurationScore(flight: FlightForScoring, market: MarketContext): number {
    const ratio = market.minDuration / flight.duration;
    
    // Perfect: Fastest = 15 pts
    // 10% slower = 12 pts
    // 30% slower = 8 pts
    // 2x slower = 3 pts
    
    if (ratio >= 1.0) return 15;
    if (ratio >= 0.90) return 12;
    if (ratio >= 0.70) return 8;
    if (ratio >= 0.50) return 3;
    
    return Math.max(0, 15 * ratio);
}

/**
 * Stops Score (0-10 points)
 * Direct flight is king
 */
function calculateStopsScore(flight: FlightForScoring): number {
    const stops = flight.stops || 0;
    
    if (stops === 0) return 10; // Direct Flight: Perfect
    if (stops === 1) return 6;  // 1 Stop: Good
    if (stops === 2) return 2;  // 2 Stops: Weak
    return 0; // 3+ Stops: Terrible
}

/**
 * Layover Quality Score (0-10 points)
 * Golden Zone: 1-3 hours
 * Trauma Zone: <1h (risky) or >10h (exhausting)
 */
function calculateLayoverScore(flight: FlightForScoring): number {
    const stops = flight.stops || 0;
    
    if (stops === 0) return 10; // No layover = perfect
    
    const layovers = flight.layovers || [];
    if (layovers.length === 0) return 5; // Unknown layovers (neutral)
    
    let totalScore = 0;
    let count = 0;
    
    for (const layover of layovers) {
        const minutes = layover.duration;
        
        // Golden Zone: 90-180 minutes
        if (minutes >= 90 && minutes <= 180) {
            totalScore += 10;
        }
        // Acceptable: 60-90 or 180-360
        else if ((minutes >= 60 && minutes < 90) || (minutes > 180 && minutes <= 360)) {
            totalScore += 7;
        }
        // Tight: 45-60 minutes
        else if (minutes >= 45 && minutes < 60) {
            totalScore += 4;
        }
        // Risky: <45 minutes
        else if (minutes < 45) {
            totalScore += 0;
        }
        // Long: 6-10 hours
        else if (minutes > 360 && minutes <= 600) {
            totalScore += 3;
        }
        // Nightmare: >10 hours
        else {
            totalScore += 0;
        }
        
        count++;
    }
    
    return count > 0 ? Math.round(totalScore / count) : 5;
}

// =====================================================
// B. QUALITY FACTORS (25 points)
// =====================================================

/**
 * Airline Quality Score (0-8 points)
 * Based on Skytrax ratings and global perception
 */
function calculateAirlineScore(flight: FlightForScoring): number {
    const airline = getAirlineInfo(flight.carrier);
    
    // TIER_1 (Qatar, Singapore, Emirates): 8 pts
    // TIER_2 (Turkish, Lufthansa, ANA): 6 pts
    // LCC (Ryanair, Spirit): 2 pts
    
    if (airline.tier === 'TIER_1') return 8;
    if (airline.tier === 'TIER_2') return 6;
    if (airline.tier === 'LCC') return 2;
    
    return 3; // Unknown airlines
}

/**
 * Baggage Score (0-5 points)
 * Hidden cost trap detector
 */
function calculateBaggageScore(flight: FlightForScoring): number {
    const weight = flight.baggageWeight || 0;
    
    if (weight >= 30) return 5; // Generous (30kg+)
    if (weight >= 23) return 4; // Standard (23kg)
    if (weight >= 15) return 3; // Light (15kg)
    if (weight >= 7) return 1;  // Minimal (cabin only)
    
    return 0; // No baggage = penalty
}

/**
 * Meal Score (0-3 points)
 * Important for long flights (5+ hours)
 */
function calculateMealScore(flight: FlightForScoring): number {
    const airline = getAirlineInfo(flight.carrier);
    const hasMeal = flight.hasMeal || airline.hasMeals;
    
    // Long flights without meals = disaster
    if (flight.duration >= 300) { // 5+ hours
        return hasMeal ? 3 : 0;
    }
    
    // Medium flights
    if (flight.duration >= 180) { // 3-5 hours
        return hasMeal ? 2 : 1;
    }
    
    // Short flights: meal is bonus
    return hasMeal ? 1 : 2; // No meal expected on short flights
}

/**
 * Entertainment Score (0-3 points)
 * WiFi and screens
 */
function calculateEntertainmentScore(flight: FlightForScoring): number {
    const airline = getAirlineInfo(flight.carrier);
    const hasIFE = airline.hasEntertainment;
    
    // Long flights need IFE
    if (flight.duration >= 360) { // 6+ hours
        return hasIFE ? 3 : 0;
    }
    
    return hasIFE ? 2 : 1; // Bonus for short flights
}

/**
 * Aircraft Comfort Score (0-6 points)
 * Wide-body (A350/B787) comfort bonus
 * Narrow-body oceanic crossing penalty
 */
function calculateAircraftScore(flight: FlightForScoring): number {
    const segments = flight.segments || [];
    if (segments.length === 0) return 3; // Unknown = neutral
    
    let totalScore = 0;
    
    for (const seg of segments) {
        const aircraft = seg.aircraft || '';
        const isLongSegment = (seg.duration || 0) > 300; // 5+ hours
        
        // Wide-body comfort aircraft
        const isWideBody = /A350|A380|B787|B777|B747/.test(aircraft);
        
        if (isWideBody) {
            totalScore += 6;
        } else if (isLongSegment) {
            // Narrow body on long flight = penalty
            totalScore += 2;
        } else {
            totalScore += 4; // Standard
        }
    }
    
    return Math.round(totalScore / segments.length);
}

// =====================================================
// C. SMART FACTORS (15 points)
// =====================================================

/**
 * Price Stability Score (0-5 points)
 * "This is rock bottom, buy now!" signal
 * 
 * TODO: Implement historical price tracking
 * For now: Placeholder logic based on position in market
 */
function calculatePriceStabilityScore(flight: FlightForScoring, market: MarketContext): number {
    const price = flight.effectivePrice || flight.price;
    const position = (price - market.minPrice) / (market.maxPrice - market.minPrice);
    
    // Bottom 10%: Likely dip = 5 pts
    if (position <= 0.10) return 5;
    
    // Bottom 25%: Good deal = 3 pts
    if (position <= 0.25) return 3;
    
    // Middle: Neutral = 2 pts
    if (position <= 0.75) return 2;
    
    // Top tier: Likely to drop = 0 pts
    return 0;
}

/**
 * Reliability Score (0-5 points)
 * Self-transfer risk, tight connections, airline punctuality
 */
function calculateReliabilityScore(flight: FlightForScoring): number {
    let score = 5; // Start perfect
    
    // Self-transfer = KILL IT
    if (flight.isSelfTransfer) {
        score = 0;
        return score;
    }
    
    // Short connections (<60 min international)
    const layovers = flight.layovers || [];
    for (const layover of layovers) {
        if (layover.duration < 60) {
            score -= 3; // Risky connection
        }
    }
    
    // TODO: Add airline on-time performance data
    // For now: TIER_1 airlines get bonus
    const airline = getAirlineInfo(flight.carrier);
    if (airline.tier === 'TIER_1') {
        score = Math.min(5, score + 1);
    }
    
    return Math.max(0, score);
}

/**
 * Flexibility Score (0-5 points)
 * Can you change/refund this ticket?
 */
function calculateFlexibilityScore(flight: FlightForScoring): number {
    // TODO: Parse fare rules from Duffel/Amadeus
    // For now: Placeholder
    
    const isBasicEconomy = (flight.cabin || '').includes('BASIC');
    const isLCC = getAirlineInfo(flight.carrier).tier === 'LCC';
    
    if (isBasicEconomy || isLCC) return 0; // No flexibility
    
    // Business/First: Full flexibility
    if ((flight.cabin || '').includes('BUSINESS') || (flight.cabin || '').includes('FIRST')) {
        return 5;
    }
    
    return 3; // Standard economy (some flexibility)
}

// =====================================================
// D. PENALTIES & BONUSES
// =====================================================

function calculatePenalties(flight: FlightForScoring, market: MarketContext): { penalties: ScorePenalty[], total: number } {
    const penalties: ScorePenalty[] = [];
    
    // RISK PENALTIES
    if (flight.isSelfTransfer) {
        penalties.push({ reason: 'Self-Transfer Risk', points: -25, category: 'RISK' });
    }
    
    const layovers = flight.layovers || [];
    for (const layover of layovers) {
        if (layover.duration < 45) {
            penalties.push({ reason: 'Dangerously Tight Connection', points: -15, category: 'RISK' });
        }
    }
    
    // COMFORT PENALTIES
    if ((flight.baggageWeight || 0) === 0) {
        penalties.push({ reason: 'No Checked Baggage', points: -8, category: 'COMFORT' });
    }
    
    if (flight.duration >= 300 && !(flight.hasMeal || getAirlineInfo(flight.carrier).hasMeals)) {
        penalties.push({ reason: 'No Meal on Long Flight', points: -5, category: 'COMFORT' });
    }
    
    // TIME PENALTIES
    if (flight.duration > 35 * 60) { // 35+ hours
        penalties.push({ reason: 'Exhausting Journey (35h+)', points: -12, category: 'TIME' });
    }
    
    if ((flight.stops || 0) >= 3) {
        penalties.push({ reason: '3+ Stops', points: -10, category: 'TIME' });
    }
    
    // Overnight departure/arrival
    const segments = flight.segments || [];
    if (segments.length > 0) {
        const firstDep = new Date(segments[0].departure);
        const lastArr = new Date(segments[segments.length - 1].arrival);
        
        const depHour = firstDep.getHours();
        const arrHour = lastArr.getHours();
        
        if (depHour >= 0 && depHour <= 5) {
            penalties.push({ reason: 'Midnight Departure', points: -5, category: 'TIME' });
        }
        
        if (arrHour >= 0 && arrHour <= 5) {
            penalties.push({ reason: 'Midnight Arrival', points: -5, category: 'TIME' });
        }
    }
    
    // PRICE PENALTIES
    const price = flight.effectivePrice || flight.price;
    const priceRatio = price / market.minPrice;
    
    if (priceRatio > 2.5) {
        penalties.push({ reason: 'Extremely Overpriced (2.5x)', points: -20, category: 'PRICE' });
    } else if (priceRatio > 2.0) {
        penalties.push({ reason: 'Very Expensive (2x)', points: -10, category: 'PRICE' });
    }
    
    const total = penalties.reduce((sum, p) => sum + p.points, 0);
    return { penalties, total };
}

function calculateBonuses(flight: FlightForScoring, market: MarketContext): { bonuses: ScoreBonus[], total: number } {
    const bonuses: ScoreBonus[] = [];
    
    // VALUE BONUSES
    const price = flight.effectivePrice || flight.price;
    if (price === market.minPrice && (flight.stops || 0) === 0) {
        bonuses.push({ reason: 'Cheapest Direct Flight', points: 5, category: 'VALUE' });
    }
    
    // EXPERIENCE BONUSES
    if ((flight.stops || 0) === 0 && flight.duration === market.minDuration) {
        bonuses.push({ reason: 'Perfect Flight (Fast + Direct)', points: 3, category: 'EXPERIENCE' });
    }
    
    // Premium hub bonus
    const layovers = flight.layovers || [];
    const premiumHubs = ['DOH', 'DXB', 'SIN', 'IST', 'HND', 'ICN'];
    for (const layover of layovers) {
        if (premiumHubs.includes(layover.airport)) {
            bonuses.push({ reason: `Premium Hub (${layover.airport})`, points: 2, category: 'EXPERIENCE' });
            break; // Only once
        }
    }
    
    // TIMING BONUSES
    const segments = flight.segments || [];
    if (segments.length > 0) {
        const arrTime = new Date(segments[segments.length - 1].arrival);
        const arrHour = arrTime.getHours();
        
        // Morning arrival (07:00-12:00) = perfect for starting day
        if (arrHour >= 7 && arrHour <= 12) {
            bonuses.push({ reason: 'Convenient Morning Arrival', points: 2, category: 'TIMING' });
        }
    }
    
    const total = Math.min(5, bonuses.reduce((sum, b) => sum + b.points, 0)); // Cap at +5
    return { bonuses, total };
}

// =====================================================
// MASTER CALCULATION
// =====================================================

export function calculateMasterScore(flight: FlightForScoring, market: MarketContext): MasterScoreBreakdown {
    // CORE (60 pts max)
    const priceScore = calculatePriceScore(flight, market);
    const durationScore = calculateDurationScore(flight, market);
    const stopsScore = calculateStopsScore(flight);
    const layoverScore = calculateLayoverScore(flight);
    
    // QUALITY (25 pts max)
    const airlineScore = calculateAirlineScore(flight);
    const baggageScore = calculateBaggageScore(flight);
    const mealScore = calculateMealScore(flight);
    const entertainmentScore = calculateEntertainmentScore(flight);
    const aircraftScore = calculateAircraftScore(flight);
    
    // SMART (15 pts max)
    const priceStabilityScore = calculatePriceStabilityScore(flight, market);
    const reliabilityScore = calculateReliabilityScore(flight);
    const flexibilityScore = calculateFlexibilityScore(flight);
    
    // MODIFIERS
    const { penalties, total: totalPenalties } = calculatePenalties(flight, market);
    const { bonuses, total: totalBonuses } = calculateBonuses(flight, market);
    
    // TOTAL CALCULATION
    const rawTotal = 
        priceScore + durationScore + stopsScore + layoverScore + // CORE
        airlineScore + baggageScore + mealScore + entertainmentScore + aircraftScore + // QUALITY
        priceStabilityScore + reliabilityScore + flexibilityScore + // SMART
        totalPenalties + totalBonuses; // MODIFIERS
    
    const total = Math.max(0, Math.min(100, rawTotal)); // Clamp to 0-100
    
    return {
        total: Math.round(total),
        
        // Core breakdown
        priceScore,
        durationScore,
        stopsScore,
        layoverScore,
        
        // Quality breakdown
        airlineScore,
        baggageScore,
        mealScore,
        entertainmentScore,
        aircraftScore,
        
        // Smart breakdown
        priceStabilityScore,
        reliabilityScore,
        flexibilityScore,
        
        // Modifiers
        penalties,
        totalPenalties,
        bonuses,
        totalBonuses
    };
}

// =====================================================
// BATCH PROCESSING
// =====================================================

export function calculateMarketContext(flights: FlightForScoring[]): MarketContext {
    if (flights.length === 0) {
        return {
            minPrice: 0,
            maxPrice: 0,
            avgPrice: 0,
            medianPrice: 0,
            minDuration: 0,
            maxDuration: 0,
            avgDuration: 0,
            totalFlights: 0,
            directFlightsCount: 0
        };
    }
    
    const prices = flights.map(f => f.effectivePrice || f.price).filter(p => p > 0).sort((a, b) => a - b);
    const durations = flights.map(f => f.duration).filter(d => d > 0).sort((a, b) => a - b);
    
    const directFlights = flights.filter(f => (f.stops || 0) === 0);
    
    return {
        minPrice: prices[0] || 0,
        maxPrice: prices[prices.length - 1] || 0,
        avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
        medianPrice: prices[Math.floor(prices.length / 2)] || 0,
        
        minDuration: durations[0] || 0,
        maxDuration: durations[durations.length - 1] || 0,
        avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
        
        totalFlights: flights.length,
        directFlightsCount: directFlights.length
    };
}

export function scoreBatchFlights(flights: FlightForScoring[]): FlightForScoring[] {
    const market = calculateMarketContext(flights);
    
    return flights.map(flight => {
        const masterScore = calculateMasterScore(flight, market);
        
        return {
            ...flight,
            masterScore, // Store full breakdown
            scores: {
                total: masterScore.total, // Override legacy score
                price: 0,
                time: 0,
                comfort: 0,
                regret: 0,
                deltaPrice: 0
            }
        };
    }).sort((a, b) => (b.masterScore?.total || 0) - (a.masterScore?.total || 0));
}

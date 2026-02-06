import { getAirlineInfo } from './airlineDB';
import { FlightForScoring, FlightIdentity, ScoredFlight, FlightScoreResult } from './flightTypes';
import { enrichFlightData } from './flightEnricher';

// Re-export types
export * from './flightTypes';

// --- 1. İSTATİSTİK HESABI ---
export interface BatchStats {
    minPrice: number;
    maxPrice: number;
    minDuration: number;
    maxRawScore: number;
    referencePrice: number; // For V7 logic
    p50Price: number;
    maxDuration: number;
}

export function calculateBatchStats(flights: FlightForScoring[]): BatchStats | null {
    if (!flights.length) return null;
    const prices = flights.map(f => f.effectivePrice || f.price).filter(p => p > 0).sort((a, b) => a - b);
    const durations = flights.map(f => f.duration).filter(d => d > 0).sort((a, b) => a - b);

    if (!prices.length || !durations.length) return null;

    // Outlier Protection V7
    const outlierIndex = Math.floor(prices.length * 0.10);
    const referenceMinPrice = prices[outlierIndex] || prices[0];

    return {
        minPrice: prices[0],
        maxPrice: prices[prices.length - 1],
        minDuration: durations[0],
        maxDuration: durations[durations.length - 1],
        maxRawScore: 0, // Will be calculated in aggregator
        referencePrice: referenceMinPrice,
        p50Price: prices[Math.floor(prices.length * 0.5)]
    };
}

// --- 2. RAW SCORE HESABI (Ham Puan) ---
// Bu fonksiyon 0-100 arası bir "Ham Puan" üretir. Sonra bunu scale edeceğiz.
// --- 2. MASTER SCORE ENGINE (V10 - The 9-Headed Monster) ---
// Formula: Score = Base(0-6) + PriceValue(0-2) + Comfort(0-1.5) + Bonuses(0-0.8) - Penalties(0-4)
// Total theoretical max ~10.3 (Clamped to 9.8)

export function calculateRawScore(flight: FlightForScoring, stats: BatchStats): number {
    const segments = flight.segments || [];
    const firstSegment = segments[0];
    const lastSegment = segments[segments.length - 1];
    const depDate = firstSegment ? new Date(firstSegment.departure) : new Date();
    const arrDate = lastSegment ? new Date(lastSegment.arrival) : new Date();

    const airline = getAirlineInfo(flight.carrier);
    const isLCC = airline.tier === 'LCC';
    const stops = flight.stops || 0;

    // --- 1. BASE QUALITY SCORE (0-6) ---
    // Start with assumptions of ideal flight, deduct for bad deviations

    // A. Duration Score (0-2)
    // Compare to minDuration. If equal => 2. If double => 0.
    const durationRatio = flight.duration / stats.minDuration;
    let baseDuration = Math.max(0, 2 - (durationRatio - 1) * 2); // Linear drop off

    // B. Stop Score (0-1.5)
    let baseStops = 0;
    if (stops === 0) baseStops = 1.5;
    else if (stops === 1) baseStops = 0.8;
    else baseStops = 0; // 2+ stops gets no base points here

    // C. Layover Quality (0-1) - Calculated if stops > 0
    let baseLayover = 0;
    if (stops === 1) {
        // Assume single layover duration ~ (flight.duration - minDuration) as rough proxy if segments not parsed deeply
        // Better: iterate segments. But for now, if duration is close to min, layover is efficient.
        if (durationRatio < 1.15) baseLayover = 1.0;
        else if (durationRatio < 1.3) baseLayover = 0.5;
    } else if (stops === 0) {
        baseLayover = 1.0; // Non-stop is perfect layover
    }

    // D. Timing (0-1.5)
    // Dep: 02:00-05:00 is bad. 08:00-18:00 ideal.
    const depHour = depDate.getHours();
    const arrHour = arrDate.getHours();

    let baseTiming = 0;
    // Departure Scores
    if (depHour >= 8 && depHour <= 20) baseTiming += 0.75; // Prime time
    else if (depHour >= 6 && depHour < 23) baseTiming += 0.4;
    else baseTiming += 0; // Graveyard shift 

    // Arrival Scores
    if (arrHour >= 8 && arrHour <= 22) baseTiming += 0.75;
    else if (arrHour >= 7) baseTiming += 0.4;

    const baseScore = baseDuration + baseStops + baseLayover + baseTiming; // Max ~6

    // --- 2. PRICE VALUE SCORE (0-2) ---
    // Formula: 2 * (minPrice / thisPrice)
    // Cap: Min price gets 2. 50% more expensive gets 1.33. 2x expensive gets 1.
    const scorePrice = Math.min(2, 2 * (stats.minPrice / (flight.effectivePrice || flight.price)));

    // --- 3. COMFORT & INCLUSIONS (0-1.5) ---
    let scoreComfort = 0;
    // Baggage (+0.5)
    if ((flight.baggageWeight || 0) >= 20 || airline.hasFreeBag) scoreComfort += 0.5;
    // Food (+0.3)
    if (flight.hasMeal || airline.hasMeals) scoreComfort += 0.3;
    // IFE (+0.2)
    if (airline.hasEntertainment) scoreComfort += 0.2;
    // Airline Tier (+0.5 for Premium)
    if (airline.tier === 'TIER_1') scoreComfort += 0.5;

    // --- 4. PENALTIES (-4.0 Max) ---
    let penalties = 0;

    // Time Penalties
    if (flight.duration > 35 * 60) penalties += 1.5; // > 35 hours
    else if (flight.duration > 24 * 60) penalties += 0.8;

    // Layover/Stop Penalties
    if (stops === 2) penalties += 1.2;
    if (stops >= 3) penalties += 2.0;

    // Midnight Flights
    if (depHour >= 0 && depHour <= 5) penalties += 0.7;
    if (arrHour >= 0 && arrHour <= 5) penalties += 0.7;

    // Self Transfer (The killer)
    if (flight.isSelfTransfer) penalties += 2.0;

    // --- 5. SMART BONUSES (0-0.8) ---
    let bonuses = 0;
    // Just a sample: if duration is surprisingly fast for a cheaper flight
    if (durationRatio < 1.1 && !isLCC) bonuses += 0.4; // Valid efficient flight
    if (arrHour >= 7 && arrHour <= 12) bonuses += 0.3; // Morning arrival

    // --- TOTAL CALCULATION ---
    let totalScore = baseScore + scorePrice + scoreComfort + bonuses - penalties;

    // Final Clamp
    if (totalScore > 9.8) totalScore = 9.8;
    if (totalScore < 1.0) totalScore = 1.0;

    return parseFloat(totalScore.toFixed(1));
}

// --- 3. SCORING & ANALYSIS ---
export function scoreFlight(flight: FlightForScoring, stats: BatchStats, maxRawScore?: number): FlightForScoring {
    const finalScore = calculateRawScore(flight, stats); // Contains the full logic now

    // ... Generate Identity & Stress (reusing existing logic, simplified) ...
    // Using the new 'finalScore' directly to generate verdict.

    let decision: 'recommended' | 'consider' | 'avoid' = 'consider';
    let badge = 'badge_standard';

    if (finalScore >= 8.5) {
        decision = 'recommended';
        badge = 'badge_best_pick';
    } else if (finalScore >= 6.5) {
        decision = 'consider';
        badge = 'badge_good';
    } else if (finalScore < 4.5) {
        decision = 'avoid';
        badge = 'badge_avoid';
    }

    return {
        ...flight,
        scores: {
            total: finalScore,
            price: 0, // Breakdown could be passed if return type allowed
            time: 0,
            comfort: 0,
            regret: 0,
            deltaPrice: 0
        },
        aiVerdict: {
            decision,
            badge,
            headline: decision === 'recommended' ? 'verdict_headline_best' : 'verdict_headline_standard',
            reason: `Score: ${finalScore}/10`,
            pros: [],
            cons: [],
            warning: undefined,
            tradeoff: 'tradeoff_balanced',
            scenario: '',
            socialProof: []
        },
        badge,
        stress: {
            checkIn: 'low',
            transfer: 'low',
            baggage: 'low',
            timeline: 'smooth'
        },
        identity: { label: 'identity_standard', emoji: '✈️', description: 'identity_desc_standard', color: 'bg-blue-50 text-blue-700' }
    };
}


// --- 3. EXPORT WRAPPER (Pipeline) ---
export function scoreFlightsStrict(flights: FlightForScoring[], targetCurrency: string = "TRY"): ScoredFlight[] {
    if (flights.length === 0) return [];

    // 1. Enrich
    const processedFlights = flights.map(f => enrichFlightData(f));

    // 2. Stats
    const batchStats = calculateBatchStats(processedFlights);

    if (!batchStats) return [];

    // --- PASS 1: Calculate Max Raw Score for Curve Normalization ---
    let maxRawScore = 0;
    processedFlights.forEach(flight => {
        const raw = calculateRawScore(flight, batchStats);
        if (raw > maxRawScore) maxRawScore = raw;
    });
    // Store it in stats for reference if needed
    batchStats.maxRawScore = maxRawScore;

    // --- PASS 2: Apply Curve and Score ---
    const scoredFlights = processedFlights.map(f => scoreFlight(f, batchStats, maxRawScore));

    // 4. Sort by Decision Score (Total Score) Descending
    scoredFlights.sort((a, b) => (b.scores?.total || 0) - (a.scores?.total || 0));

    return scoredFlights;
}

// Legacy stub
export function calculateFlightScore(flight: any): FlightScoreResult {
    return { score: 7, label: 'Good', explanation: 'Legacy', breakdown: { priceScore: 0, durationScore: 0, layoverScore: 0, airlineScore: 0, penalties: [] } };
}

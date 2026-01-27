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
export function calculateRawScore(flight: FlightForScoring, stats: BatchStats): number {
    const segments = flight.segments || [];
    const mainSegment = segments.length > 0
        ? segments.reduce((prev, current) => (prev.duration > current.duration) ? prev : current)
        : null;

    const operatingCarrier = mainSegment?.carrier || flight.carrier;
    const operatingAirline = getAirlineInfo(operatingCarrier);
    const marketingAirline = getAirlineInfo(flight.carrier);

    // Eğer operasyonel havayolu LCC ise (Jetstar), Marketing (THY) olsa bile LCC muamelesi yap.
    const tier = operatingAirline.tier === 'LCC' ? 'LCC' : marketingAirline.tier;
    const isLCC = tier === 'LCC';

    const isSelfTransfer = flight.isSelfTransfer || false;
    const price = flight.effectivePrice || flight.price;

    // --- A. KALİTE AYARLI FİYAT (QUALITY ADJUSTED PRICE) ---
    // Tier 1 havayollarına %50 fiyat toleransı tanı (2000 AUD = 1333 AUD gibi)
    // Tier 2 havayollarına %25 fiyat toleransı tanı
    let adjustedPrice = price;
    if (tier === 'TIER_1') adjustedPrice = price / 1.50; // %50 indirimli gibi gör
    else if (tier === 'TIER_2') adjustedPrice = price / 1.25; // %25 indirimli gibi gör
    // LCC ise fiyat olduğu gibi kalır (İndirim yok)

    // Fiyat Skoru (0-100) - Daha yumuşak eğri
    const priceRatio = adjustedPrice / stats.minPrice;
    // Eski: 80 çarpan. Yeni: 50 çarpan (daha toleranslı)
    let priceScore = 100 - ((priceRatio - 1) * 50);
    priceScore = Math.min(100, Math.max(0, priceScore));

    // --- B. KONFOR SKORU ---
    let comfortScore = 50;
    if (tier === 'TIER_1') comfortScore += 30;
    else if (tier === 'TIER_2') comfortScore += 10;
    if (isLCC) comfortScore -= 20;

    const bagWeight = flight.baggageWeight || 0;
    if (bagWeight >= 23) comfortScore += 10;
    else if (bagWeight === 0) comfortScore -= 20;

    // --- C. ZAMAN CEZASI (REVİZE EDİLDİ) ⏳ ---
    const durationRatio = (flight.duration / stats.minDuration) - 1;

    // Daha sert ceza. %50 daha yavaşsa 30 puan silinsin.
    let timePenalty = durationRatio * 60;

    // EKSTRA: Eğer uçuş en hızlıdan 8 saat daha uzunsa ekstra ceza kes.
    if (flight.duration > stats.minDuration + 480) { // 480 dk = 8 saat
        timePenalty += 10;
    }

    // --- D. RİSK CEZASI ---
    let riskPenalty = 0;
    if (isSelfTransfer) riskPenalty += 25;
    if (flight.stops > 1) riskPenalty += 15;
    if (isLCC && flight.duration > 600) riskPenalty += 15; // Uzun yol LCC

    // --- HAM TOPLAM ---
    // Fiyat %50, Konfor %35, Süre %15
    let rawScore = (priceScore * 0.5) + (comfortScore * 0.35) - (timePenalty * 0.15) - (riskPenalty * 0.5);

    return rawScore;
}

// --- 3. NİHAİ SKORLAMA VE ETİKETLEME ---
export function scoreFlight(flight: FlightForScoring, stats: BatchStats, maxRawScore?: number): FlightForScoring {
    // Ham puanı al
    const rawScore = calculateRawScore(flight, stats);

    // --- ÇAN EĞRİSİ (CURVE GRADING) ---
    let finalScore = rawScore;
    if (maxRawScore && maxRawScore > 50) {
        const curveFactor = 9.8 / maxRawScore;
        finalScore = rawScore * curveFactor;
    } else if (maxRawScore && maxRawScore > 0) {
        finalScore = (rawScore / maxRawScore) * 7.5;
    } else {
        // Fallback or simple normalization logic if maxRawScore not provided
        // Using strict V7 logic from previous iterations
        const priceRatio = flight.price / stats.referencePrice;
        finalScore = 10 - ((priceRatio - 1) * 10); // Simplified fallback
    }

    finalScore = Math.max(1.0, Math.min(10.0, finalScore));
    finalScore = parseFloat(finalScore.toFixed(1));

    // --- DEEP FLIGHT ANALYSIS (HYBRID & SERVICE CHECK) ---
    const segments = flight.segments || [];
    let hasLongLCCLeg = false;
    let hasMixedService = false; // Hybird: LCC + Full Service
    let mealGap = false; // Long flight without meal

    // Analyze segments
    let prevTier = "";
    segments.forEach(seg => {
        const carrierInfo = getAirlineInfo(seg.carrier);
        const durationMins = seg.duration;

        // 1. Check for Mixed Service (e.g., Jetstar then Turkish)
        if (prevTier && prevTier !== carrierInfo.tier) {
            hasMixedService = true;
        }
        prevTier = carrierInfo.tier;

        // 2. Meal Gap: Long leg (>3h) with no meal
        // FIX: Use !hasMeals (boolean) instead of string check
        if (durationMins > 180 && !carrierInfo.hasMeals) {
            console.log(`[MEAL_GAP_DEBUG] Flight ${flight.id} Segment ${seg.carrier} (${durationMins}m) hasMeals=${carrierInfo.hasMeals}`);
            mealGap = true;
        }

        // 3. LCC Long Haul Detection
        if (carrierInfo.tier === 'LCC' && durationMins > 300) {
            hasLongLCCLeg = true;
        }
    });

    const airline = getAirlineInfo(flight.carrier);
    const isSelfTransfer = flight.isSelfTransfer || false;
    const isLCC = airline.tier === 'LCC';
    const isPremiumAirline = airline.tier === 'TIER_1' && !hasMixedService; // Pure premium
    const bagWeight = flight.baggageWeight || 0;

    // Correct "Has Meal" logic: Only true if NO major gaps
    const hasMeal = flight.hasMeal && !mealGap;

    const durationRatio = flight.duration / stats.minDuration;
    const priceRatio = flight.price / stats.minPrice;
    const stops = flight.stops || 0;


    // --- GENERATE PROS ---
    const pros: string[] = [];
    if (bagWeight >= 23) pros.push('pro_baggage_included');
    if (hasMeal) pros.push('pro_meal_included');
    if (isPremiumAirline) pros.push('pro_premium_airline');
    if (durationRatio <= 1.1) pros.push('pro_fast_route');
    if (priceRatio <= 1.2 && !isLCC) pros.push('pro_good_price');
    if (stops === 0) pros.push('pro_nonstop');
    if (stops === 1 && !isSelfTransfer) pros.push('pro_short_layover');

    // --- GENERATE CONS ---
    const cons: string[] = [];
    if (isSelfTransfer) cons.push('con_self_transfer');
    if (bagWeight === 0) cons.push('con_no_baggage');

    // Specific meal warning
    if (mealGap) cons.push('con_no_meal'); // "No meal on long flight"

    if (durationRatio > 1.4) cons.push('con_long_duration');
    if (priceRatio > 2.0) cons.push('con_expensive');
    if (stops > 1) cons.push('con_multiple_stops');
    if (hasLongLCCLeg) cons.push('con_lcc_longhaul'); // "Low-cost carrier on long route"

    // --- GENERATE WARNING (Pre-Regret) ---
    let warning: string | undefined;

    // --- MULTIPLICATIVE HARD PENALTIES (KIRMIZI ÇİZGİLER) ---
    let hardPenaltyMultiplier = 1.0;

    if (isSelfTransfer) {
        warning = 'warning_self_transfer';
        hardPenaltyMultiplier *= 0.70;
    } else if (hasMixedService && hasLongLCCLeg) {
        warning = 'warning_lcc_fatigue'; // "Low-cost long-haul is physically exhausting"
        hardPenaltyMultiplier *= 0.85;
    } else if (stops > 1) {
        if (durationRatio > 1.5) warning = 'warning_layover_trap';
        hardPenaltyMultiplier *= 0.75;
    } else if (isLCC && flight.duration > 600) {
        warning = 'warning_lcc_fatigue';
        hardPenaltyMultiplier *= 0.75;
    } else if (stops >= 1 && flight.duration > 1800) {
        hardPenaltyMultiplier *= 0.80;
    }

    // --- GENERATE ENHANCED SCENARIO (SIMULATION) ---
    let scenario = "";
    try {
        const depDate = new Date(flight.segments[0].departure);
        const depHour = depDate.getHours();
        const arrDate = new Date(flight.segments[flight.segments.length - 1].arrival);
        const arrHour = arrDate.getHours();

        // Bio-Time Context
        const depTimeDesc = depHour < 6 ? "Early rising" : (depHour < 12 ? "Relaxed morning start" : (depHour < 18 ? "Afternoon departure" : "Late night exit"));

        let arrTimeDesc = "";
        if (arrHour < 6) arrTimeDesc = "red-eye arrival (plan early check-in)";
        else if (arrHour < 9) arrTimeDesc = "bright & early arrival";
        else if (arrHour < 18) arrTimeDesc = "daytime arrival";
        else arrTimeDesc = "evening landing (straight to hotel)";

        // Journey Narrative
        let journeyFlow = "";
        if (hasMixedService) {
            journeyFlow = "Expect a mix of budget and full-service legs.";
        } else if (isPremiumAirline) {
            journeyFlow = "Premium service throughout.";
        } else {
            journeyFlow = stops === 0 ? "Non-stop smooth journey." : `Expect ${stops === 1 ? "one stop" : "multiple stops"} to break the trip.`;
        }

        scenario = `${depTimeDesc} ➝ ${arrTimeDesc}. ${journeyFlow}`;
    } catch (e) {
        scenario = "Standard flight itinerary.";
    }

    // --- GENERATE TRADEOFF ---
    let tradeoff: string;
    if (priceRatio <= 1.2 && durationRatio > 1.3) {
        tradeoff = 'tradeoff_money_time'; // Saves money, costs time
    } else if (priceRatio > 1.5 && durationRatio <= 1.15) {
        tradeoff = 'tradeoff_time_money'; // Saves time, costs money
    } else {
        tradeoff = 'tradeoff_balanced';
    }

    // --- APPLY HARD PENALTIES ---
    finalScore = finalScore * hardPenaltyMultiplier;
    finalScore = Math.max(1.0, Math.min(10.0, parseFloat(finalScore.toFixed(1))));

    // --- SOCIAL PROOF GENERATION ---
    const socialProof: string[] = [];
    if (isSelfTransfer) socialProof.push('social_proof_self_transfer');
    if (stops > 1 && durationRatio > 1.5) socialProof.push('social_proof_long_layover');
    if (isLCC && flight.duration > 360) socialProof.push('social_proof_lcc_longhaul');
    if (mealGap) socialProof.push('social_proof_meal_gap');

    const depHour = new Date(flight.segments[0].departure).getHours();
    if (depHour < 6 || depHour > 22) socialProof.push('social_proof_red_eye');

    // --- BADGE & DECISION ---
    let badge = 'badge_standard';
    let decision: 'recommended' | 'consider' | 'avoid' = 'consider';
    let reason = 'verdict_reason_standard';
    let headline = 'verdict_headline_consider';

    if (finalScore >= 9.0) {
        badge = 'badge_best_pick';
        decision = 'recommended';
        headline = 'verdict_headline_best';
        reason = 'verdict_reason_best_pick';
    } else if (finalScore >= 7.8) {
        badge = 'badge_hidden_gem';
        decision = 'recommended';
        headline = 'verdict_headline_good';
        reason = 'verdict_reason_value';
    } else if (finalScore >= 6.0) {
        badge = 'badge_acceptable';
        decision = 'consider';
        headline = 'verdict_headline_consider';
        reason = 'verdict_reason_acceptable';
    } else if (isSelfTransfer && flight.price < stats.minPrice * 1.1) {
        badge = 'badge_hacker';
        decision = 'consider';
        headline = 'verdict_headline_hacker';
        reason = 'verdict_reason_hacker';
    } else if (finalScore >= 5.0) {
        badge = 'badge_standard';
        decision = 'consider';
        headline = 'verdict_headline_consider';
        reason = 'verdict_reason_standard';
    } else {
        badge = 'badge_avoid';
        decision = 'avoid';
        headline = 'verdict_headline_avoid';
        reason = 'verdict_reason_avoid';
    }

    // Stres Haritası
    const stress = {
        checkIn: airline.tier === 'TIER_1' ? 'low' : 'medium',
        transfer: isSelfTransfer ? 'critical' : (stops > 1 ? 'high' : 'low'),
        baggage: bagWeight > 0 ? 'low' : 'high',
        timeline: durationRatio > 1.3 ? 'exhausting' : 'smooth'
    };

    // Identity
    let identity: FlightIdentity;
    if (finalScore >= 8.5) {
        identity = { label: 'identity_smart_choice', emoji: '🧠', description: 'identity_desc_smart', color: 'bg-emerald-100 text-emerald-700' };
    } else if (isPremiumAirline && finalScore >= 5.5) {
        identity = { label: 'identity_comfort_seeker', emoji: '😎', description: 'identity_desc_comfort', color: 'bg-purple-100 text-purple-700' };
    } else if (isLCC || (hasMixedService && hasLongLCCLeg)) {
        identity = { label: 'identity_tired_saver', emoji: '😤', description: 'identity_desc_tired', color: 'bg-amber-100 text-amber-700' };
    } else if (finalScore < 4.0) {
        identity = { label: 'identity_regret_risk', emoji: '😵', description: 'identity_desc_risk', color: 'bg-red-100 text-red-700' };
    } else {
        identity = { label: 'identity_standard', emoji: '😐', description: 'identity_desc_standard', color: 'bg-gray-100 text-gray-700' };
    }

    return {
        ...flight,
        scores: {
            total: finalScore,
            price: Math.round(priceRatio * 100),
            time: Math.round((1 / durationRatio) * 100),
            comfort: 0,
            regret: 0,
            deltaPrice: flight.price - stats.minPrice
        },
        stress: stress as any,
        identity,
        aiVerdict: {
            decision,
            badge,
            headline,
            reason,
            pros,
            cons, // Populated correctly now
            warning,
            tradeoff,
            scenario,
            socialProof
        },
        // Legacy compat
        score: finalScore,
        badge,
        analysis: {
            verdict: { badge, badgeColor: identity.color, title: badge, description: reason }
        }
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


import { FlightForScoring, FlightScoreAnalysis, FlightIdentity, StressMap, ValueTriangle } from './flightTypes';
import { BatchStats } from './flightStatistics';
import { getAirlineInfo } from './airlineDB';

// --------------------------------------------------------
// UNIVERSAL DECISION ENGINE v4.0 (Base 100 Model)
// --------------------------------------------------------

export function calculateUniversalScore(flight: FlightForScoring, stats: BatchStats): FlightScoreAnalysis {
    const { minPrice, minDuration } = stats;
    const airlineInfo = getAirlineInfo(flight.carrier);

    const price = flight.effectivePrice || flight.price;
    const duration = flight.duration;

    // --- BASE SCORE ---
    let score = 100;
    const penalties: string[] = [];
    const bonuses: string[] = [];

    // --- 1. VALUE SCORE (PRICE) ---
    // CheapestPrice = minPrice
    // PriceRatio = flight.price / minPrice
    const priceRatio = price / Math.max(1, minPrice);

    if (priceRatio <= 1.15) {
        score += 5;
        bonuses.push('Great Price');
    } else if (priceRatio > 1.15 && priceRatio <= 1.35) {
        // Neutral
    } else if (priceRatio > 1.35 && priceRatio <= 1.6) {
        score -= 5;
    } else if (priceRatio > 2.5) {
        score -= 65; // Kill it dead
        penalties.push('Extremely Overpriced');
    } else if (priceRatio > 2.0) {
        score -= 40;
        penalties.push('Very Expensive');
    } else if (priceRatio > 1.6) {
        score -= 20;
        penalties.push('Expensive');
    }

    // --- 2. TIME SCORE (DURATION) ---
    // FastestTime = minDuration
    // TimeRatio = flight.duration / minDuration
    const timeRatio = duration / Math.max(1, minDuration);

    // Disable time bonuses if paying double
    const allowBonuses = priceRatio <= 1.8;

    if (timeRatio <= 1.05 && allowBonuses) { // Super fast (closest to min)
        score += 10;
        bonuses.push('Fastest Option');
    } else if (timeRatio <= 1.15 && allowBonuses) {
        score += 5;
    } else if (timeRatio > 1.3 && timeRatio <= 1.6) {
        // Neutral to slight penalty?
    } else if (timeRatio > 1.6) {
        score -= 10;
        penalties.push('Long Duration');
    }
    if (timeRatio > 2.0) {
        score -= 20; // Heavy penalty for 2x duration
        penalties.push('Very Slow');
    }
    // Hard check: 30h+ 
    if (duration > 30 * 60) {
        score -= 15;
        penalties.push('Exhausting 30h+');
    }

    // --- 3. COMFORT & SERVICE ---
    // Baggage
    const bagWeight = flight.baggageWeight || 0;
    if (bagWeight >= 30) {
        score += 8;
        bonuses.push('Generous Baggage');
    } else if (bagWeight >= 23) {
        score += 4;
    } else if (bagWeight === 0) {
        score -= 15;
        penalties.push('No Baggage');
    }

    // Stops
    if (flight.stops === 0) {
        score += 12;
        bonuses.push('Direct Flight');
    } else if (flight.stops === 1) {
        score += 5;
    } else if (flight.stops === 2) {
        score -= 10;
        penalties.push('2 Stops');
    } else if (flight.stops >= 3) {
        score -= 25;
        penalties.push('3+ Stops');
    }

    // --- 4. RISK PENALTIES (KIRMIZI ÇİZGİLER) ---
    if (flight.isSelfTransfer) {
        score -= 30;
        penalties.push('Self-Transfer Risk');
    }

    // Short Connection (< 90 mins for international is tight)
    // Assuming layover info is checking shortest layover.
    // We need segment analysis for this. Using flags if available or basic logic.
    const hasShortLayover = (flight.layovers || []).some(l => l.duration < 90);
    if (hasShortLayover) {
        score -= 15;
        penalties.push('Tight Connection');
    }

    // Overnight Layover (Approximation: > 6h layover usually implies overnight or waste)
    const layoverTotal = flight.layoverHoursTotal || 0;
    if (layoverTotal > 8) { // User said "Overnight", usually implies long wait
        score -= 10;
        penalties.push('Long Wait');
    }

    // China Transit Risk (Mock: Check carrier or airport codes if available, or just use flag)
    // Using simple airline check for now as proxy
    if (['MU', 'CZ', 'CA'].includes(flight.carrier)) {
        // score -= 10; // Optional: China transit penalty if requested
        // penalties.push('Transit Risk');
    }

    // --- 5. SOFT BONUSES ---
    if (['TIER_1'].includes(airlineInfo.tier)) {
        score += 5;
        bonuses.push('Top Tier Airline');
    }
    // Safe Hub Bonus (Simple check)
    const safeHubs = ['DOH', 'DXB', 'SIN', 'IST'];
    const hasSafeHub = (flight.layovers || []).some(l => safeHubs.includes(l.airport));
    if (hasSafeHub) {
        score += 5;
        bonuses.push('Premium Hub');
    }

    // --- FINAL CALCULATION ---
    // Clamp to 0-100
    // Normalize to 1.0 - 10.0
    // 0 -> 1.0
    // 100 -> 10.0

    let finalScore = Math.max(0, Math.min(100, score));
    finalScore = Math.max(1, finalScore / 10); // Scale to 1.0 - 10.0
    finalScore = parseFloat(finalScore.toFixed(1));

    // --- REGRET SCORE ---
    // 0 = No Regret, 100 = High Regret
    let regretScore = 0;
    if (flight.isSelfTransfer) regretScore += 50;
    if (flight.stops > 1) regretScore += 20;
    if (timeRatio > 1.5) regretScore += 15;
    if (bagWeight === 0) regretScore += 15;
    regretScore = Math.min(100, regretScore);

    // --- DECISION SCORE (Ranking) ---
    // Decision = FinalScore - Risk Factor
    const decisionScore = parseFloat((finalScore - (regretScore / 50)).toFixed(2));

    // --- COMPONENT SCORES (For Sliders/UI) ---
    // Re-calculate normalized scores for UI components (0-100 scale)
    const priceDelta = Math.max(1, stats.maxPrice - minPrice);
    const durationDelta = Math.max(1, stats.maxDuration - minDuration);

    const normPrice = Math.max(0, Math.min(100, 100 * (stats.maxPrice - price) / priceDelta));
    const normDuration = Math.max(0, Math.min(100, 100 * (stats.maxDuration - duration) / durationDelta));

    // Mental Score Proxy
    let mentalScore = 100;
    if (flight.stops > 1) mentalScore -= 20;
    if (layoverTotal > 6) mentalScore -= 15;
    if (flight.isSelfTransfer) mentalScore -= 30;
    mentalScore = Math.max(0, mentalScore);

    // Service Score Proxy
    let serviceScore = 50;
    if (airlineInfo.tier === 'TIER_1') serviceScore = 90;
    else if (airlineInfo.tier === 'TIER_2') serviceScore = 70;
    else serviceScore = 40;
    if (bagWeight > 0) serviceScore += 10;
    serviceScore = Math.min(100, serviceScore);

    // --- HUMAN IDENTITY ---
    let identity: FlightIdentity = {
        label: 'Standart Yolcu',
        // sentiment: 'neutral', -> Mapped to color
        color: 'bg-gray-100 text-gray-700',
        emoji: '😐',
        description: 'Özellik yok, sadece ulaşım.'
    };

    if (finalScore >= 8.0 && regretScore < 20) {
        identity = { label: 'Sorunsuz Yolcu', color: 'bg-emerald-100 text-emerald-700', emoji: '😌', description: 'Kafanız rahat, yolculuk akıp gidecek.' };
    } else if (flight.isSelfTransfer && price < minPrice * 1.1) {
        identity = { label: 'Risk Alan', color: 'bg-amber-100 text-amber-700', emoji: '🤡', description: 'Paradan kazandınız ama risk aldınız.' };
    } else if (layoverTotal > 10 || flight.stops > 2) {
        identity = { label: 'Aktarma Mağduru', color: 'bg-red-100 text-red-700', emoji: '😵', description: 'Bu yolculuk sizi yoracak.' };
    } else if (airlineInfo.tier === 'TIER_1' && price > minPrice * 1.2) {
        identity = { label: 'Konfor Düşkünü', color: 'bg-purple-100 text-purple-700', emoji: '😎', description: 'Para ikinci planda, rahatlık önemli.' };
    }

    // --- STRESS MAP ---
    const stress: StressMap = {
        checkIn: flight.isSelfTransfer ? 'high' : 'low',
        layover: layoverTotal > 6 ? 'high' : (layoverTotal > 3 ? 'medium' : 'low'),
        baggage: bagWeight === 0 ? 'high' : 'low',
        reliability: airlineInfo.tier === 'LCC' ? 'medium' : 'low',
        totalScore: Math.ceil(regretScore / 10)
    };

    // --- COMPARATIVE LOSS (Value Triangle) ---
    // Money Lost vs Cheapest
    const moneyDelta = price - minPrice;
    // Time Lost vs Fastest (in hours)
    const timeDelta = (duration - minDuration) / 60;

    const value: ValueTriangle = {
        money: moneyDelta <= 0 ? 'gain' : (moneyDelta / minPrice < 0.2 ? 'neutral' : 'loss'),
        time: timeDelta <= 0 ? 'gain' : (timeDelta < 3 ? 'neutral' : 'loss'),
        comfort: score > 70 ? 'gain' : 'loss',
        summary: ''
    };

    // Generate Summary
    if (value.money === 'gain' && value.time === 'loss') {
        value.summary = `$${moneyDelta.toFixed(0)} cepte kalır, ${timeDelta.toFixed(1)} saat hayat gider.`;
    } else if (value.money === 'loss' && value.time === 'gain') {
        value.summary = `${Math.abs(timeDelta).toFixed(1)} saat kazanılır, $${moneyDelta.toFixed(0)} ödenir.`;
    } else if (value.money === 'gain' && value.time === 'gain') {
        value.summary = "Hem paranız cebinizde hem zamanınız.";
    } else {
        value.summary = "Standart bir tercih.";
    }

    return {
        score: finalScore,
        decisionScore,
        regretScore,
        penalties,
        bonuses,
        identity,
        stress,
        value,
        components: {
            priceScore: normPrice,
            timeScore: normDuration,
            comfortScore: Math.round((mentalScore + serviceScore) / 2)
        }
    };
}

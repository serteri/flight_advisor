
import { FlightForScoring, FlightScoreAnalysis } from './flightTypes';
import { getAirlineInfo } from './airlineDB';

export interface OracleAnalysis {
    badge: string;
    badgeColor: string;
    title: string;
    description: string;
    pros: string[];
    cons: string[];
    // GEN 3.1: Human Layer Attributes
    identityLabel?: string;
    identityIcon?: string;
    valueStatement?: string;

    // NEW: Recommendation Copy
    recommendation?: {
        weWouldPickThis: boolean;
        expertCopy: string;
        reasoning: string;
    };

    // NEW 3.2: Scenario & Warning
    scenario?: {
        timeline: { time: string; event: string; mood: string; icon: string }[];
        summary: string;
    };
    warning?: string; // Pre-regret warning
    socialProof?: {
        rebookPct: number;
        betterChoicePct: number;
        regretPct: number;
    };
}

function getHour(isoString: string): number {
    return new Date(isoString).getHours();
}

export function generateOracleAnalysis(
    flight: FlightForScoring,
    minPrice: number,
    fastestDuration: number,
    consultantResult?: FlightScoreAnalysis,
    isBestPick?: boolean
): OracleAnalysis {

    const price = flight.effectivePrice || flight.price;
    const airlineInfo = getAirlineInfo(flight.carrier);

    // Defaults from consultantResult if available
    const finalScore = consultantResult?.score || 0;
    const identity = consultantResult?.identity;
    const value = consultantResult?.value;
    const regretScore = consultantResult?.regretScore || 0;

    // Default Analysis
    let analysis: OracleAnalysis = {
        badge: 'priceOracle.oracle.badge_standard',
        badgeColor: 'bg-gray-100 text-gray-700',
        title: 'priceOracle.oracle.title_standard',
        description: 'priceOracle.oracle.desc_standard',
        pros: [],
        cons: [],
        identityLabel: identity?.label,
        identityIcon: identity?.emoji,
        valueStatement: value?.summary,
        recommendation: undefined,
        scenario: { timeline: [], summary: '' },
        warning: undefined
    };

    // --- 1. VERDICT BADGES (Decision Outsourcing) ---
    if (isBestPick) {
        analysis.badge = 'priceOracle.oracle.badge_best_pick';
        analysis.badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
        analysis.title = 'priceOracle.oracle.title_best_pick';
        analysis.description = identity?.description || 'priceOracle.oracle.desc_best_pick';
    }
    else if (finalScore >= 8.5) {
        analysis.badge = 'priceOracle.oracle.badge_hidden_gem';
        analysis.badgeColor = 'bg-teal-100 text-teal-800 border-teal-200';
        analysis.title = 'priceOracle.oracle.title_rare'; // Using existing generic title or new specific? Generic is fine for Hidden Gem.
        analysis.description = 'priceOracle.oracle.desc_rare';
    }
    else if (finalScore >= 7.0) {
        analysis.badge = 'priceOracle.oracle.badge_acceptable';
        analysis.badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
        analysis.title = 'priceOracle.oracle.title_acceptable';
        analysis.description = 'priceOracle.oracle.desc_acceptable';
    }
    else if (finalScore >= 6.0) {
        analysis.badge = 'priceOracle.oracle.badge_risky';
        analysis.badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
        analysis.title = 'priceOracle.oracle.title_risky';
        analysis.description = value?.summary || 'priceOracle.oracle.desc_risky';
    }
    else {
        analysis.badge = 'priceOracle.oracle.badge_avoid';
        analysis.badgeColor = 'bg-red-50 text-red-700 border-red-200';
        analysis.title = 'priceOracle.oracle.title_avoid';
        analysis.description = 'priceOracle.oracle.desc_avoid';
    }

    // --- 2. EXPERT RECOMMENDATION ---
    if (isBestPick) {
        analysis.recommendation = {
            weWouldPickThis: true,
            expertCopy: "Biz olsak bunu alırdık.",
            reasoning: value?.summary || "Çünkü aktarma süresi ideal, fiyat makul ve riskleri düşük."
        };
        analysis.pros.push('priceOracle.oracle.pro_comfort_win');
    } else if (finalScore < 5) {
        analysis.recommendation = {
            weWouldPickThis: false,
            expertCopy: "Biz olsak bunu almazdık.",
            reasoning: "Çünkü bu uçuşun stresi fiyat avantajına değmez."
        };
    }

    // --- 3. SCENARIO SIMULATION (Mini-Narrative) ---
    if (flight.segments && flight.segments.length > 0) {
        const firstSeg = flight.segments[0];
        const lastSeg = flight.segments[flight.segments.length - 1];

        // Departure
        const depHour = getHour(firstSeg.departure);
        const depMood = depHour < 6 ? "Uykulu kalkış" : (depHour < 12 ? "Sabah enerjisi" : (depHour < 18 ? "Gün ortası" : "Gece yolculuğu"));
        analysis.scenario?.timeline.push({ time: firstSeg.departure.split('T')[1].slice(0, 5), event: 'Kalkış', mood: depMood, icon: '🛫' });

        // Arrival
        const arrHour = getHour(lastSeg.arrival);
        const arrMood = arrHour < 6 ? "Zorlu varış" : (arrHour < 12 ? "Güne başlama" : "Akşam varışı");
        analysis.scenario?.timeline.push({ time: lastSeg.arrival.split('T')[1].slice(0, 5), event: 'Varış', mood: arrMood, icon: '🛬' });

        analysis.scenario!.summary = `Yolculuk ${depMood.toLowerCase()} ile başlar, ${arrMood.toLowerCase()} ile biter.`;
    }

    // --- 4. PRE-REGRET WARNING ---
    if (regretScore > 60) {
        if (flight.isSelfTransfer) analysis.warning = "⚠️ Dikkat: Bu uçuşta bagajınızı kendiniz alıp tekrar vermeniz gerekecek.";
        else if ((flight.layoverHoursTotal || 0) > 10) analysis.warning = "⚠️ Uyarı: Bu uçuşu seçenler genelde bekleme süresinden sıkılıyor.";
        else if (consultantResult?.stress.reliability === 'medium') analysis.warning = "⚠️ Hatırlatma: Bu havayolu hizmetlerinde kısıtlamalar olabilir (LCC).";
    }

    // --- 5. SOCIAL PROOF (Simulated) ---
    // % Rebook = Correlated with High Score
    // % Imagine Better = Correlated with regret
    const rebookRaw = Math.min(98, Math.max(40, finalScore * 10 + (isBestPick ? 10 : 0)));
    const regretRaw = Math.min(50, Math.max(2, regretScore / 2));
    const betterRaw = 100 - rebookRaw - regretRaw;

    analysis.socialProof = {
        rebookPct: Math.round(rebookRaw), // "%68 Tekrar Alırım"
        betterChoicePct: Math.round(betterRaw < 0 ? 0 : betterRaw), // "%22 Keşke daha hızlısını alsaydım"
        regretPct: Math.round(regretRaw) // "%10 Pişman oldum"
    };

    return analysis;
}

// services/agents/connectionGuard.ts
/**
 * 🛡️ Connection Guard (Canavar #8 - Elite)
 * 
 * Protects travelers from missed connections by analyzing:
 * - Walking distance between gates
 * - Security/immigration queue times
 * - Historical on-time performance
 * - Minimum connection time (MCT) vs actual time
 */

export interface ConnectionRisk {
    level: 'SAFE' | 'TIGHT' | 'RISKY' | 'DANGEROUS';
    score: number; // 0-100 (100 = perfectly safe)
    reason: string;
    recommendations: string[];
}

export interface AirportTransitData {
    // Physical Layout
    walkingDistanceMeters: number;
    walkingTimeMinutes: number;
    requiresTerminalChange: boolean;
    requiresAirTrain: boolean;

    // Security
    requiresSecurityRecheck: boolean;
    requiresImmigration: boolean;
    avgSecurityWaitMinutes: number;
    avgImmigrationWaitMinutes: number;

    // Gates
    arrivalGate?: string;
    departureGate?: string;
    gateDistance?: string; // "500m" or "Terminal 2 → Terminal 3"
}

export interface ConnectionAnalysis {
    connectionTime: number; // minutes between arrival and departure
    minimumConnectionTime: number; // MCT for this airport
    bufferTime: number; // Extra time beyond MCT

    transitData: AirportTransitData;
    risk: ConnectionRisk;

    // Alternatives
    suggestedEarlierFlight?: string;
    suggestedLongerLayover?: string;
}

/**
 * Analyzes connection feasibility at an airport
 */
export function analyzeConnection(
    arrivalFlight: {
        arrivalTime: string;
        arrivalAirport: string;
        arrivalTerminal?: string;
        carrier: string;
    },
    departureFlight: {
        departureTime: string;
        departureAirport: string;
        departureTerminal?: string;
        carrier: string;
        boardingCloseMinutes?: number; // How many mins before departure boarding closes
    },
    passengerProfile?: {
        hasCheckedBags: boolean;
        requiresVisa: boolean;
        mobility: 'STANDARD' | 'REDUCED';
    }
): ConnectionAnalysis {

    // 1. Calculate connection time
    const arrivalTime = new Date(arrivalFlight.arrivalTime);
    const departureTime = new Date(departureFlight.departureTime);
    const connectionMinutes = Math.round((departureTime.getTime() - arrivalTime.getTime()) / (1000 * 60));

    // 2. Get airport-specific data
    const transitData = getAirportTransitData(
        arrivalFlight.arrivalAirport,
        arrivalFlight.arrivalTerminal,
        departureFlight.departureTerminal,
        arrivalFlight.carrier,
        departureFlight.carrier
    );

    // 3. Get MCT (Minimum Connection Time)
    const mct = getMinimumConnectionTime(
        arrivalFlight.arrivalAirport,
        arrivalFlight.carrier === departureFlight.carrier, // same airline?
        transitData.requiresTerminalChange
    );

    // 4. Calculate required time
    const boardingClose = departureFlight.boardingCloseMinutes || 20;
    const requiredTime =
        transitData.walkingTimeMinutes +
        (transitData.requiresSecurityRecheck ? transitData.avgSecurityWaitMinutes : 0) +
        (transitData.requiresImmigration ? transitData.avgImmigrationWaitMinutes : 0) +
        (passengerProfile?.hasCheckedBags ? 10 : 0) + // Bag collection buffer
        boardingClose + // Boarding gate closure
        5; // General buffer

    // 5. Risk assessment
    const bufferTime = connectionMinutes - requiredTime;
    const risk = assessConnectionRisk(connectionMinutes, mct, bufferTime, transitData, passengerProfile);

    return {
        connectionTime: connectionMinutes,
        minimumConnectionTime: mct,
        bufferTime,
        transitData,
        risk
    };
}

/**
 * Assess connection risk level
 */
function assessConnectionRisk(
    connectionMinutes: number,
    mct: number,
    bufferTime: number,
    transit: AirportTransitData,
    profile?: any
): ConnectionRisk {

    const recommendations: string[] = [];
    let score = 100;
    let level: ConnectionRisk['level'] = 'SAFE';
    let reason = '';

    // Below MCT = DANGEROUS
    if (connectionMinutes < mct) {
        level = 'DANGEROUS';
        score = 20;
        reason = `⛔ Connection time (${connectionMinutes}min) is BELOW minimum (${mct}min)!`;
        recommendations.push('🚨 BOOK DIFFERENT FLIGHT - This connection is illegal by airport rules');
        recommendations.push('If flights delayed, airline not liable for missed connection');
    }

    // MCT to MCT+30 = RISKY
    else if (bufferTime < 30) {
        level = 'RISKY';
        score = 50;
        reason = `⚠️ Only ${bufferTime}min buffer beyond MCT`;
        recommendations.push('💨 Run immediately upon landing - no bathroom breaks');
        recommendations.push('📍 Check gate location while in-flight');
        recommendations.push('🎒 Carry-on only if possible');
        if (transit.requiresTerminalChange) {
            recommendations.push('🚇 Terminal change required - follow signs for fastest route');
        }
    }

    // MCT+30 to MCT+60 = TIGHT
    else if (bufferTime < 60) {
        level = 'TIGHT';
        score = 70;
        reason = `⏱️ Tight but doable - ${bufferTime}min buffer`;
        recommendations.push('🚶 Walk briskly upon arrival');
        recommendations.push('📱 Download airport map beforehand');
        if (transit.requiresImmigration) {
            recommendations.push('📝 Fill out immigration form in-flight');
        }
    }

    // MCT+60+ = SAFE
    else {
        level = 'SAFE';
        score = 90;
        reason = `✅ Comfortable ${bufferTime}min buffer`;
        recommendations.push('☕ Time for coffee/bathroom');
        if (transit.walkingDistanceMeters > 800) {
            recommendations.push('🚶 Long walk ahead - pace yourself');
        }
    }

    // Additional warnings
    if (transit.requiresAirTrain) {
        score -= 5;
        recommendations.push('🚆 Air train required - wait times vary (5-15min)');
    }

    if (transit.avgSecurityWaitMinutes > 20) {
        score -= 10;
        recommendations.push(`🛂 Security queue averaging ${transit.avgSecurityWaitMinutes}min - factor this in`);
    }

    return {
        level,
        score: Math.max(0, Math.min(100, score)),
        reason,
        recommendations
    };
}

/**
 * Get airport-specific transit data
 */
function getAirportTransitData(
    airportCode: string,
    arrivalTerminal?: string,
    departureTerminal?: string,
    arrivalCarrier?: string,
    departureCarrier?: string
): AirportTransitData {

    // Airport-specific rules database
    const airportData: Record<string, any> = {
        // Istanbul Airport (IST)
        'IST': {
            domestic: {
                walkingTime: 15,
                requiresSecurity: false,
                requiresImmigration: false,
                avgSecurityWait: 0,
                avgImmigrationWait: 0
            },
            international: {
                walkingTime: 25,
                requiresSecurity: true,
                requiresImmigration: true,
                avgSecurityWait: 15,
                avgImmigrationWait: 20
            }
        },

        // Singapore Changi (SIN)
        'SIN': {
            domestic: { walkingTime: 10, requiresSecurity: false, requiresImmigration: false, avgSecurityWait: 0, avgImmigrationWait: 0 },
            international: { walkingTime: 20, requiresSecurity: true, requiresImmigration: true, avgSecurityWait: 10, avgImmigrationWait: 15 }
        },

        // London Heathrow (LHR)
        'LHR': {
            sameTerminal: { walkingTime: 15, requiresSecurity: false, requiresImmigration: false, avgSecurityWait: 0, avgImmigrationWait: 0 },
            differentTerminal: { walkingTime: 35, requiresSecurity: true, requiresImmigration: true, avgSecurityWait: 25, avgImmigrationWait: 30, requiresAirTrain: true }
        }
    };

    const airport = airportData[airportCode] || {
        international: { walkingTime: 20, requiresSecurity: true, requiresImmigration: true, avgSecurityWait: 20, avgImmigrationWait: 25 }
    };

    const scenario = arrivalTerminal !== departureTerminal ? 'differentTerminal' : 'international';
    const data = airport[scenario] || airport.international;

    return {
        walkingDistanceMeters: data.walkingTime * 80, // Rough estimate
        walkingTimeMinutes: data.walkingTime,
        requiresTerminalChange: arrivalTerminal !== departureTerminal,
        requiresAirTrain: data.requiresAirTrain || false,
        requiresSecurityRecheck: data.requiresSecurity,
        requiresImmigration: data.requiresImmigration,
        avgSecurityWaitMinutes: data.avgSecurityWait,
        avgImmigrationWaitMinutes: data.avgImmigrationWait,
        arrivalGate: undefined,
        departureGate: undefined
    };
}

/**
 * Get Minimum Connection Time for airport
 */
function getMinimumConnectionTime(
    airportCode: string,
    sameAirline: boolean,
    terminalChange: boolean
): number {
    // IATA-published MCTs
    const mctDatabase: Record<string, { domestic: number; international: number; terminalChange: number }> = {
        'IST': { domestic: 45, international: 60, terminalChange: 90 },
        'SIN': { domestic: 45, international: 50, terminalChange: 75 },
        'LHR': { domestic: 60, international: 75, terminalChange: 90 },
        'DXB': { domestic: 60, international: 75, terminalChange: 120 },
        'AMS': { domestic: 40, international: 50, terminalChange: 60 },
        'FRA': { domestic: 45, international: 60, terminalChange: 60 }
    };

    const airport = mctDatabase[airportCode] || { domestic: 60, international: 75, terminalChange: 90 };

    if (terminalChange) return airport.terminalChange;
    if (sameAirline) return airport.domestic;
    return airport.international;
}

/**
 * STRICT Flight Scoring V1
 *
 * This module re-exports from flightScoreEngine for backward compatibility.
 * All scoring logic is now centralized in flightScoreEngine.ts
 */

export {
    scoreFlightsStrict,
    calculateFlightScore,
    type FlightScoreResult,
    type FlightForScoring
} from "./flightScoreEngine";

// Legacy interface for backward compatibility
export interface RawFlight {
    id: string;
    price: number;
    currency: string;
    duration: number; // minutes
    stops: number;
    carrier: string;
    carrierName: string;
    layoverHoursTotal?: number;
}

export interface ScoredFlight extends RawFlight {
    score: number;
    explanation: string;
}

/**
 * Legacy function - now uses strict scoring internally
 * @deprecated Use scoreFlightsStrict from flightScoreEngine instead
 */
export function scoreFlights(flights: RawFlight[]): ScoredFlight[] {
    // Import and use strict scoring
    const { scoreFlightsStrict } = require("./flightScoreEngine");

    // Convert to FlightForScoring format
    const flightsForScoring = flights.map(f => ({
        ...f,
        layoverHoursTotal: f.layoverHoursTotal || 0
    }));

    return scoreFlightsStrict(flightsForScoring);
}

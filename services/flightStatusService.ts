/**
 * Legacy flight-status facade (used by /api/flights/inspect).
 *
 * All AeroDataBox access goes through lib/flightData/client.ts, which applies
 * mock/live selection and the monthly quota policy. This wrapper only adapts
 * the normalized result to the older FlightStatus shape.
 */

import { lookupFlight } from '@/lib/flightData/client';
import { arrivalDelayMinutes } from '@/lib/flightData/aerodatabox';

export interface FlightStatus {
    flightNumber: string;
    airline: string;
    date: string; // YYYY-MM-DD
    status: 'scheduled' | 'active' | 'landed' | 'cancelled' | 'diverted' | 'unknown';
    origin: string | null;
    destination: string | null;
    scheduledDeparture: string | null; // ISO (UTC)
    actualDeparture?: string;
    departureGate?: string;
    departureTerminal?: string;
    scheduledArrival: string | null;
    actualArrival?: string;
    estimatedArrival?: string;
    arrivalGate?: string;
    arrivalTerminal?: string;
    arrivalDelayMinutes?: number;
    aircraft?: { model?: string };
    source: 'LIVE' | 'MOCK';
}

export interface FlightStatusError {
    error: true;
    message: string;
    code?: string;
}

export async function getFlightStatus(
    flightNumber: string,
    date: string,
): Promise<FlightStatus | FlightStatusError> {
    const result = await lookupFlight(flightNumber, date, 'REGISTRATION');
    if (!result.ok) {
        return { error: true, message: result.message, code: result.code };
    }

    const f = result.flight;
    const delay = arrivalDelayMinutes(f);
    return {
        flightNumber: f.flightNumber,
        airline: f.airlineIata || f.flightNumber.slice(0, 2),
        date: f.date,
        status: f.status,
        origin: f.origin.iata,
        destination: f.destination.iata,
        scheduledDeparture: f.scheduledDepartureUtc,
        actualDeparture: f.runwayDepartureUtc || f.revisedDepartureUtc || undefined,
        departureGate: f.departureGate || undefined,
        departureTerminal: f.departureTerminal || undefined,
        scheduledArrival: f.scheduledArrivalUtc,
        actualArrival: f.status === 'landed' ? f.revisedArrivalUtc || f.runwayArrivalUtc || undefined : undefined,
        estimatedArrival: f.predictedArrivalUtc || f.revisedArrivalUtc || undefined,
        arrivalGate: f.arrivalGate || undefined,
        arrivalTerminal: f.arrivalTerminal || undefined,
        arrivalDelayMinutes: delay ?? undefined,
        aircraft: f.aircraftModel ? { model: f.aircraftModel } : undefined,
        source: f.source,
    };
}

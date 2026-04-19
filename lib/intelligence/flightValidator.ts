import type { UnifiedFlight } from '@/types/unifiedFlight';
import { safeLog } from '@/lib/observability/logger';

const isValidIsoDate = (dateStr: string | null | undefined): boolean => {
    if (!dateStr) return false;
    const timestamp = Date.parse(dateStr);
    return !Number.isNaN(timestamp);
};

export const validateUnifiedFlight = (flight: UnifiedFlight): boolean => {
    try {
        if (!flight) return false;

        // 1. Check ID
        if (!flight.id) {
            safeLog('VALIDATION', `Flight missing ID`, { flight });
            return false;
        }

        // 2. Check source validity (must be one of the known providers)
        const validSources = ['duffel', 'kiwi', 'rapidapi', 'priceline'];
        const normalizedSource = flight.source?.toLowerCase().trim();
        if (!validSources.includes(normalizedSource)) {
            safeLog('VALIDATION', `Invalid or missing source: ${flight.source} for flight ${flight.id}`);
            return false;
        }

        // 3. Price must be positive
        if (typeof flight.price !== 'number' || flight.price <= 0) {
            safeLog('VALIDATION', `Invalid price: ${flight.price} for flight ${flight.id}`);
            return false;
        }

        // 4. from/to MUST be present
        if (!flight.from || !flight.to) {
            safeLog('VALIDATION', `Missing origin or destination for flight ${flight.id}`);
            return false;
        }

        // 5. Check departure and arrival dates for validity
        if (!isValidIsoDate(flight.departureTime)) {
            safeLog('VALIDATION', `Invalid localIso departure time: ${flight.departureTime} for flight ${flight.id}`);
            return false;
        }
        
        if (!isValidIsoDate(flight.arrivalTime)) {
            safeLog('VALIDATION', `Invalid localIso arrival time: ${flight.arrivalTime} for flight ${flight.id}`);
            return false;
        }

        // 6. Segments non-empty
        if (!Array.isArray(flight.segments) || flight.segments.length === 0) {
            safeLog('VALIDATION', `Segments empty or invalid format for flight ${flight.id}`);
            return false;
        }

        return true;
    } catch (e) {
        safeLog('VALIDATION', `Exception during validation evaluation: ${e}`);
        return false;
    }
};

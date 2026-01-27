
import { FlightForScoring } from './flightTypes';
import { getAirlineInfo } from './airlineDB';

export function enrichFlightData(flight: FlightForScoring): FlightForScoring {
    const carrier = flight.carrier || (flight.airlineCode ? flight.airlineCode.split(' ')[0] : 'XX');
    const airlineInfo = getAirlineInfo(carrier);

    // Safety check for attributes or create default
    const isSelfTransfer = flight.isSelfTransfer || flight.attributes?.selfTransfer || false;
    const isLCC = airlineInfo.tier === 'LCC';

    // 1. Baggage Weight Normalization
    // Use enriched baggageWeight if present, or infer from older fields
    let baggageWeight = flight.baggageWeight || 0;

    // TIER_1 or Included baggage assumption if not strictly 0 from source
    if (!isSelfTransfer && (airlineInfo.hasFreeBag || airlineInfo.tier === 'TIER_1')) {
        // Only upgrade if currently 0 and source didn't explicitly say "0kg" (checked via existence usually)
        // For safe fallback, if 0 and Tier 1, assume 23kg.
        if (baggageWeight === 0) baggageWeight = 23;
    }

    // 2. Meal Status
    const hasMeal = flight.amenities?.hasMeals || airlineInfo.hasMeals;

    // 3. Effective Price (Hidden Costs)
    let effectivePrice = flight.price;

    // Baggage Penalty cost
    if (baggageWeight === 0) effectivePrice += 80; // Adjusted from 140 to 80 (approx 25-30 EUR per bag equivalent)
    // Meal Penalty cost
    if (!hasMeal) effectivePrice += 20; // Adjusted from 40
    // Self Transfer Risk cost (Monetary value of stress)
    if (isSelfTransfer) effectivePrice += 150;

    // 4. Overnight Logic
    // Simple check: Arrives next day? or just late arrival?
    // Let's assume overnight if duration > 8h or arrives +1 day. 
    // flight.isOvernight = ... (Not critical for now)

    return {
        ...flight,
        effectivePrice,
        baggageWeight,
        hasMeal,
        isSelfTransfer,
        isLCC,
        // Ensure amenities object exists
        amenities: {
            ...flight.amenities,
            hasMeals: hasMeal,
            hasEntertainment: flight.amenities?.hasEntertainment || false,
            tier: airlineInfo.tier as any
        }
    };
}

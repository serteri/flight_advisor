/**
 * INTEGRATION GUIDE: Historical Radar + Seat Maps
 * 
 * How to use the new real-data modules in your flight search flow
 */

// ============================================
// EXAMPLE 1: Search Provider Integration
// ============================================

// In services/search/providers/duffel.ts or your search service:

import { getHistoricalFlightPerformance } from '@/services/flightStatusService';
import { getDuffelSeatMap } from '@/services/duffelSeatMapsService';

export async function searchDuffelWithRealData(params: HybridSearchParams): Promise<FlightResult[]> {
    // 1. Get initial flight offers from Duffel
    const offers = await duffel.offerRequests.create({ /* ... */ });
    
    const flights = offers.data.offers.map(mapDuffelToPremiumAgent);
    
    // 2. ENHANCEMENT: Fetch real historical data for each flight
    // (Run in background to not block initial results)
    setTimeout(async () => {
        for (const flight of flights) {
            try {
                // Historical Radar: Get past 10 days of flight performance
                const history = await getHistoricalFlightPerformance(flight.flightNumber);
                flight.historicalPerformance = history; // Add to flight object
                
                // Seat Maps: Get actual seat availability
                const seats = await getDuffelSeatMap(flight.offerId, flight.airline);
                flight.seatMapData = seats; // Add to flight object
                
                console.log(`✅ Enhanced ${flight.flightNumber} with real data`);
            } catch (error) {
                // Graceful degradation: Missing enhancements won't break search
                console.warn(`⚠️ Could not enhance ${flight.flightNumber}:`, error);
            }
        }
    }, 0); // Non-blocking
    
    return flights;
}

// ============================================
// EXAMPLE 2: FlightResultCard Props
// ============================================

// Type definition for flight object with enhancements:
interface EnhancedFlightResult extends FlightResult {
    // NEW: Real data fields
    historicalPerformance?: HistoricalPerformance | FlightStatusError | null;
    seatMapData?: SeatMapData | SeatMapError | null;
}

// Usage in component:
<FlightResultCard 
    flight={enhancedFlight} // Now includes real data
    userTier="PRO"
/>

// ============================================
// EXAMPLE 3: Batch Enhancement (Search Results Page)
// ============================================

import { getDuffelSeatMapsBatch } from '@/services/duffelSeatMapsService';

export async function enhanceSearchResultsBatch(flights: FlightResult[]): Promise<EnhancedFlightResult[]> {
    // 1. Prepare seat map batch requests
    const seatMapRequests = flights.map(f => ({
        offerId: f.offerId,
        airlineName: f.airline
    }));
    
    // 2. Fetch all seat maps concurrently (max 3 at a time)
    const seatMapResults = await getDuffelSeatMapsBatch(seatMapRequests);
    
    // 3. Fetch historical data concurrently
    const historicalRequests = flights.map(f => 
        getHistoricalFlightPerformance(f.flightNumber)
    );
    const historicalResults = await Promise.all(historicalRequests);
    
    // 4. Merge results back into flight objects
    const enhanced: EnhancedFlightResult[] = flights.map((flight, idx) => ({
        ...flight,
        seatMapData: seatMapResults.get(flight.offerId),
        historicalPerformance: historicalResults[idx]
    }));
    
    console.log(`✅ Enhanced ${enhanced.length} flights with real data`);
    return enhanced;
}

// ============================================
// EXAMPLE 4: Error Handling in UI
// ============================================

export function FlightCardWithErrors({ flight, userTier }) {
    const hasPremiumAccess = userTier === 'PRO' || userTier === 'ELITE';
    
    return (
        <div>
            {/* Check for errors and display gracefully */}
            
            {/* Delay History */}
            {hasPremiumAccess && flight.historicalPerformance && (
                <>
                    {flight.historicalPerformance.error ? (
                        <div className="text-gray-500 text-sm">
                            ℹ️ {flight.historicalPerformance.message}
                        </div>
                    ) : (
                        <div className={`text-sm font-bold px-2 py-1 rounded ${
                            flight.historicalPerformance.risk === 'HIGH' 
                                ? 'bg-red-100 text-red-700'
                                : 'bg-green-100 text-green-700'
                        }`}>
                            {flight.historicalPerformance.delayProbability}% Delay Risk
                        </div>
                    )}
                </>
            )}
            
            {/* Seat Availability */}
            {hasPremiumAccess && flight.seatMapData && (
                <>
                    {flight.seatMapData.error ? (
                        <div className="text-gray-500 text-sm">
                            ℹ️ {flight.seatMapData.message}
                        </div>
                    ) : (
                        <div className="text-sm font-bold px-2 py-1 rounded bg-green-100 text-green-700">
                            🟢 {flight.seatMapData.availableSeats} seats
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ============================================
// EXAMPLE 5: Server Action Integration
// ============================================

// In app/actions/submit-search.ts:

import { getHistoricalFlightPerformance } from '@/services/flightStatusService';

export async function submitSearch(formData: SearchParams) {
    // 1. Search flights (fast)
    const flights = await searchFlights(formData);
    
    // 2. Enhance with real data (background)
    // Don't await - return results immediately, enhance in background
    flights.forEach(async (flight) => {
        try {
            const history = await getHistoricalFlightPerformance(flight.flightNumber);
            // Update flight in cache/DB with history
            await cache.put(`flight-history-${flight.flightNumber}`, history, 3600); // 1 hour cache
        } catch (error) {
            console.warn('Historical radar failed:', error);
            // Continue - missing enhancement doesn't break anything
        }
    });
    
    return flights; // Return immediately, enhancements come via background
}

// ============================================
// EXAMPLE 6: Caching Strategy
// ============================================

import { unstable_cache } from 'next/cache';

// Cache historical performance for 24 hours
// (Same flight, same day = same stats)
const getCachedHistoricalPerformance = unstable_cache(
    async (flightNumber: string) => {
        return await getHistoricalFlightPerformance(flightNumber);
    },
    ['historical-perf'], // Cache key namespace
    { revalidate: 86400 } // 24 hours
);

// Usage:
const performanceHistory = await getCachedHistoricalPerformance('TK15');

// ============================================
// EXAMPLE 7: Monitoring & Logging
// ============================================

// Add to your monitoring/logging service:

async function logRealDataEnrichment(flight: FlightResult) {
    const timestamp = new Date().toISOString();
    
    if (flight.historicalPerformance && !flight.historicalPerformance.error) {
        console.log(`[ENRICHMENT] ${timestamp} ${flight.flightNumber} → Delay: ${flight.historicalPerformance.delayProbability}%`);
    }
    
    if (flight.seatMapData && !flight.seatMapData.error) {
        console.log(`[ENRICHMENT] ${timestamp} ${flight.flightNumber} → Seats: ${flight.seatMapData.availableSeats}/${flight.seatMapData.totalSeats}`);
    }
    
    if (flight.historicalPerformance?.error) {
        console.warn(`[ENRICHMENT-ERROR] ${timestamp} ${flight.flightNumber} → History: ${flight.historicalPerformance.message}`);
    }
    
    if (flight.seatMapData?.error) {
        console.warn(`[ENRICHMENT-ERROR] ${timestamp} ${flight.flightNumber} → Seats: ${flight.seatMapData.message}`);
    }
}

// ============================================
// EXAMPLE 8: Type Safety
// ============================================

// Ensure your FlightResult type includes the new fields:

interface FlightResult {
    // ... existing fields ...
    flightNumber: string;
    offerId: string;
    airline: string;
    
    // NEW: Add these optional fields for real data enhancements
    historicalPerformance?: HistoricalPerformance | FlightStatusError | null;
    seatMapData?: SeatMapData | SeatMapError | null;
}

// Then TypeScript will validate that you're handling errors:
flight.historicalPerformance.delayProbability; // ❌ Error!
// Property 'delayProbability' does not exist on type 'FlightStatusError'

// Correct:
if (flight.historicalPerformance && !flight.historicalPerformance.error) {
    console.log(flight.historicalPerformance.delayProbability); // ✅ OK!
}

// ============================================
// PERFORMANCE NOTES
// ============================================

// Historical Radar:
// - Time: ~2-5 seconds per flight (10 API calls)
// - Cost: 10 RapidAPI calls per flight
// - Caching: 24 hours recommended
// - Impact: Network - run in background

// Seat Maps:
// - Time: 200-500ms per flight
// - Cost: 1 Duffel API call per flight
// - Caching: 1 hour (offers expire)
// - Impact: Network - run in background

// Strategy:
// 1. Return search results immediately
// 2. Fetch real data in background
// 3. Update cache/UI as data arrives
// 4. Never block user waiting for enhancements

// ============================================

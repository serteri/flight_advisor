/**
 * AeroDataBox Flight Status Service
 * Real-time flight tracking via RapidAPI
 * 
 * Features:
 * - Live departure/arrival times
 * - Delay detection (EU261 compensation triggers)
 * - Cancellation alerts
 * - Gate changes
 */

export interface FlightStatus {
    flightNumber: string;
    airline: string;
    date: string; // YYYY-MM-DD
    
    // Status
    status: 'scheduled' | 'active' | 'landed' | 'cancelled' | 'diverted' | 'unknown';
    
    // Departure
    scheduledDeparture: string; // ISO timestamp
    actualDeparture?: string;
    departureGate?: string;
    departureTerminal?: string;
    departureDelayMinutes?: number;
    
    // Arrival
    scheduledArrival: string;
    actualArrival?: string;
    estimatedArrival?: string;
    arrivalGate?: string;
    arrivalTerminal?: string;
    arrivalDelayMinutes?: number;
    
    // Aircraft
    aircraft?: {
        model?: string;
        registration?: string;
    };
    
    // EU261 Trigger
    isEU261Eligible?: boolean; // Delay > 180 mins OR cancelled
    compensationAmount?: number; // EUR
    
    // Raw data for debugging
    rawData?: any;
}

export interface FlightStatusError {
    error: true;
    message: string;
    code?: string;
}

/**
 * Get real-time flight status from AeroDataBox
 * 
 * @param flightNumber - Flight number (e.g., "TK1999")
 * @param date - Flight date in YYYY-MM-DD format
 * @returns Flight status or error
 */
export async function getFlightStatus(
    flightNumber: string,
    date: string
): Promise<FlightStatus | FlightStatusError> {
    const RAPID_API_KEY = process.env.RAPID_API_KEY;
    const RAPID_API_HOST = process.env.RAPID_API_HOST_AERODATABOX;
    
    if (!RAPID_API_KEY || !RAPID_API_HOST) {
        console.error('[AeroDataBox] Missing API credentials in .env');
        return {
            error: true,
            message: 'AeroDataBox API credentials not configured',
            code: 'MISSING_CREDENTIALS'
        };
    }
    
    try {
        // Extract airline code and number (e.g., "TK1999" -> airline=TK, number=1999)
        const match = flightNumber.match(/^([A-Z]{2})(\d+)$/);
        if (!match) {
            return {
                error: true,
                message: `Invalid flight number format: ${flightNumber}`,
                code: 'INVALID_FORMAT'
            };
        }
        
        const [_, airlineCode, number] = match;
        
        // AeroDataBox endpoint: /flights/number/{flightNumber}/{date}
        const url = `https://${RAPID_API_HOST}/flights/number/${flightNumber}/${date}`;
        
        console.log(`[AeroDataBox] Fetching status for ${flightNumber} on ${date}...`);
        console.log(`[AeroDataBox] URL: ${url}`);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': RAPID_API_KEY,
                'X-RapidAPI-Host': RAPID_API_HOST
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[AeroDataBox] API Error (${response.status}):`, errorText);
            
            return {
                error: true,
                message: `AeroDataBox API returned ${response.status}: ${errorText}`,
                code: `HTTP_${response.status}`
            };
        }
        
        const data = await response.json();
        
        console.log('[AeroDataBox] ✅ RAW RESPONSE:');
        console.log(JSON.stringify(data, null, 2));
        
        // AeroDataBox returns array of flights (same flight number can have multiple daily departures)
        // Take first matching flight
        const flights = Array.isArray(data) ? data : [data];
        const flight = flights[0];
        
        if (!flight) {
            return {
                error: true,
                message: `No flight found for ${flightNumber} on ${date}`,
                code: 'NOT_FOUND'
            };
        }
        
        // Parse departure info
        const departure = flight.departure || {};
        const arrival = flight.arrival || {};
        
        const scheduledDep = departure.scheduledTime?.local || departure.scheduledTimeUtc;
        const actualDep = departure.actualTime?.local || departure.actualTimeUtc;
        const revisedDep = departure.revisedTime?.local || departure.revisedTimeUtc;
        
        const scheduledArr = arrival.scheduledTime?.local || arrival.scheduledTimeUtc;
        const actualArr = arrival.actualTime?.local || arrival.actualTimeUtc;
        const estimatedArr = arrival.estimatedTime?.local || arrival.estimatedTimeUtc;
        
        // Calculate delays
        let departureDelayMinutes: number | undefined;
        if (actualDep && scheduledDep) {
            const diffMs = new Date(actualDep).getTime() - new Date(scheduledDep).getTime();
            departureDelayMinutes = Math.floor(diffMs / 60000);
        } else if (revisedDep && scheduledDep) {
            const diffMs = new Date(revisedDep).getTime() - new Date(scheduledDep).getTime();
            departureDelayMinutes = Math.floor(diffMs / 60000);
        }
        
        let arrivalDelayMinutes: number | undefined;
        if (actualArr && scheduledArr) {
            const diffMs = new Date(actualArr).getTime() - new Date(scheduledArr).getTime();
            arrivalDelayMinutes = Math.floor(diffMs / 60000);
        } else if (estimatedArr && scheduledArr) {
            const diffMs = new Date(estimatedArr).getTime() - new Date(scheduledArr).getTime();
            arrivalDelayMinutes = Math.floor(diffMs / 60000);
        }
        
        // Determine status
        let status: FlightStatus['status'] = 'unknown';
        if (flight.status) {
            const s = flight.status.toLowerCase();
            if (s.includes('cancelled')) status = 'cancelled';
            else if (s.includes('landed') || s.includes('arrived')) status = 'landed';
            else if (s.includes('active') || s.includes('en-route')) status = 'active';
            else if (s.includes('scheduled')) status = 'scheduled';
            else if (s.includes('diverted')) status = 'diverted';
        }
        
        // EU261 Eligibility Check
        // Rule: Delay ≥ 180 minutes OR cancelled
        const totalDelay = arrivalDelayMinutes || departureDelayMinutes || 0;
        const isEU261Eligible = status === 'cancelled' || totalDelay >= 180;
        
        // Compensation amount (simplified - real calculation depends on distance)
        let compensationAmount: number | undefined;
        if (isEU261Eligible) {
            // Basic EU261 amounts: €250 (<1500km), €400 (1500-3500km), €600 (>3500km)
            // Default to €400 as middle ground
            compensationAmount = 400;
        }
        
        const result: FlightStatus = {
            flightNumber,
            airline: airlineCode,
            date,
            status,
            scheduledDeparture: scheduledDep,
            actualDeparture: actualDep,
            departureGate: departure.gate,
            departureTerminal: departure.terminal,
            departureDelayMinutes,
            scheduledArrival: scheduledArr,
            actualArrival: actualArr,
            estimatedArrival: estimatedArr,
            arrivalGate: arrival.gate,
            arrivalTerminal: arrival.terminal,
            arrivalDelayMinutes,
            aircraft: {
                model: flight.aircraft?.model,
                registration: flight.aircraft?.reg
            },
            isEU261Eligible,
            compensationAmount,
            rawData: flight
        };
        
        console.log('[AeroDataBox] ✅ PARSED FLIGHT STATUS:');
        console.log(JSON.stringify(result, null, 2));
        
        if (isEU261Eligible) {
            console.log(`🚨 [AeroDataBox] EU261 TRIGGER: ${status === 'cancelled' ? 'CANCELLED' : `DELAYED ${totalDelay} mins`}`);
            console.log(`💰 [AeroDataBox] Potential compensation: €${compensationAmount}`);
        }
        
        return result;
        
    } catch (error: any) {
        console.error('[AeroDataBox] Exception:', error);
        return {
            error: true,
            message: error.message || 'Unknown error occurred',
            code: 'EXCEPTION'
        };
    }
}

/**
 * Batch check multiple flights (for Guardian Worker)
 */
export async function checkMultipleFlights(
    flights: Array<{ flightNumber: string; date: string }>
): Promise<Array<FlightStatus | FlightStatusError>> {
    console.log(`[AeroDataBox] Batch checking ${flights.length} flights...`);
    
    const results = await Promise.allSettled(
        flights.map(f => getFlightStatus(f.flightNumber, f.date))
    );
    
    return results.map((r, i) => {
        if (r.status === 'fulfilled') {
            return r.value;
        } else {
            console.error(`[AeroDataBox] Failed to check flight ${flights[i].flightNumber}:`, r.reason);
            return {
                error: true,
                message: r.reason?.message || 'Request failed',
                code: 'PROMISE_REJECTED'
            };
        }
    });
}

/**
 * Historical Punctuality Radar
 * 
 * Analyzes past 7-10 days of flight history to calculate delay likelihood.
 * Real data from AeroDataBox (no guessing, no mock data).
 * 
 * @param flightNumber - e.g., "TK15"
 * @returns HistoricalPerformance with delay likelihood % and historical context
 */
export interface HistoricalPerformance {
    flightNumber: string;
    delayProbability: number; // 0-100, percentage of delayed flights in history
    historicalContext: {
        daysAnalyzed: number;
        totalFlights: number;
        delayedFlights: number;
        averageDelayMinutes: number;
        maxDelayMinutes: number;
        criticalDelayCount: number; // Flights delayed > 45 mins
    };
    risk: 'LOW' | 'MODERATE' | 'HIGH'; // Classification
    lastChecked: string; // ISO timestamp
    dataAvailable: boolean; // True if we have historical data
}

export async function getHistoricalFlightPerformance(
    flightNumber: string
): Promise<HistoricalPerformance | FlightStatusError> {
    try {
        console.log(`[HistoricalRadar] Fetching history for flight ${flightNumber}...`);
        
        // Get today's date and calculate past 10 days
        const today = new Date();
        const pastDays: string[] = [];
        
        for (let i = 1; i <= 10; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            pastDays.push(date.toISOString().split('T')[0]);
        }
        
        const flightHistory: Array<{
            date: string;
            delayMinutes: number;
            status: string;
        }> = [];
        
        // Fetch flight data for past 10 days (with rate limiting to avoid API throttling)
        for (const date of pastDays) {
            try {
                const response = await fetch(
                    `https://aerodatabox.p.rapidapi.com/flights/number/${flightNumber}/${date}`,
                    {
                        method: 'GET',
                        headers: {
                            'x-rapidapi-key': process.env.RAPID_API_KEY || '',
                            'x-rapidapi-host': 'aerodatabox.p.rapidapi.com'
                        }
                    }
                );
                
                if (!response.ok) {
                    // Date has no data for this flight (normal)
                    console.log(`[HistoricalRadar] No data for ${flightNumber} on ${date}`);
                    continue;
                }
                
                const data = await response.json();
                
                if (data.flights && Array.isArray(data.flights)) {
                    for (const flight of data.flights) {
                        // Calculate actual delay (departure)
                        const scheduled = new Date(flight.departure.scheduledTime);
                        const actual = flight.departure.actualTime 
                            ? new Date(flight.departure.actualTime) 
                            : null;
                        
                        let delayMinutes = 0;
                        if (actual) {
                            delayMinutes = Math.round((actual.getTime() - scheduled.getTime()) / (1000 * 60));
                        }
                        
                        flightHistory.push({
                            date,
                            delayMinutes: Math.max(0, delayMinutes), // Don't count early departures
                            status: flight.status || 'unknown'
                        });
                    }
                }
                
                // Rate limit: 100ms between requests
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (dayError) {
                console.error(`[HistoricalRadar] Error fetching ${flightNumber} on ${date}:`, dayError);
                // Continue to next day rather than failing entirely
                continue;
            }
        }
        
        // Calculate statistics
        if (flightHistory.length === 0) {
            console.log(`[HistoricalRadar] ⚠️ No historical data found for ${flightNumber}`);
            return {
                flightNumber,
                delayProbability: 0,
                historicalContext: {
                    daysAnalyzed: 10,
                    totalFlights: 0,
                    delayedFlights: 0,
                    averageDelayMinutes: 0,
                    maxDelayMinutes: 0,
                    criticalDelayCount: 0
                },
                risk: 'LOW',
                lastChecked: new Date().toISOString(),
                dataAvailable: false
            };
        }
        
        const delayedFlights = flightHistory.filter(f => f.delayMinutes > 0);
        const criticalDelays = flightHistory.filter(f => f.delayMinutes > 45);
        const totalDelay = flightHistory.reduce((sum, f) => sum + f.delayMinutes, 0);
        const maxDelay = Math.max(...flightHistory.map(f => f.delayMinutes));
        
        const delayProbability = Math.round((delayedFlights.length / flightHistory.length) * 100);
        const averageDelayMinutes = Math.round(totalDelay / flightHistory.length);
        
        // Risk classification
        let risk: 'LOW' | 'MODERATE' | 'HIGH' = 'LOW';
        if (delayProbability >= 60 || criticalDelays.length >= 4) risk = 'HIGH';
        else if (delayProbability >= 40 || criticalDelays.length >= 2) risk = 'MODERATE';
        
        const result: HistoricalPerformance = {
            flightNumber,
            delayProbability,
            historicalContext: {
                daysAnalyzed: 10,
                totalFlights: flightHistory.length,
                delayedFlights: delayedFlights.length,
                averageDelayMinutes,
                maxDelayMinutes: maxDelay,
                criticalDelayCount: criticalDelays.length
            },
            risk,
            lastChecked: new Date().toISOString(),
            dataAvailable: true
        };
        
        console.log(`[HistoricalRadar] ✅ Analysis complete for ${flightNumber}:`, result);
        return result;
        
    } catch (error: any) {
        console.error('[HistoricalRadar] Exception:', error);
        return {
            error: true,
            message: error.message || 'Failed to fetch historical data',
            code: 'HISTORY_ERROR'
        };
    }
}

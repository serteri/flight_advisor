/**
 * Duffel Seat Maps Service
 * 
 * Real seat map data from Duffel API (via direct HTTP calls)
 * Graceful fallback: If airline doesn't support it or API fails, return null (not fake data)
 * 
 * Philosophy: "Honesty First - If we can't get real data, we don't make it up"
 */

export interface SeatMapData {
    offerId: string;
    airline: string;
    aircraftType?: string;
    totalSeats: number;
    availableSeats: number;
    occupiedSeats: number;
    cabinClasses: {
        [key: string]: {
            available: number;
            occupied: number;
            total: number;
        };
    };
    emergencyExitRows: number[];
    lastUpdated: string;
}

export interface SeatMapError {
    error: true;
    reason: 'NOT_SUPPORTED' | 'API_FAILED' | 'INVALID_OFFER' | 'NETWORK_ERROR';
    message: string;
    airlineName?: string;
}

/**
 * Fetch real seat map data from Duffel for an offer
 * 
 * Returns null gracefully if:
 * - Airline doesn't support seat maps
 * - Offer has expired
 * - API rate limit hit
 * 
 * @param offerId - Duffel offer ID (e.g., from search results)
 * @param airlineName - For logging and error context
 * @returns SeatMapData or SeatMapError
 */
export async function getDuffelSeatMap(
    offerId: string,
    airlineName: string = 'Unknown'
): Promise<SeatMapData | SeatMapError | null> {
    try {
        if (!offerId) {
            return {
                error: true,
                reason: 'INVALID_OFFER',
                message: 'Offer ID is required',
                airlineName
            };
        }

        console.log(`[DuffelSeatMap] Fetching seat map for offer ${offerId} (${airlineName})...`);

        const token = process.env.DUFFEL_ACCESS_TOKEN;
        if (!token) {
            return {
                error: true,
                reason: 'API_FAILED',
                message: 'Duffel API token not configured',
                airlineName
            };
        }

        // Fetch seat maps from Duffel REST API
        const response = await fetch(
            `https://api.duffel.com/seat_maps?offer_id=${encodeURIComponent(offerId)}`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Duffel-Version': '2023-10-16'
                }
            }
        );

        // Check response status
        if (response.status === 401 || response.status === 403) {
            return {
                error: true,
                reason: 'API_FAILED',
                message: 'Authentication failed - check Duffel token',
                airlineName
            };
        }

        if (response.status === 404) {
            console.log(
                `[DuffelSeatMap] ℹ️ No seat maps available for ${airlineName}. ` +
                `This offer may be expired or airline doesn't support seat maps.`
            );
            return {
                error: true,
                reason: 'NOT_SUPPORTED',
                message: `${airlineName} does not provide seat map data for this flight`,
                airlineName
            };
        }

        if (response.status === 429) {
            console.warn(`[DuffelSeatMap] ⚠️ Rate limited by Duffel API`);
            return {
                error: true,
                reason: 'API_FAILED',
                message: 'Too many requests. Please try again in a moment.',
                airlineName
            };
        }

        if (!response.ok) {
            console.warn(`[DuffelSeatMap] ⚠️ Unexpected API status ${response.status}`);
            return {
                error: true,
                reason: 'API_FAILED',
                message: `API returned status ${response.status}`,
                airlineName
            };
        }

        const data = await response.json();

        // Check if we got seat maps
        if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
            console.log(
                `[DuffelSeatMap] ℹ️ No seat maps in response for ${airlineName}. ` +
                `This airline may not support seat map booking or the offer expired.`
            );
            return {
                error: true,
                reason: 'NOT_SUPPORTED',
                message: `${airlineName} does not provide seat map data for this flight`,
                airlineName
            };
        }

        // Parse the first (usually only) seat map
        const seatMap = data.data[0];
        
        if (!seatMap.slices || seatMap.slices.length === 0) {
            console.log(`[DuffelSeatMap] ⚠️ Seat map has no flight segments for ${airlineName}`);
            return null;
        }

        // Analyze cabins and count seats
        let totalSeats = 0;
        let occupiedSeats = 0;
        const cabinClasses: { [key: string]: { available: number; occupied: number; total: number } } = {};

        for (const slice of seatMap.slices) {
            if (!slice.cabins) continue;

            for (const cabin of slice.cabins) {
                const cabinName = cabin.cabin_class || 'ECONOMY';

                // Initialize cabin if not exists
                if (!cabinClasses[cabinName]) {
                    cabinClasses[cabinName] = { available: 0, occupied: 0, total: 0 };
                }

                if (cabin.rows) {
                    for (const row of cabin.rows) {
                        if (row.seats) {
                            for (const seat of row.seats) {
                                cabinClasses[cabinName].total++;
                                totalSeats++;

                                // Check seat availability
                                if (seat.available === false || seat.traveler_pricing?.status === 'OCCUPIED') {
                                    cabinClasses[cabinName].occupied++;
                                    occupiedSeats++;
                                } else {
                                    cabinClasses[cabinName].available++;
                                }
                            }
                        }
                    }
                }
            }
        }

        // Extract emergency exit rows (useful for safety-conscious travelers)
        const emergencyExitRows: number[] = [];
        for (const slice of seatMap.slices) {
            if (slice.cabins) {
                for (const cabin of slice.cabins) {
                    if (cabin.rows) {
                        for (const row of cabin.rows) {
                            if (row.exit_row === true) {
                                emergencyExitRows.push(row.row_number || 0);
                            }
                        }
                    }
                }
            }
        }

        const availableSeats = totalSeats - occupiedSeats;

        const result: SeatMapData = {
            offerId,
            airline: airlineName,
            aircraftType: seatMap.slices[0]?.aircraft?.iata_code || undefined,
            totalSeats,
            availableSeats,
            occupiedSeats,
            cabinClasses,
            emergencyExitRows: [...new Set(emergencyExitRows)], // Deduplicate
            lastUpdated: new Date().toISOString()
        };

        console.log(
            `[DuffelSeatMap] ✅ Got seat data for ${airlineName}: ` +
            `${availableSeats}/${totalSeats} seats available`
        );

        return result;

    } catch (error: any) {
        // Network/timeout error
        if (error.code === 'ECONNABORTED' || error.code === 'ECONNRESET' || error instanceof TypeError) {
            console.error(`[DuffelSeatMap] 🌐 Network error fetching seat maps for ${airlineName}:`, error.message);
            return {
                error: true,
                reason: 'NETWORK_ERROR',
                message: `Network timeout while fetching seat maps from ${airlineName}`,
                airlineName
            };
        }

        // Unexpected error
        console.error(`[DuffelSeatMap] ❌ Unexpected error for ${airlineName}:`, error);
        return {
            error: true,
            reason: 'API_FAILED',
            message: error.message || 'Failed to fetch seat map data',
            airlineName
        };
    }
}

/**
 * Batch fetch seat maps for multiple offers
 * (Useful for search results page showing multiple flight options)
 */
export async function getDuffelSeatMapsBatch(
    offers: Array<{ offerId: string; airlineName: string }>
): Promise<Map<string, SeatMapData | SeatMapError | null>> {
    const results = new Map<string, SeatMapData | SeatMapError | null>();

    console.log(`[DuffelSeatMap] Batch fetching ${offers.length} seat maps...`);

    // Limit concurrency to 3 to avoid overwhelming the API
    const concurrency = 3;
    for (let i = 0; i < offers.length; i += concurrency) {
        const batch = offers.slice(i, i + concurrency);
        const promises = batch.map(offer =>
            getDuffelSeatMap(offer.offerId, offer.airlineName)
                .then(result => ({
                    offerId: offer.offerId,
                    result
                }))
        );

        const batchResults = await Promise.all(promises);
        batchResults.forEach(({ offerId, result }) => {
            results.set(offerId, result);
        });

        // Rate limit: 500ms between batches
        if (i + concurrency < offers.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    return results;
}

/**
 * Helper: Check if error is fatal (shouldn't retry) vs recoverable
 */
export function isSeatMapErrorFatal(error: SeatMapError): boolean {
    return error.reason === 'INVALID_OFFER' || error.reason === 'NOT_SUPPORTED';
}

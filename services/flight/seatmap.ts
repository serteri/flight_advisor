
import amadeus from '@/lib/amadeus';

/**
 * Fetches the seat map for a specific flight order or offer.
 * 
 * @param flightOrderId - The unique identifier of the flight order (booking).
 * @param flightOfferId - Alternatively, the offer ID if no booking exists yet.
 * @returns The raw seat map data from Amadeus or null on failure.
 */
export async function getFlightSeatMap(flightOrderId: string, flightOfferId?: string) {
    try {
        // Determine which ID to use. 
        // Amadeus Shopping SeatMaps API can typically take an offer ID or an order ID.
        // For this MVP, we follow the user's snippet structure which assumes order based retrieval 
        // or passing the params in a specific way.

        // Note: The standard Amadeus Node SDK `shopping.seatmaps.get` usually expects query params.
        // If we have an order ID:
        const params: any = {};
        if (flightOrderId) {
            params['flight-orderId'] = flightOrderId;
        } else if (flightOfferId) {
            // Warning: Usually requires POST with full offer object or specific flow
            // But some endpoints allow GET with offer ID in test environments.
            params['flightOfferId'] = flightOfferId;
        }

        const response = await amadeus.shopping.seatmaps.get(params);

        return response.data;
    } catch (error) {
        console.error("SeatMap Fetch Error:", error);
        return null;
    }
}

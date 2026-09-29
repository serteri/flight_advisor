'use server';

import { getAmadeusClient } from '@/lib/amadeus';
import { mapAmadeusToVisualizer } from '@/utils/seatMapMapper';
import { getAircraftInfo } from '@/lib/aircraftData';
import { auth } from '@/auth';

export async function getLatestSeatMap(segmentId: string, segmentData: any) {
    // Server actions are public POST endpoints; this one spends paid Amadeus quota.
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        const amadeus = getAmadeusClient();

        // 1. Prepare params for Amadeus
        // We need origin, dest, date, airline, flightNumber
        const flightParams = {
            origin: segmentData.origin,
            destination: segmentData.destination,
            date: new Date(segmentData.departureDate).toISOString().split('T')[0],
            airlineCode: segmentData.airlineCode,
            flightNumber: segmentData.flightNumber
        };

        console.log(`🔍 Fetching live seat map for ${flightParams.airlineCode}${flightParams.flightNumber}...`);

        // 2. Call Amadeus (Search -> Offer -> SeatMap)
        const seatMapRaw = await amadeus.getRealSeatMap(flightParams);

        if (!seatMapRaw) {
            return { success: false, error: 'Seat map not found' };
        }

        // 3. Map to Visualizer Format
        const layout = mapAmadeusToVisualizer([seatMapRaw], segmentData.userSeat);

        // 4. Enrich with Verified Aircraft Info
        const aircraftCode = seatMapRaw.aircraft?.code || segmentData.aircraftType;
        const verifiedInfo = getAircraftInfo(aircraftCode);

        // Update layout with verified type name if available
        if (verifiedInfo) {
            layout.aircraftType = `${verifiedInfo.name} (${verifiedInfo.badge})`;
        }

        return {
            success: true,
            layout,
            aircraftInfo: verifiedInfo // Return extra info for UI badger
        };

    } catch (error) {
        console.error("Server Action Error:", error);
        return { success: false, error: 'Failed to fetch data' };
    }
}

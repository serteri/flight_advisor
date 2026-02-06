// lib/db/guardian.ts
import { prisma } from '@/lib/prisma';
import { TrackedFlight } from '@/types/guardian';

/**
 * Fetches all monitored trips for a user and converts to TrackedFlight format
 */
export async function getTrackedFlights(userId: string): Promise<TrackedFlight[]> {
    try {
        const monitoredTrips = await prisma.monitoredTrip.findMany({
            where: {
                userId,
                status: 'ACTIVE' // Only active trips
            },
            include: {
                flights: true // Include related flight segments
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Convert MonitoredTrip to TrackedFlight format
        return monitoredTrips.map(trip => {
            const firstFlight = trip.flights?.[0];

            return {
                id: trip.id,
                pnr: trip.pnr,
                origin: firstFlight?.origin || 'N/A',
                destination: firstFlight?.destination || 'N/A',
                departureTime: firstFlight?.departureTime || new Date().toISOString(),
                originalDepartureTime: firstFlight?.scheduledDeparture || firstFlight?.departureTime || new Date().toISOString(),
                status: firstFlight?.status || 'SCHEDULED',
                delayMinutes: firstFlight?.delayMinutes || 0,
                pricePaid: trip.originalPrice,
                currentBusinessPrice: trip.targetUpgradePrice,
                carrier: firstFlight?.carrier,
                flightNumber: firstFlight?.flightNumber,
                passengers: [] // Would need passenger data from separate table
            } as TrackedFlight;
        });
    } catch (error) {
        console.error('Error fetching tracked flights:', error);
        return [];
    }
}

/**
 * Gets a single tracked flight by ID
 */
export async function getTrackedFlightById(id: string, userId: string): Promise<TrackedFlight | null> {
    try {
        const trip = await prisma.monitoredTrip.findFirst({
            where: {
                id,
                userId
            },
            include: {
                flights: true
            }
        });

        if (!trip) return null;

        const firstFlight = trip.flights?.[0];

        return {
            id: trip.id,
            pnr: trip.pnr,
            origin: firstFlight?.origin || 'N/A',
            destination: firstFlight?.destination || 'N/A',
            departureTime: firstFlight?.departureTime || new Date().toISOString(),
            originalDepartureTime: firstFlight?.scheduledDeparture || firstFlight?.departureTime || new Date().toISOString(),
            status: firstFlight?.status || 'SCHEDULED',
            delayMinutes: firstFlight?.delayMinutes || 0,
            pricePaid: trip.originalPrice,
            currentBusinessPrice: trip.targetUpgradePrice,
            carrier: firstFlight?.carrier,
            flightNumber: firstFlight?.flightNumber,
            passengers: []
        } as TrackedFlight;
    } catch (error) {
        console.error('Error fetching flight by ID:', error);
        return null;
    }
}

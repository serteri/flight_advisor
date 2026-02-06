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
                segments: true // Include related flight segments
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Convert MonitoredTrip to TrackedFlight format
        return monitoredTrips.map(trip => {
            const firstSegment = trip.segments?.[0];

            return {
                id: trip.id,
                pnr: trip.pnr,
                origin: firstSegment?.origin || 'N/A',
                destination: firstSegment?.destination || 'N/A',
                departureTime: firstSegment?.departureDate.toISOString() || new Date().toISOString(),
                originalDepartureTime: firstSegment?.departureDate.toISOString() || new Date().toISOString(),
                status: 'SCHEDULED', // FlightSegment doesn't have status, default to SCHEDULED
                delayMinutes: 0, // FlightSegment doesn't track delays directly
                pricePaid: trip.originalPrice,
                currentBusinessPrice: trip.targetUpgradePrice,
                carrier: firstSegment?.airlineCode,
                flightNumber: firstSegment?.flightNumber,
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
                segments: true
            }
        });

        if (!trip) return null;

        const firstSegment = trip.segments?.[0];

        return {
            id: trip.id,
            pnr: trip.pnr,
            origin: firstSegment?.origin || 'N/A',
            destination: firstSegment?.destination || 'N/A',
            departureTime: firstSegment?.departureDate.toISOString() || new Date().toISOString(),
            originalDepartureTime: firstSegment?.departureDate.toISOString() || new Date().toISOString(),
            status: 'SCHEDULED',
            delayMinutes: 0,
            pricePaid: trip.originalPrice,
            currentBusinessPrice: trip.targetUpgradePrice,
            carrier: firstSegment?.airlineCode,
            flightNumber: firstSegment?.flightNumber,
            passengers: []
        } as TrackedFlight;
    } catch (error) {
        console.error('Error fetching flight by ID:', error);
        return null;
    }
}

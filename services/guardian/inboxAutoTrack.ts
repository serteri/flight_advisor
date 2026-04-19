import { prisma } from '@/lib/prisma';
import type { BookingParseResult } from '@/lib/parser/bookingTextParser';

export type AutoTrackResult = {
    created: boolean;
    tripId?: string;
    reason?: string;
};

const deriveAirlineCode = (flightNumber?: string, airline?: string): string => {
    const fromFlight = (flightNumber || '').toUpperCase().match(/^([A-Z0-9]{2,3})/)?.[1];
    if (fromFlight) return fromFlight;

    const fromAirline = (airline || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
    return fromAirline || 'XX';
};

const toSafeDate = (value?: string): Date | null => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
};

export async function autoCreateMonitoredTripFromParsedBooking(params: {
    userId: string;
    parseResult: BookingParseResult;
}): Promise<AutoTrackResult> {
    const { userId, parseResult } = params;

    if (!parseResult.isTrackable) {
        return {
            created: false,
            reason: `Missing required fields: ${parseResult.missingRequiredFields.join(', ')}`,
        };
    }

    const extracted = parseResult.extracted;
    const departureDate = toSafeDate(extracted.departureDateTime);
    if (!departureDate) {
        return { created: false, reason: 'Invalid departureDateTime format' };
    }

    const arrivalDate =
        toSafeDate(extracted.arrivalDateTime) ||
        new Date(departureDate.getTime() + 2 * 60 * 60 * 1000);

    const flightNumber = String(extracted.flightNumber).toUpperCase().replace(/\s+/g, '');
    const origin = String(extracted.departureAirport).toUpperCase();
    const destination = String(extracted.arrivalAirport).toUpperCase();
    const airlineCode = deriveAirlineCode(flightNumber, extracted.airline);

    const pnr = extracted.pnr
        ? extracted.pnr.toUpperCase()
        : `AUTO-${flightNumber}-${departureDate.getTime()}`;

    const trip = await prisma.monitoredTrip.create({
        data: {
            userId,
            pnr,
            routeLabel: `${origin} → ${destination}`,
            originalPrice: 0,
            currency: 'USD',
            ticketClass: 'ECONOMY',
            watchPrice: false,
            watchDelay: true,
            watchUpgrade: false,
            watchSeat: false,
            watchSchedule: true,
            status: 'ACTIVE',
            checkFrequency: 60,
            nextCheckAt: new Date(),
            segments: {
                create: [
                    {
                        segmentOrder: 0,
                        airlineCode,
                        flightNumber,
                        origin,
                        destination,
                        departureDate,
                        arrivalDate,
                        aircraftType: null,
                        cabinClass: 'ECONOMY',
                    },
                ],
            },
            snapshot: {
                create: {
                    delayMinutes: 0,
                    status: 'scheduled',
                    dataQuality: 'UNKNOWN',
                    eu261Eligible: false,
                },
            },
            passengers: extracted.passengerName
                ? {
                    create: [
                        {
                            name: extracted.passengerName,
                            type: 'ADULT',
                        },
                    ],
                }
                : undefined,
        },
    });

    return {
        created: true,
        tripId: trip.id,
    };
}

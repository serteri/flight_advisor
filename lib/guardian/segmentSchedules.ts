// lib/guardian/segmentSchedules.ts
//
// Adds the airport-local scheduled times (e.g. 18:15 -> 20:50) to stored segments,
// using the cached lookup the trip was verified against. Server only.

import { prisma } from '@/lib/prisma';
import type { FlightLegOption } from '@/lib/flightData/legs';
import { airportSchedule } from '@/lib/guardian/flightScheduleDisplay';

type SegmentForSchedule = {
    airlineCode: string;
    flightNumber: string;
    origin: string;
    destination: string;
    departureDate: Date;
    scheduledDepartureUtc: Date | string | null;
    scheduledArrivalUtc: Date | string | null;
};

export async function withLocalSchedules<T extends SegmentForSchedule>(segments: readonly T[]) {
    return Promise.all(segments.map(async (segment) => {
        const cache = await prisma.flightLookupCache.findUnique({
            where: {
                flightNumber_flightDate: {
                    flightNumber: `${segment.airlineCode}${segment.flightNumber}`.toUpperCase().replace(/\s/g, ''),
                    flightDate: segment.departureDate.toISOString().slice(0, 10),
                },
            },
            select: { options: true },
        }).catch(() => null);
        const options = Array.isArray(cache?.options) ? cache.options as unknown as FlightLegOption[] : [];
        return { ...segment, ...airportSchedule(segment, options) };
    }));
}

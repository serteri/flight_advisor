import { prisma } from '@/lib/prisma';
import { FlightResult } from '@/types/hybridFlight';

const DAY_MS = 24 * 60 * 60 * 1000;

export const toMinutes = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.max(0, value);
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();

        const isoMatch = trimmed.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
        if (isoMatch) {
            const hours = parseInt(isoMatch[1] || '0', 10);
            const mins = parseInt(isoMatch[2] || '0', 10);
            return Math.max(0, hours * 60 + mins);
        }

        const hrMinMatch = trimmed.match(/(\d+)\s*(h|hr|hrs|hour|hours)\s*(\d+)?\s*(m|min|mins|minute|minutes)?/i);
        if (hrMinMatch) {
            const hours = parseInt(hrMinMatch[1] || '0', 10);
            const mins = parseInt(hrMinMatch[3] || '0', 10);
            return Math.max(0, hours * 60 + mins);
        }

        const minMatch = trimmed.match(/(\d+)\s*(m|min|mins|minute|minutes)/i);
        if (minMatch) {
            return Math.max(0, parseInt(minMatch[1], 10));
        }

        const numeric = parseFloat(trimmed.replace(/[^0-9.]/g, ''));
        if (Number.isFinite(numeric)) {
            return Math.max(0, numeric);
        }
    }

    return 0;
};

export const normalizeUtcDate = (dateInput: string): Date => {
    const datePart = dateInput.includes('T') ? dateInput.slice(0, 10) : dateInput;
    return new Date(`${datePart}T00:00:00.000Z`);
};

export const isInvalidBneIstDuration = (flight: FlightResult): boolean => {
    const routeMatch = flight.from === 'BNE' && flight.to === 'IST';
    if (!routeMatch) return false;

    const durationMins = toMinutes(flight.duration);
    return durationMins > 0 && durationMins < 18 * 60;
};

export async function persistFlightSearchRecords(
    flights: FlightResult[],
    options: { origin: string; destination: string; departureDate: string }
) {
    const departureDate = normalizeUtcDate(options.departureDate);

    const rows = flights
        .filter((flight) => Number.isFinite(Number(flight.price)) && Number(flight.price) > 0)
        .filter((flight) => !isInvalidBneIstDuration(flight))
        .map((flight) => ({
            flightNumber: (flight.flightNumber || 'UNKNOWN').toString(),
            origin: options.origin,
            destination: options.destination,
            departureDate,
            price: Number(flight.price),
            provider: (flight.source || 'UNKNOWN').toString(),
        }));

    if (rows.length === 0) return;

    try {
        await prisma.flightSearchRecord.createMany({
            data: rows,
        });
    } catch (error: any) {
        console.warn('[FLIGHT_SEARCH_RECORD] persist skipped:', error?.message || error);
    }
}

export async function getMedianPriceForRouteDate(
    origin: string,
    destination: string,
    departureDate: string
): Promise<number | null> {
    const start = normalizeUtcDate(departureDate);
    const end = new Date(start.getTime() + DAY_MS);

    let prices: Array<{ price: number }> = [];
    try {
        prices = await prisma.flightSearchRecord.findMany({
            where: {
                origin,
                destination,
                departureDate: {
                    gte: start,
                    lt: end,
                },
                price: {
                    gt: 0,
                },
            },
            select: { price: true },
        });
    } catch (error: any) {
        console.warn('[FLIGHT_SEARCH_RECORD] median lookup skipped:', error?.message || error);
        return null;
    }

    if (prices.length === 0) {
        return null;
    }

    const values = prices
        .map((row) => Number(row.price))
        .filter((value) => Number.isFinite(value) && value > 0)
        .sort((a, b) => a - b);

    if (values.length === 0) {
        return null;
    }

    const mid = Math.floor(values.length / 2);
    if (values.length % 2 === 0) {
        return (values[mid - 1] + values[mid]) / 2;
    }
    return values[mid];
}
// lib/flightData/formLookupStore.ts
//
// Prisma-backed storage for lib/flightData/formLookup.ts. Needs the tables in
// docs/phase2_schema_flight_lookup.sql (FlightLookupCache, FlightLookupAttempt).

import { prisma } from '@/lib/prisma';
import { lookupFlightLegs } from '@/lib/flightData/client';
import type { FlightLegOption } from '@/lib/flightData/legs';
import { LOOKUP_RATE_WINDOW_MS, type FormLookupDeps, type LookupCacheEntry } from '@/lib/flightData/formLookup';

export async function getLookupCache(flightNumber: string, date: string): Promise<LookupCacheEntry | null> {
    const row = await prisma.flightLookupCache.findUnique({
        where: { flightNumber_flightDate: { flightNumber, flightDate: date } },
    });
    if (!row) return null;
    return {
        outcome: row.outcome === 'FOUND' ? 'FOUND' : 'NOT_FOUND',
        options: (row.options as unknown as FlightLegOption[]) ?? [],
        fetchedAt: row.fetchedAt,
    };
}

export const prismaFormLookupDeps: FormLookupDeps = {
    countRecentAttempts: (ipHash, since) => prisma.flightLookupAttempt.count({ where: { ipHash, createdAt: { gte: since } } }),
    recordAttempt: async (ipHash, at) => {
        await prisma.flightLookupAttempt.create({ data: { ipHash, createdAt: at } });
        // Housekeeping: attempts older than two windows are useless.
        await prisma.flightLookupAttempt
            .deleteMany({ where: { createdAt: { lt: new Date(at.getTime() - 2 * LOOKUP_RATE_WINDOW_MS) } } })
            .catch(() => undefined);
    },
    getCache: getLookupCache,
    putCache: async (flightNumber, date, entry) => {
        const data = { outcome: entry.outcome, options: entry.options as unknown as object, fetchedAt: entry.fetchedAt };
        await prisma.flightLookupCache.upsert({
            where: { flightNumber_flightDate: { flightNumber, flightDate: date } },
            create: { flightNumber, flightDate: date, ...data },
            update: data,
        });
    },
    lookupLegs: lookupFlightLegs,
};

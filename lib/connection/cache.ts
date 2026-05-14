import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { fetchFlightAwareHistory } from './flightawareClient';
import { calculateArrivalOnTimeRate, type FlightRecord } from './successRate';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const normalizeIdent = (ident: string) => ident.trim().toUpperCase().replace(/\s+/g, '');

const analysisDateFor = (date = new Date()): Date => {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const isFlightRecord = (value: unknown): value is FlightRecord => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<Record<keyof FlightRecord, unknown>>;
  return typeof record.ident === 'string';
};

const parseCachedHistory = (value: Prisma.JsonValue): FlightRecord[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(isFlightRecord);
};

export type CachedFlightHistory = {
  flightIdent: string;
  history: FlightRecord[];
  onTimeRate: number;
  sampleSize: number;
  cacheStatus: 'HIT' | 'MISS';
};

export async function getFlightHistoryWithCache(flightIdent: string): Promise<CachedFlightHistory> {
  const normalizedIdent = normalizeIdent(flightIdent);
  const analysisDate = analysisDateFor();
  const now = new Date();

  const cached = await prisma.connectionCache.findUnique({
    where: {
      flightIdent_analysisDate: {
        flightIdent: normalizedIdent,
        analysisDate,
      },
    },
  });

  if (cached && cached.expiresAt > now) {
    return {
      flightIdent: normalizedIdent,
      history: parseCachedHistory(cached.historyData),
      onTimeRate: cached.onTimeRate,
      sampleSize: cached.sampleSize,
      cacheStatus: 'HIT',
    };
  }

  const history = await fetchFlightAwareHistory(normalizedIdent);
  const onTimeRate = calculateArrivalOnTimeRate(history);
  const expiresAt = new Date(now.getTime() + CACHE_TTL_MS);

  await prisma.connectionCache.upsert({
    where: {
      flightIdent_analysisDate: {
        flightIdent: normalizedIdent,
        analysisDate,
      },
    },
    create: {
      flightIdent: normalizedIdent,
      analysisDate,
      historyData: history as unknown as Prisma.InputJsonValue,
      onTimeRate,
      sampleSize: history.length,
      expiresAt,
    },
    update: {
      historyData: history as unknown as Prisma.InputJsonValue,
      onTimeRate,
      sampleSize: history.length,
      expiresAt,
    },
  });

  return {
    flightIdent: normalizedIdent,
    history,
    onTimeRate,
    sampleSize: history.length,
    cacheStatus: 'MISS',
  };
}

import { z } from 'zod';
import type { FlightRecord } from './successRate';

const BASE_URL = 'https://aeroapi.flightaware.com/aeroapi';

const flightAwareRecordSchema = z.object({
  ident: z.string().optional(),
  scheduled_out: z.string().nullable().optional(),
  actual_out: z.string().nullable().optional(),
  scheduled_in: z.string().nullable().optional(),
  actual_in: z.string().nullable().optional(),
  cancelled: z.boolean().nullable().optional(),
});

const flightAwareHistorySchema = z.object({
  flights: z.array(flightAwareRecordSchema).default([]),
});

export class FlightAwareConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FlightAwareConfigurationError';
  }
}

export class FlightAwareFetchError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'FlightAwareFetchError';
    this.status = status;
  }
}

const normalizeIdent = (ident: string) => ident.trim().toUpperCase().replace(/\s+/g, '');

export async function fetchFlightAwareHistory(flightIdent: string): Promise<FlightRecord[]> {
  const apiKey = process.env.FLIGHTAWARE_API_KEY;
  if (!apiKey) {
    throw new FlightAwareConfigurationError('FLIGHTAWARE_API_KEY is not configured');
  }

  const ident = normalizeIdent(flightIdent);
  const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const url = new URL(`${BASE_URL}/flights/${encodeURIComponent(ident)}/history`);
  url.searchParams.set('max_pages', '2');
  url.searchParams.set('start', start);

  const response = await fetch(url, {
    headers: {
      'x-apikey': apiKey,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = await response.text();
    throw new FlightAwareFetchError(response.status, body.slice(0, 500) || 'FlightAware history request failed');
  }

  const parsed = flightAwareHistorySchema.parse(await response.json());

  return parsed.flights.map((flight) => ({
    ident,
    scheduled_out: flight.scheduled_out ?? null,
    actual_out: flight.actual_out ?? null,
    scheduled_in: flight.scheduled_in ?? null,
    actual_in: flight.actual_in ?? null,
    cancelled: flight.cancelled ?? false,
  }));
}

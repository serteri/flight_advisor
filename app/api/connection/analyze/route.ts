import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAirportCoordinate } from '@/lib/compensation/airportCoordinates';
import { FlightAwareConfigurationError, FlightAwareFetchError } from '@/lib/connection/flightawareClient';
import { getFlightHistoryWithCache } from '@/lib/connection/cache';
import { getMinimumConnectionTime } from '@/lib/connection/minimumConnectionTimes';
import { calculateSuccessRate } from '@/lib/connection/successRate';

const legSchema = z.object({
  flightNumber: z.string().min(2).max(12),
  origin: z.string().length(3),
  destination: z.string().length(3),
  scheduledDep: z.coerce.date(),
  scheduledArr: z.coerce.date(),
});

const analyzeSchema = z.object({
  legs: z.array(legSchema).min(2).max(8),
});

const riskLevelSchema = z.enum(['SAFE', 'RISKY', 'CRITICAL', 'UNKNOWN']);

const connectionOutputSchema = z.object({
  airport: z.string(),
  airportName: z.string().optional(),
  connectionWindowMinutes: z.number(),
  mct: z.number(),
  inboundFlightIdent: z.string(),
  outboundFlightIdent: z.string(),
  inboundOnTimeRate: z.number(),
  outboundOnTimeRate: z.number(),
  successRate: z.number(),
  riskLevel: riskLevelSchema,
  sampleSize: z.number(),
  recommendation: z.string(),
  dataNote: z.string(),
  mctViolation: z.boolean().optional(),
  inboundSampleSize: z.number(),
  outboundSampleSize: z.number(),
  cacheStatus: z.object({
    inbound: z.enum(['HIT', 'MISS', 'SKIPPED']),
    outbound: z.enum(['HIT', 'MISS', 'SKIPPED']),
  }),
});

const responseSchema = z.object({
  connections: z.array(connectionOutputSchema),
  attribution: z.literal('Data powered by FlightAware'),
});

const minutesBetween = (later: Date, earlier: Date): number => {
  return Math.round((later.getTime() - earlier.getTime()) / 60000);
};

export async function POST(req: Request) {
  try {
    const input = analyzeSchema.parse(await req.json());
    const normalizedLegs = input.legs.map((leg) => ({
      ...leg,
      flightNumber: leg.flightNumber.trim().toUpperCase().replace(/\s+/g, ''),
      origin: leg.origin.toUpperCase(),
      destination: leg.destination.toUpperCase(),
    }));

    const connections = [];

    for (let index = 0; index < normalizedLegs.length - 1; index += 1) {
      const inbound = normalizedLegs[index];
      const outbound = normalizedLegs[index + 1];
      const airport = inbound.destination;
      const airportName = getAirportCoordinate(airport)?.name;
      const connectionWindowMinutes = minutesBetween(outbound.scheduledDep, inbound.scheduledArr);
      const mct = getMinimumConnectionTime(airport);

      if (airport !== outbound.origin) {
        connections.push({
          airport,
          airportName,
          connectionWindowMinutes,
          mct,
          inboundFlightIdent: inbound.flightNumber,
          outboundFlightIdent: outbound.flightNumber,
          inboundOnTimeRate: 0,
          outboundOnTimeRate: 0,
          successRate: 0,
          riskLevel: 'UNKNOWN' as const,
          sampleSize: 0,
          recommendation: 'The adjacent legs do not share the same connection airport. Check itinerary leg order before relying on this estimate.',
          dataNote: 'Historical analysis skipped because the itinerary connection point is inconsistent.',
          inboundSampleSize: 0,
          outboundSampleSize: 0,
          cacheStatus: { inbound: 'SKIPPED' as const, outbound: 'SKIPPED' as const },
        });
        continue;
      }

      if (connectionWindowMinutes < mct) {
        connections.push({
          airport,
          airportName,
          connectionWindowMinutes,
          mct,
          inboundFlightIdent: inbound.flightNumber,
          outboundFlightIdent: outbound.flightNumber,
          inboundOnTimeRate: 0,
          outboundOnTimeRate: 0,
          successRate: 0,
          riskLevel: 'CRITICAL' as const,
          sampleSize: 0,
          recommendation: 'This connection is below the minimum connection time used by FlightAgent. Choose a longer layover before considering historical punctuality.',
          dataNote: 'Minimum connection time violation; FlightAware historical lookup was skipped to avoid unnecessary API usage.',
          mctViolation: true,
          inboundSampleSize: 0,
          outboundSampleSize: 0,
          cacheStatus: { inbound: 'SKIPPED' as const, outbound: 'SKIPPED' as const },
        });
        continue;
      }

      const [inboundHistory, outboundHistory] = await Promise.all([
        getFlightHistoryWithCache(inbound.flightNumber),
        getFlightHistoryWithCache(outbound.flightNumber),
      ]);

      const analysis = calculateSuccessRate(
        inboundHistory.history,
        outboundHistory.history,
        connectionWindowMinutes,
        mct,
      );

      connections.push({
        ...analysis,
        airport,
        airportName,
        inboundFlightIdent: inbound.flightNumber,
        outboundFlightIdent: outbound.flightNumber,
        cacheStatus: {
          inbound: inboundHistory.cacheStatus,
          outbound: outboundHistory.cacheStatus,
        },
      });
    }

    const payload = responseSchema.parse({
      connections,
      attribution: 'Data powered by FlightAware',
    });

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid connection analysis input', issues: error.issues }, { status: 400 });
    }

    if (error instanceof FlightAwareConfigurationError) {
      console.error('Connection analysis configuration error:', error.message);
      return NextResponse.json({ error: 'Historical connection analysis is temporarily unavailable' }, { status: 503 });
    }

    if (error instanceof FlightAwareFetchError) {
      console.error('FlightAware historical lookup failed:', { status: error.status, message: error.message });
      return NextResponse.json({ error: 'Historical flight data is temporarily unavailable' }, { status: 502 });
    }

    console.error('Connection analysis failed:', error);
    return NextResponse.json({ error: 'Unable to analyze connection history' }, { status: 500 });
  }
}

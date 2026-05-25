// app/api/playbook/generate/route.ts
// POST /api/playbook/generate
// Generates (or regenerates) a DisruptionPlaybook for a MonitoredTrip.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { generatePlaybook, PLAYBOOK_DISCLAIMER } from '@/lib/playbook/generator';
import type { PlaybookResponse } from '@/lib/playbook/types';

/** Safely serialise any typed object to a Prisma-compatible Json value. */
function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

// ─── Zod schema ───────────────────────────────────────────────────────────────

const LegSchema = z.object({
  flightNumber: z.string().min(2).max(10),
  origin: z.string().length(3),
  destination: z.string().length(3),
  carrier: z.string().min(2).max(3),
  scheduledDep: z.string().datetime({ offset: true }).or(z.string().min(10)),
  connectionWindowMinutes: z.number().int().positive().optional(),
});

const GeneratePlaybookSchema = z.object({
  monitoredTripId: z.string().cuid(),
  legs: z.array(LegSchema).min(1).max(10),
});

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = GeneratePlaybookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const { monitoredTripId, legs } = parsed.data;

  // Verify the trip exists
  const trip = await prisma.monitoredTrip.findUnique({
    where: { id: monitoredTripId },
    select: { id: true },
  });
  if (!trip) {
    return NextResponse.json(
      { error: `MonitoredTrip ${monitoredTripId} not found` },
      { status: 404 },
    );
  }

  // Generate the playbook (pure logic, no DB)
  const { airline, regulationZone, connectionCount, scenarios } =
    generatePlaybook({ legs });

  // Upsert — safe to call multiple times (regenerate button)
  const scenarioAJson = toJson(scenarios.missedConnection);
  const scenarioBJson = toJson(scenarios.significantDelay);
  const scenarioCJson = toJson(scenarios.cancellation);

  const record = await prisma.disruptionPlaybook.upsert({
    where: { monitoredTripId },
    create: {
      monitoredTripId,
      scenarioA: scenarioAJson,
      scenarioB: scenarioBJson,
      scenarioC: scenarioCJson,
      airlineIata: airline.iataCode,
      regulationZone,
      connectionCount,
    },
    update: {
      scenarioA: scenarioAJson,
      scenarioB: scenarioBJson,
      scenarioC: scenarioCJson,
      airlineIata: airline.iataCode,
      regulationZone,
      connectionCount,
      generatedAt: new Date(),
    },
  });

  const response: PlaybookResponse = {
    playbookId: record.id,
    airline,
    regulationZone,
    scenarios,
    generatedAt: record.generatedAt.toISOString(),
    disclaimer: PLAYBOOK_DISCLAIMER,
  };

  return NextResponse.json(response, { status: 200 });
}

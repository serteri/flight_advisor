// app/api/playbook/[monitoredTripId]/route.ts
// GET /api/playbook/:monitoredTripId
// Returns an existing DisruptionPlaybook or 404.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAirlinePolicy } from '@/lib/playbook/airlinePolicies';
import { PLAYBOOK_DISCLAIMER } from '@/lib/playbook/generator';
import type {
  PlaybookResponse,
  PlaybookScenarios,
  ScenarioCard,
} from '@/lib/playbook/types';

interface RouteParams {
  params: Promise<{ monitoredTripId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { monitoredTripId } = await params;

  if (!monitoredTripId) {
    return NextResponse.json({ error: 'Missing monitoredTripId' }, { status: 400 });
  }

  const record = await prisma.disruptionPlaybook.findUnique({
    where: { monitoredTripId },
  });

  if (!record) {
    return NextResponse.json(
      { error: `No playbook found for trip ${monitoredTripId}` },
      { status: 404 },
    );
  }

  const airline = getAirlinePolicy(record.airlineIata);

  // Deserialise JSON columns back to typed objects.
  // The DB stores `{}` when scenarioA is null (direct flight).
  const scenarioA = record.scenarioA as Record<string, unknown>;
  const missedConnection: ScenarioCard | null =
    Object.keys(scenarioA).length > 0 ? (scenarioA as unknown as ScenarioCard) : null;

  const scenarios: PlaybookScenarios = {
    missedConnection,
    significantDelay: record.scenarioB as unknown as ScenarioCard,
    cancellation: record.scenarioC as unknown as ScenarioCard,
  };

  const response: PlaybookResponse = {
    playbookId: record.id,
    airline,
    regulationZone: record.regulationZone,
    scenarios,
    generatedAt: record.generatedAt.toISOString(),
    disclaimer: PLAYBOOK_DISCLAIMER,
  };

  return NextResponse.json(response, { status: 200 });
}

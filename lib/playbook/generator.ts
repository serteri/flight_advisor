// lib/playbook/generator.ts
// Pure, server-side playbook generation logic.
// No DB access here — keeps the generator testable in isolation.

import { determineRegulationZone } from '@/lib/compensation/regulations';
import type { RegulationZone } from '@/lib/compensation/regulations';
import { getAirlinePolicy } from './airlinePolicies';
import type {
  AirlinePolicy,
  LegInput,
  PlaybookScenarios,
  PlaybookStep,
  ScenarioCard,
} from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function regulationNote(zone: RegulationZone): string | null {
  switch (zone) {
    case 'EU261':
      return 'EU Regulation 261/2004 applies to this itinerary. You may be entitled to cash compensation, care, and rebooking rights.';
    case 'UK261':
      return 'UK261 (retained EU law) applies to this itinerary. Rights mirror EU261 with GBP compensation amounts.';
    case 'DGCA':
      return 'Australian Consumer Law / DGCA guidelines apply. Cash compensation is not mandated, but airlines must provide care (meals, hotel, rebooking).';
    case 'NONE':
      return null;
  }
}

function compensationLinked(zone: RegulationZone): boolean {
  return zone === 'EU261' || zone === 'UK261';
}

// ─── Scenario A — Missed Connection ──────────────────────────────────────────

function buildMissedConnectionScenario(
  airline: AirlinePolicy,
  zone: RegulationZone,
  connectionWindowMinutes?: number,
): ScenarioCard {
  const windowNote =
    connectionWindowMinutes != null
      ? ` (your connection window is ${connectionWindowMinutes} minutes)`
      : '';

  const steps: PlaybookStep[] = [
    {
      order: 1,
      action: `Go directly to the ${airline.missedConnectionDesk}`,
      detail: `Do NOT attempt to rebook yourself at the departure gate${windowNote}. The ${airline.missedConnectionDesk} has authority to issue a new boarding pass on your existing ticket.`,
      doThis: true,
      timeContext: 'Immediately upon landing',
    },
    {
      order: 2,
      action: 'Do NOT exit the secure/airside area',
      detail:
        'If you exit security before speaking to an airline agent you may lose your involuntary reroute rights and face additional costs.',
      doThis: false,
      timeContext: null,
    },
    {
      order: 3,
      action: 'Request involuntary rerouting on your existing ticket',
      detail:
        'Ask the agent: "I have an involuntary misconnect — please rebook me on the next available service at no charge." This is your right when the inbound delay is the airline\'s responsibility.',
      doThis: true,
      timeContext: 'At the transfer desk',
    },
    {
      order: 4,
      action: 'Request hotel + meal voucher if same-day travel is not possible',
      detail:
        zone !== 'NONE'
          ? 'Under applicable passenger rights law the airline must provide meals and overnight accommodation while you wait.'
          : 'Ask for care; most airlines will provide meals and a hotel as goodwill even without a regulatory obligation.',
      doThis: true,
      timeContext: 'If no same-day flight is available',
    },
    {
      order: 5,
      action: 'Document everything',
      detail:
        'Photograph the departure board showing the delay, keep all meal/hotel receipts, and get the rebooking confirmation in writing (email or printed boarding pass).',
      doThis: true,
      timeContext: null,
    },
    {
      order: 6,
      action: `Use ${airline.name} app or call ${airline.rebookingPhone} if no desk agent is available`,
      detail: airline.appName
        ? `The ${airline.appName} app may offer self-service rebooking options.`
        : `Call ${airline.rebookingPhone} directly.`,
      doThis: true,
      timeContext: 'If desk queues are excessive',
    },
  ];

  return {
    scenarioType: 'MISSED_CONNECTION',
    triggerDescription:
      'Your inbound flight is delayed and you will miss (or have missed) your onward connection.',
    steps,
    airlineSpecificNote: airline.notes,
    regulationNote: regulationNote(zone),
    compensationLinked: compensationLinked(zone),
    urgencyLevel: 'HIGH',
  };
}

// ─── Scenario B — Significant Delay ─────────────────────────────────────────

function buildSignificantDelayScenario(
  airline: AirlinePolicy,
  zone: RegulationZone,
): ScenarioCard {
  const isRegulated = zone === 'EU261' || zone === 'UK261';
  const isDGCA = zone === 'DGCA';
  const currency = zone === 'UK261' ? 'GBP' : 'EUR';

  const steps: PlaybookStep[] = [
    {
      order: 1,
      action: 'Confirm the delay duration at the gate or on the app',
      detail: `Use the ${airline.appName ?? airline.name + ' website'} or check the departure board. Delay duration determines your rights.`,
      doThis: true,
      timeContext: 'As soon as delay is announced',
    },
    {
      order: 2,
      action: 'At 2-hour delay: request meals and refreshments',
      detail: isRegulated
        ? `The airline is legally required to provide meals/refreshments under ${zone}.`
        : isDGCA
          ? 'Airlines are expected to provide care under Australian Consumer Law — ask the gate agent.'
          : 'Ask the gate agent for a meal voucher; most airlines provide this as standard.',
      doThis: true,
      timeContext: 'At the 2-hour mark',
    },
    {
      order: 3,
      action: 'Save all receipts for meals and expenses',
      detail:
        'If vouchers are not offered, purchase meals yourself and keep receipts. These can be claimed back.',
      doThis: true,
      timeContext: null,
    },
    {
      order: 4,
      action: 'At 5-hour delay: you have the right to a full refund if you choose not to travel',
      detail: isRegulated
        ? `Under ${zone}, a 5-hour delay entitles you to a full ticket refund if you decide not to fly. Ask the agent or submit via Manage Booking.`
        : 'Check your fare conditions and travel insurance policy for refund rights.',
      doThis: true,
      timeContext: 'At the 5-hour mark (if applicable)',
    },
    {
      order: 5,
      action: isRegulated
        ? `At 3h+ arrival delay: compensation of up to ${currency} 600 may be owed`
        : 'Check if compensation is owed',
      detail: isRegulated
        ? `Under ${zone}, a 3h+ arrival delay may trigger cash compensation. Extraordinary circumstances (weather, ATC strike) exempt the airline.`
        : 'Check your travel insurance and the airline\'s own delay compensation policy.',
      doThis: true,
      timeContext: 'After travel — via claim process',
    },
    {
      order: 6,
      action: 'Check travel insurance for additional coverage',
      detail:
        'Some policies cover accommodation, meals, or consequential losses not covered by airline regulation. Submit claims promptly.',
      doThis: true,
      timeContext: null,
    },
  ];

  return {
    scenarioType: 'SIGNIFICANT_DELAY',
    triggerDescription: 'Your flight is delayed by 2 hours or more.',
    steps,
    airlineSpecificNote: airline.notes,
    regulationNote: regulationNote(zone),
    compensationLinked: isRegulated,
    urgencyLevel: 'MEDIUM',
  };
}

// ─── Scenario C — Cancellation ────────────────────────────────────────────────

function buildCancellationScenario(
  airline: AirlinePolicy,
  zone: RegulationZone,
): ScenarioCard {
  const isRegulated = zone === 'EU261' || zone === 'UK261';
  const currency = zone === 'UK261' ? 'GBP' : 'EUR';

  const steps: PlaybookStep[] = [
    {
      order: 1,
      action: 'Choose: rerouting OR full refund',
      detail: isRegulated
        ? `Under ${zone}, a cancellation entitles you to either (a) a full refund of all unused flight portions or (b) rebooking on the next available service at no charge. You choose.`
        : 'Request either a full refund or rebooking. Document the airline\'s response.',
      doThis: true,
      timeContext: 'Immediately upon cancellation notice',
    },
    {
      order: 2,
      action: `Contact ${airline.name} directly — do NOT wait in gate queues`,
      detail: `Call ${airline.rebookingPhone} or use ${airline.rebookingUrl}. Phone and app queues are often faster than physical desks during mass cancellations.`,
      doThis: true,
      timeContext: 'As soon as possible',
    },
    {
      order: 3,
      action: isRegulated
        ? `If notified less than 14 days before departure: compensation up to ${currency} 600 may be owed`
        : 'Check if compensation applies',
      detail: isRegulated
        ? `Under ${zone}, cancellations notified < 14 days before departure entitle you to cash compensation (subject to route distance and extraordinary circumstances).`
        : 'Check your travel insurance policy and the airline\'s own cancellation terms.',
      doThis: true,
      timeContext: 'Via claim process after travel',
    },
    {
      order: 4,
      action: 'Do NOT accept vouchers without reading the full conditions',
      detail:
        'Vouchers (travel credits) may have expiry dates, restricted routes, or conditions that diminish their value compared to a cash refund. Ask for cash/card refund first.',
      doThis: false,
      timeContext: null,
    },
    {
      order: 5,
      action: 'Request meal and hotel care if stranded overnight',
      detail: isRegulated
        ? `${zone} requires the airline to provide meals and accommodation while you wait for a rerouting flight.`
        : 'Ask the airline for care; most will provide meals/hotel under their own policies.',
      doThis: true,
      timeContext: 'If rerouting is not same-day',
    },
    {
      order: 6,
      action: 'Keep all documentation',
      detail:
        'Screenshot the cancellation notification (with timestamp), keep all receipts, and get any voucher/refund offer in writing.',
      doThis: true,
      timeContext: null,
    },
  ];

  return {
    scenarioType: 'CANCELLATION',
    triggerDescription: 'Your flight has been cancelled.',
    steps,
    airlineSpecificNote: airline.notes,
    regulationNote: regulationNote(zone),
    compensationLinked: isRegulated,
    urgencyLevel: 'HIGH',
  };
}

// ─── Main generator ───────────────────────────────────────────────────────────

export interface GeneratorInput {
  legs: LegInput[];
}

export interface GeneratorOutput {
  airline: AirlinePolicy;
  regulationZone: RegulationZone;
  connectionCount: number;
  scenarios: PlaybookScenarios;
}

/**
 * Pure function that builds a full playbook from flight leg data.
 * Does not touch the database.
 */
export function generatePlaybook(input: GeneratorInput): GeneratorOutput {
  const { legs } = input;

  if (legs.length === 0) {
    throw new Error('generatePlaybook: at least one leg is required');
  }

  // Use first leg's carrier for airline policy lookup
  const primaryCarrier = legs[0].carrier.trim().toUpperCase();
  const airline = getAirlinePolicy(primaryCarrier);

  // Determine regulation zone from first leg (origin → destination, carrier)
  const zone = determineRegulationZone({
    origin: legs[0].origin,
    destination: legs[legs.length - 1].destination,
    carrier: primaryCarrier,
  });

  const connectionCount = Math.max(0, legs.length - 1);
  const connectionWindowMinutes =
    connectionCount > 0 ? legs[0].connectionWindowMinutes : undefined;

  const scenarios: PlaybookScenarios = {
    missedConnection:
      connectionCount > 0
        ? buildMissedConnectionScenario(airline, zone, connectionWindowMinutes)
        : null,
    significantDelay: buildSignificantDelayScenario(airline, zone),
    cancellation: buildCancellationScenario(airline, zone),
  };

  return { airline, regulationZone: zone, connectionCount, scenarios };
}

export const PLAYBOOK_DISCLAIMER =
  'This playbook is generated based on general airline policies and applicable ' +
  'regulations at time of generation. Policies may change without notice. ' +
  'This is not legal advice. Always verify current policies directly with your airline.';

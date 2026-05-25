// lib/playbook/types.ts

export type ScenarioType =
  | 'MISSED_CONNECTION'
  | 'SIGNIFICANT_DELAY'
  | 'CANCELLATION';

export type UrgencyLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface PlaybookStep {
  order: number;
  /** What the passenger should do (or avoid). */
  action: string;
  /** Additional context or explanation. */
  detail: string | null;
  /** true = "DO this", false = "AVOID this". */
  doThis: boolean;
  /** Optional time window, e.g. "within 30 min" or "at 2-hour mark". */
  timeContext: string | null;
}

export interface ScenarioCard {
  scenarioType: ScenarioType;
  triggerDescription: string;
  steps: PlaybookStep[];
  /** Airline-specific tip, null for generic fallback. */
  airlineSpecificNote: string | null;
  /** Regulation note, null when regulation zone is NONE. */
  regulationNote: string | null;
  /** Whether EU261/UK261 compensation may apply for this scenario. */
  compensationLinked: boolean;
  urgencyLevel: UrgencyLevel;
}

export interface AirlinePolicy {
  iataCode: string;
  name: string;
  /** International customer-service / disruption phone number. */
  rebookingPhone: string;
  /** Self-service manage/rebook URL. */
  rebookingUrl: string;
  /** Official mobile app name, null if none. */
  appName: string | null;
  /** Alliance lounge access: "Star Alliance" | "OneWorld" | "SkyTeam" | null */
  loungeAlliance: string | null;
  /** Where to go at airport: "Transfer Desk" | "Any Gate Agent" | "App Only" */
  missedConnectionDesk: string;
  /** Airline-specific quirks or tips, null if none. */
  notes: string | null;
}

// ─── API I/O types ────────────────────────────────────────────────────────────

export interface LegInput {
  flightNumber: string;
  origin: string;
  destination: string;
  carrier: string;
  scheduledDep: string; // ISO-8601
  connectionWindowMinutes?: number;
}

export interface GeneratePlaybookInput {
  monitoredTripId: string;
  legs: LegInput[];
}

export interface PlaybookScenarios {
  /** null when the itinerary has no connections (direct flight). */
  missedConnection: ScenarioCard | null;
  significantDelay: ScenarioCard;
  cancellation: ScenarioCard;
}

export interface PlaybookResponse {
  playbookId: string;
  airline: AirlinePolicy;
  regulationZone: string;
  scenarios: PlaybookScenarios;
  generatedAt: string; // ISO-8601
  disclaimer: string;
}

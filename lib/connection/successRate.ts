export type FlightRecord = {
  ident: string;
  scheduled_out: string | null;
  actual_out: string | null;
  scheduled_in: string | null;
  actual_in: string | null;
  cancelled?: boolean | null;
};

export type ConnectionRiskLevel = 'SAFE' | 'RISKY' | 'CRITICAL' | 'UNKNOWN';

export type ConnectionAnalysis = {
  airport: string;
  connectionWindowMinutes: number;
  mct: number;
  inboundFlightIdent: string;
  outboundFlightIdent: string;
  inboundOnTimeRate: number;
  outboundOnTimeRate: number;
  successRate: number;
  riskLevel: ConnectionRiskLevel;
  sampleSize: number;
  recommendation: string;
  dataNote: string;
  mctViolation?: boolean;
  inboundSampleSize: number;
  outboundSampleSize: number;
};

const ON_TIME_THRESHOLD_MINUTES = 15;
const GATE_CLOSE_BUFFER_MINUTES = 10;

const parseTime = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const minutesBetween = (later: Date, earlier: Date): number => {
  return Math.round((later.getTime() - earlier.getTime()) / 60000);
};

const dateKey = (date: Date): string => {
  return date.toISOString().slice(0, 10);
};

const roundRate = (value: number): number => Math.round(value * 10) / 10;

export const calculateArrivalOnTimeRate = (history: FlightRecord[]): number => {
  const usable = history.filter((flight) => !flight.cancelled && parseTime(flight.scheduled_in) && parseTime(flight.actual_in));
  if (!usable.length) return 0;

  const onTime = usable.filter((flight) => {
    const scheduled = parseTime(flight.scheduled_in);
    const actual = parseTime(flight.actual_in);
    return Boolean(scheduled && actual && minutesBetween(actual, scheduled) <= ON_TIME_THRESHOLD_MINUTES);
  }).length;

  return roundRate((onTime / usable.length) * 100);
};

export const calculateDepartureOnTimeRate = (history: FlightRecord[]): number => {
  const usable = history.filter((flight) => !flight.cancelled && parseTime(flight.scheduled_out) && parseTime(flight.actual_out));
  if (!usable.length) return 0;

  const onTime = usable.filter((flight) => {
    const scheduled = parseTime(flight.scheduled_out);
    const actual = parseTime(flight.actual_out);
    return Boolean(scheduled && actual && minutesBetween(actual, scheduled) <= ON_TIME_THRESHOLD_MINUTES);
  }).length;

  return roundRate((onTime / usable.length) * 100);
};

const riskFromRate = (successRate: number): ConnectionRiskLevel => {
  if (successRate >= 80) return 'SAFE';
  if (successRate >= 60) return 'RISKY';
  return 'CRITICAL';
};

const recommendationFor = (riskLevel: ConnectionRiskLevel, mctViolation: boolean): string => {
  if (mctViolation) {
    return 'This connection is below the published minimum connection time used by FlightAgent. Choose a longer layover or a protected same-ticket alternative.';
  }

  if (riskLevel === 'SAFE') {
    return 'Historical timing patterns suggest this connection has a strong chance of working, assuming normal airport operations.';
  }

  if (riskLevel === 'RISKY') {
    return 'This connection has a meaningful failure risk in recent history. Prefer more buffer if checked baggage, immigration, or terminal changes are involved.';
  }

  if (riskLevel === 'CRITICAL') {
    return 'Recent historical timing suggests this connection is fragile. A longer layover is strongly recommended.';
  }

  return 'There is not enough historical data to estimate this connection reliably.';
};

export function calculateSuccessRate(
  inboundHistory: FlightRecord[],
  outboundHistory: FlightRecord[],
  connectionWindowMinutes: number,
  mct: number,
): ConnectionAnalysis {
  const inboundIdent = inboundHistory[0]?.ident ?? 'UNKNOWN';
  const outboundIdent = outboundHistory[0]?.ident ?? 'UNKNOWN';
  const inboundOnTimeRate = calculateArrivalOnTimeRate(inboundHistory);
  const outboundOnTimeRate = calculateDepartureOnTimeRate(outboundHistory);
  const mctViolation = connectionWindowMinutes < mct;

  const outboundByDate = new Map<string, FlightRecord>();
  for (const outbound of outboundHistory) {
    const scheduledOut = parseTime(outbound.scheduled_out);
    if (scheduledOut) outboundByDate.set(dateKey(scheduledOut), outbound);
  }

  let totalPairs = 0;
  let connectionsMade = 0;

  for (const inbound of inboundHistory) {
    if (inbound.cancelled) continue;
    const scheduledIn = parseTime(inbound.scheduled_in);
    const actualIn = parseTime(inbound.actual_in);
    if (!scheduledIn || !actualIn) continue;

    const outbound = outboundByDate.get(dateKey(scheduledIn));
    if (!outbound || outbound.cancelled) continue;

    const scheduledOut = parseTime(outbound.scheduled_out);
    if (!scheduledOut) continue;

    const inboundDelay = minutesBetween(actualIn, scheduledIn);
    const effectiveDeparture = new Date(scheduledOut.getTime() - GATE_CLOSE_BUFFER_MINUTES * 60000);
    const projectedReadyAt = new Date(scheduledIn.getTime() + (inboundDelay + connectionWindowMinutes) * 60000);

    totalPairs += 1;
    if (projectedReadyAt < effectiveDeparture) {
      connectionsMade += 1;
    }
  }

  if (!totalPairs) {
    return {
      airport: '',
      connectionWindowMinutes,
      mct,
      inboundFlightIdent: inboundIdent,
      outboundFlightIdent: outboundIdent,
      inboundOnTimeRate,
      outboundOnTimeRate,
      successRate: 0,
      riskLevel: 'UNKNOWN',
      sampleSize: 0,
      recommendation: recommendationFor('UNKNOWN', mctViolation),
      dataNote: 'Insufficient historical data for this route',
      mctViolation,
      inboundSampleSize: inboundHistory.length,
      outboundSampleSize: outboundHistory.length,
    };
  }

  const successRate = mctViolation ? 0 : roundRate((connectionsMade / totalPairs) * 100);
  const riskLevel = mctViolation ? 'CRITICAL' : riskFromRate(successRate);

  return {
    airport: '',
    connectionWindowMinutes,
    mct,
    inboundFlightIdent: inboundIdent,
    outboundFlightIdent: outboundIdent,
    inboundOnTimeRate,
    outboundOnTimeRate,
    successRate,
    riskLevel,
    sampleSize: totalPairs,
    recommendation: recommendationFor(riskLevel, mctViolation),
    dataNote: 'Based on last 30 days of flight history from FlightAware',
    mctViolation,
    inboundSampleSize: inboundHistory.length,
    outboundSampleSize: outboundHistory.length,
  };
}

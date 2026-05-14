import { AlertTriangle } from 'lucide-react';
import type { ConnectionAnalysis, ConnectionRiskLevel } from '@/lib/connection/successRate';
import { cn } from '@/lib/utils';
import { ConnectionRiskBadge } from './ConnectionRiskBadge';
import { ConnectionRiskCard } from './ConnectionRiskCard';

export type ConnectionLegView = {
  flightNumber: string;
  origin: string;
  destination: string;
  scheduledDep: string;
  scheduledArr: string;
};

export type ItineraryConnectionSummaryProps = {
  legs: ConnectionLegView[];
  connections: Array<ConnectionAnalysis & { airportName?: string }>;
  className?: string;
};

const riskRank: Record<ConnectionRiskLevel, number> = {
  SAFE: 1,
  UNKNOWN: 2,
  RISKY: 3,
  CRITICAL: 4,
};

const getWorstRisk = (connections: ItineraryConnectionSummaryProps['connections']): ConnectionRiskLevel => {
  if (!connections.length) return 'UNKNOWN';
  return connections.reduce<ConnectionRiskLevel>((worst, connection) => {
    return riskRank[connection.riskLevel] > riskRank[worst] ? connection.riskLevel : worst;
  }, 'SAFE');
};

export function ItineraryConnectionSummary({ legs, connections, className }: ItineraryConnectionSummaryProps) {
  const worstRisk = getWorstRisk(connections);
  const hasCritical = connections.some((connection) => connection.riskLevel === 'CRITICAL');
  const routeCodes = legs.length
    ? [legs[0].origin, ...legs.map((leg) => leg.destination)]
    : [];

  return (
    <section className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Connection historical success rate</h3>
          <p className="text-sm text-slate-500">Historical analysis only. No live operational status is implied.</p>
        </div>
        <ConnectionRiskBadge riskLevel={worstRisk} />
      </div>

      {hasCritical && (
        <div className="flex gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            At least one connection is critical. Review the weakest connection before booking or relying on this itinerary.
          </p>
        </div>
      )}

      {routeCodes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700">
          {routeCodes.map((code, index) => (
            <span key={`${code}-${index}`} className="inline-flex items-center gap-2">
              <span className="rounded-md bg-slate-100 px-2 py-1">{code}</span>
              {index < routeCodes.length - 1 && (
                <span className={connections[index]?.riskLevel === 'CRITICAL' ? 'text-red-600' : 'text-slate-400'}>
                  {connections[index]?.riskLevel === 'CRITICAL' ? '-- ! -->' : '-- flight -->'}
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {connections.map((connection) => (
          <ConnectionRiskCard
            key={`${connection.inboundFlightIdent}-${connection.outboundFlightIdent}-${connection.airport}`}
            analysis={connection}
          />
        ))}
      </div>

      <p className="text-xs text-slate-500">
        Data powered by FlightAware. FlightAgent uses cached historical records where available to reduce API usage.
      </p>
    </section>
  );
}

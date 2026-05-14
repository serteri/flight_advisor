import { AIRLINE_ZONES, getAirlineAcceptanceRate } from '@/lib/compensation/airlineZones';
import { cn } from '@/lib/utils';

export type AirlineClaimHistoryProps = {
  carrier: string;
  className?: string;
};

export function AirlineClaimHistory({ carrier, className }: AirlineClaimHistoryProps) {
  const normalizedCarrier = carrier.trim().toUpperCase();
  const rate = getAirlineAcceptanceRate(normalizedCarrier);
  const percent = rate === null ? null : Math.round(rate * 100);
  const carrierKnown = AIRLINE_ZONES[normalizedCarrier];

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Airline claim history</p>
          <p className="text-xs text-slate-500">
            Static MVP benchmark, not a live airline acceptance feed.
          </p>
        </div>
        <span className="text-sm font-bold text-slate-900">{percent === null ? 'N/A' : `${percent}%`}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div
          className="h-2 rounded-full bg-slate-900"
          style={{ width: `${percent ?? 0}%` }}
        />
      </div>
      <p className="text-xs text-slate-500">
        {carrierKnown
          ? `${normalizedCarrier} historical acceptance estimate based on static FlightAgent MVP data.`
          : 'No static acceptance estimate is available for this carrier yet.'}
      </p>
    </div>
  );
}

import { cn } from '@/lib/utils';
import type { ConnectionRiskLevel } from '@/lib/connection/successRate';

export type ConnectionRiskBadgeProps = {
  riskLevel: ConnectionRiskLevel;
  className?: string;
};

const badgeStyles: Record<ConnectionRiskLevel, string> = {
  SAFE: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  RISKY: 'border-amber-200 bg-amber-50 text-amber-800',
  CRITICAL: 'border-red-200 bg-red-50 text-red-800',
  UNKNOWN: 'border-slate-200 bg-slate-50 text-slate-600',
};

export function ConnectionRiskBadge({ riskLevel, className }: ConnectionRiskBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex min-h-7 items-center rounded-md border px-2.5 text-xs font-bold',
        badgeStyles[riskLevel],
        className,
      )}
    >
      {riskLevel}
    </span>
  );
}

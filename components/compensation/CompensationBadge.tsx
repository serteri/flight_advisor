import { cn } from '@/lib/utils';

export type CompensationBadgeStatus = 'ELIGIBLE' | 'MONITORING' | 'NOT_ELIGIBLE' | 'UNKNOWN';

export type CompensationBadgeProps = {
  status: CompensationBadgeStatus;
  amount?: number | null;
  currency?: 'EUR' | 'GBP' | 'AUD' | null;
  onClick?: () => void;
  className?: string;
};

const styles: Record<CompensationBadgeStatus, string> = {
  ELIGIBLE: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  MONITORING: 'border-amber-200 bg-amber-50 text-amber-800',
  NOT_ELIGIBLE: 'border-slate-200 bg-slate-50 text-slate-600',
  UNKNOWN: 'border-slate-200 bg-slate-50 text-slate-600',
};

const labels: Record<CompensationBadgeStatus, string> = {
  ELIGIBLE: 'Compensation estimate',
  MONITORING: 'Monitoring eligibility',
  NOT_ELIGIBLE: 'Not eligible',
  UNKNOWN: 'Eligibility unknown',
};

export function CompensationBadge({
  status,
  amount,
  currency,
  onClick,
  className,
}: CompensationBadgeProps) {
  const value = status === 'ELIGIBLE' && amount ? ` ${currency ?? 'EUR'} ${amount}` : '';
  const content = `${labels[status]}${value}`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'inline-flex min-h-8 items-center rounded-md border px-3 text-xs font-semibold transition hover:shadow-sm',
          styles[status],
          className,
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex min-h-8 items-center rounded-md border px-3 text-xs font-semibold',
        styles[status],
        className,
      )}
    >
      {content}
    </span>
  );
}

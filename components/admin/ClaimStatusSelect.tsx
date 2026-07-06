'use client';

import { useState, useTransition } from 'react';

type AdminClaimStatus =
  | 'PENDING'
  | 'SUBMITTED'
  | 'LEGAL_REVIEW'
  | 'AIRLINE_CONTACTED'
  | 'SETTLED'
  | 'REJECTED';

const STATUS_OPTIONS: AdminClaimStatus[] = [
  'PENDING',
  'SUBMITTED',
  'LEGAL_REVIEW',
  'AIRLINE_CONTACTED',
  'SETTLED',
  'REJECTED',
];

type ClaimStatusSelectProps = {
  claimId: string;
  initialStatus: AdminClaimStatus;
};

export function ClaimStatusSelect({ claimId, initialStatus }: ClaimStatusSelectProps) {
  const [status, setStatus] = useState<AdminClaimStatus>(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleChange = (nextStatus: AdminClaimStatus) => {
    const previousStatus = status;
    setStatus(nextStatus);
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/claims/${claimId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
        });

        if (!response.ok) {
          throw new Error('Status update failed');
        }
      } catch {
        setStatus(previousStatus);
        setError('Update failed');
      }
    });
  };

  return (
    <div className="space-y-1">
      <select
        className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 outline-none focus:border-sky-500"
        value={status}
        onChange={(event) => handleChange(event.target.value as AdminClaimStatus)}
        disabled={isPending}
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  );
}

'use client';

import { useState, useCallback } from 'react';
import { RefreshCw, Printer, AlertCircle, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PlaybookCard } from './PlaybookCard';
import type { PlaybookResponse } from '@/lib/playbook/types';

// ─── Stale threshold ──────────────────────────────────────────────────────────
const STALE_DAYS = 7;

function isStale(generatedAt: string): boolean {
  const diffMs = Date.now() - new Date(generatedAt).getTime();
  return diffMs > STALE_DAYS * 24 * 60 * 60 * 1000;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

interface PlaybookDashboardProps {
  playbook: PlaybookResponse;
  /** Called when user clicks "Regenerate". Parent re-fetches / passes new data. */
  onRegenerate?: () => Promise<void>;
  flightLabel?: string; // e.g. "TK54 · IST → LHR"
  className?: string;
}

export function PlaybookDashboard({
  playbook,
  onRegenerate,
  flightLabel,
  className,
}: PlaybookDashboardProps) {
  const [regenerating, setRegenerating] = useState(false);

  const stale = isStale(playbook.generatedAt);

  const handleRegenerate = useCallback(async () => {
    if (!onRegenerate) return;
    setRegenerating(true);
    try {
      await onRegenerate();
    } finally {
      setRegenerating(false);
    }
  }, [onRegenerate]);

  const handlePrint = () => window.print();

  const { scenarios, airline, disclaimer, generatedAt } = playbook;

  return (
    <div className={cn('space-y-4', className)}>
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <BookOpen className="w-5 h-5 text-slate-700" />
            <h2 className="text-xl font-bold text-slate-900">
              Your Disruption Playbook
            </h2>
          </div>
          <p className="text-sm text-slate-500">
            {airline.name}
            {flightLabel ? ` · ${flightLabel}` : ''}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Generated {formatDate(generatedAt)} · Valid for this itinerary
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 print:hidden">
          {onRegenerate && (
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={regenerating}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', regenerating && 'animate-spin')} />
              {regenerating ? 'Regenerating…' : 'Regenerate'}
            </button>
          )}
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
        </div>
      </div>

      {/* ── Stale warning banner ── */}
      {stale && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 print:hidden">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Update available.</span> This playbook was
            generated more than {STALE_DAYS} days ago. Airline policies may have changed —
            consider regenerating.
          </p>
        </div>
      )}

      {/* ── Scenario cards ── */}
      <div className="space-y-3">
        {scenarios.missedConnection && (
          <PlaybookCard
            scenario={scenarios.missedConnection}
            airline={airline}
          />
        )}
        <PlaybookCard
          scenario={scenarios.significantDelay}
          airline={airline}
        />
        <PlaybookCard
          scenario={scenarios.cancellation}
          airline={airline}
        />
      </div>

      {/* ── Disclaimer ── */}
      <p className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-100 pt-3">
        {disclaimer} Last updated: {formatDate(generatedAt)}.
      </p>
    </div>
  );
}

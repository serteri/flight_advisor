'use client';

import { useState, useEffect, useCallback } from 'react';
import { BookOpen, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PlaybookDashboard } from './PlaybookDashboard';
import type { LegInput, PlaybookResponse } from '@/lib/playbook/types';

// ─── Stale threshold (matches PlaybookDashboard) ──────────────────────────────
const STALE_DAYS = 7;

function isStale(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() > STALE_DAYS * 24 * 60 * 60 * 1000;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface PlaybookTriggerButtonProps {
  /** The MonitoredTrip ID — used for GET /api/playbook/:id */
  monitoredTripId: string;
  /**
   * Legs data needed to call POST /api/playbook/generate when no playbook
   * exists yet (or when user requests regeneration).
   */
  legs: LegInput[];
  /** Optional label shown next to the button. */
  flightLabel?: string;
  className?: string;
}

type FetchState = 'idle' | 'loading' | 'error';

export function PlaybookTriggerButton({
  monitoredTripId,
  legs,
  flightLabel,
  className,
}: PlaybookTriggerButtonProps) {
  const [open, setOpen] = useState(false);
  const [playbook, setPlaybook] = useState<PlaybookResponse | null>(null);
  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const [stale, setStale] = useState(false);

  // ── Fetch helpers ──────────────────────────────────────────────────────────

  const fetchExisting = useCallback(async (): Promise<PlaybookResponse | null> => {
    const res = await fetch(`/api/playbook/${monitoredTripId}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Failed to fetch playbook');
    return res.json() as Promise<PlaybookResponse>;
  }, [monitoredTripId]);

  const generate = useCallback(async (): Promise<PlaybookResponse> => {
    const res = await fetch('/api/playbook/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monitoredTripId, legs }),
    });
    if (!res.ok) throw new Error('Failed to generate playbook');
    return res.json() as Promise<PlaybookResponse>;
  }, [monitoredTripId, legs]);

  const loadPlaybook = useCallback(async () => {
    setFetchState('loading');
    try {
      let data = await fetchExisting();
      if (!data) {
        // No playbook yet — generate one on demand
        data = await generate();
      }
      setPlaybook(data);
      setStale(isStale(data.generatedAt));
      setFetchState('idle');
    } catch {
      setFetchState('error');
    }
  }, [fetchExisting, generate]);

  const handleRegenerate = useCallback(async () => {
    const data = await generate();
    setPlaybook(data);
    setStale(isStale(data.generatedAt));
  }, [generate]);

  // ── Load when modal opens ──────────────────────────────────────────────────

  useEffect(() => {
    if (open && !playbook) {
      void loadPlaybook();
    }
  }, [open, playbook, loadPlaybook]);

  // ─── Button label ──────────────────────────────────────────────────────────

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition',
          stale && playbook
            ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
            : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
          className,
        )}
      >
        {stale && playbook ? (
          <AlertTriangle className="w-3.5 h-3.5" />
        ) : (
          <BookOpen className="w-3.5 h-3.5" />
        )}
        {stale && playbook ? '⚠ Update available' : 'View Playbook'}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="sr-only">Disruption Playbook</DialogTitle>
          </DialogHeader>

          {fetchState === 'loading' && (
            <div className="flex items-center justify-center py-16 gap-3 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Building your playbook…</span>
            </div>
          )}

          {fetchState === 'error' && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              <p className="text-sm text-red-600">Failed to load playbook. Please try again.</p>
              <button
                type="button"
                onClick={() => { setFetchState('idle'); void loadPlaybook(); }}
                className="text-sm underline text-slate-600 hover:text-slate-900"
              >
                Retry
              </button>
            </div>
          )}

          {fetchState === 'idle' && playbook && (
            <PlaybookDashboard
              playbook={playbook}
              flightLabel={flightLabel}
              onRegenerate={handleRegenerate}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

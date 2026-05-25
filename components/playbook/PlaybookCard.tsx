'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Phone,
  ExternalLink,
  Smartphone,
  XCircle,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CompensationBadge } from '@/components/compensation/CompensationBadge';
import type { AirlinePolicy, ScenarioCard } from '@/lib/playbook/types';

// ─── Urgency styling ─────────────────────────────────────────────────────────

const URGENCY_CONFIG = {
  HIGH: {
    badge: 'bg-red-100 text-red-700 border-red-200',
    border: 'border-red-200',
    header: 'bg-red-50',
    icon: <ShieldAlert className="w-5 h-5 text-red-600" />,
    label: 'HIGH PRIORITY',
  },
  MEDIUM: {
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
    border: 'border-amber-200',
    header: 'bg-amber-50',
    icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
    label: 'MEDIUM PRIORITY',
  },
  LOW: {
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
    border: 'border-blue-100',
    header: 'bg-blue-50',
    icon: <CheckCircle2 className="w-5 h-5 text-blue-600" />,
    label: 'LOW PRIORITY',
  },
} as const;

const SCENARIO_TITLES: Record<ScenarioCard['scenarioType'], string> = {
  MISSED_CONNECTION: 'Missed Connection',
  SIGNIFICANT_DELAY: 'Significant Delay (2h+)',
  CANCELLATION: 'Flight Cancellation',
};

// ─── Component ────────────────────────────────────────────────────────────────

interface PlaybookCardProps {
  scenario: ScenarioCard;
  airline: AirlinePolicy;
  /** Called when the user clicks the EU261/UK261 badge */
  onCompensationClick?: () => void;
  className?: string;
}

export function PlaybookCard({
  scenario,
  airline,
  onCompensationClick,
  className,
}: PlaybookCardProps) {
  const [expanded, setExpanded] = useState(true);
  const cfg = URGENCY_CONFIG[scenario.urgencyLevel];

  return (
    <div
      className={cn(
        'rounded-2xl border overflow-hidden shadow-sm',
        cfg.border,
        className,
      )}
    >
      {/* ── Header ── */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'w-full flex items-center justify-between gap-3 px-5 py-4 text-left',
          cfg.header,
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          {cfg.icon}
          <div className="min-w-0">
            <span className="font-bold text-slate-900 text-base leading-tight block">
              {SCENARIO_TITLES[scenario.scenarioType]}
            </span>
            <span
              className={cn(
                'text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border',
                cfg.badge,
              )}
            >
              {cfg.label}
            </span>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        )}
      </button>

      {/* ── Body ── */}
      {expanded && (
        <div className="bg-white divide-y divide-slate-100">
          {/* Trigger callout */}
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex gap-2 items-start">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 leading-snug">
              <span className="font-semibold">When this applies: </span>
              {scenario.triggerDescription}
            </p>
          </div>

          {/* Steps */}
          <ol className="px-5 py-4 space-y-3">
            {scenario.steps.map((step) => (
              <li key={step.order} className="flex gap-3 items-start">
                {/* Step number + do/avoid icon */}
                <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                  <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center">
                    {step.order}
                  </span>
                  {step.doThis ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <XCircle className="w-3 h-3 text-red-500" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Action line */}
                  <p
                    className={cn(
                      'text-sm font-semibold leading-snug',
                      step.doThis ? 'text-slate-900' : 'text-red-700',
                    )}
                  >
                    {!step.doThis && (
                      <span className="text-red-600 font-bold mr-1">AVOID:</span>
                    )}
                    {step.action}
                  </p>

                  {/* Time context chip */}
                  {step.timeContext && (
                    <span className="inline-flex items-center gap-1 mt-0.5 text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      <Clock className="w-3 h-3" />
                      {step.timeContext}
                    </span>
                  )}

                  {/* Detail */}
                  {step.detail && (
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                      {step.detail}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>

          {/* Airline-specific note */}
          {scenario.airlineSpecificNote && (
            <div className="px-5 py-3 bg-blue-50 border-t border-blue-100">
              <p className="text-xs text-blue-800 leading-relaxed">
                <span className="font-semibold">{airline.name} tip: </span>
                {scenario.airlineSpecificNote}
              </p>
            </div>
          )}

          {/* Regulation note */}
          {scenario.regulationNote && (
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-start gap-2">
              <p className="text-xs text-slate-600 leading-relaxed flex-1">
                {scenario.regulationNote}
              </p>
              {scenario.compensationLinked && (
                <CompensationBadge
                  status="MONITORING"
                  onClick={onCompensationClick ?? undefined}
                  className="shrink-0"
                />
              )}
            </div>
          )}

          {/* ── Airline quick-action bar ── */}
          <div className="px-5 py-3 bg-slate-900 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mr-1">
              {airline.name}
            </span>

            <a
              href={`tel:${airline.rebookingPhone.replace(/\s/g, '')}`}
              className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition"
            >
              <Phone className="w-3.5 h-3.5" />
              {airline.rebookingPhone}
            </a>

            <a
              href={airline.rebookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Manage Booking
            </a>

            {airline.appName && (
              <span className="inline-flex items-center gap-1.5 bg-white/5 text-slate-300 text-xs px-3 py-1.5 rounded-lg">
                <Smartphone className="w-3.5 h-3.5" />
                {airline.appName} app
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

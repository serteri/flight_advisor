'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ConnectionAnalysis } from '@/lib/connection/successRate';
import { cn } from '@/lib/utils';
import { ConnectionRiskBadge } from './ConnectionRiskBadge';

export type ConnectionRiskCardProps = {
  analysis: ConnectionAnalysis & {
    airportName?: string;
  };
  className?: string;
};

const rateStyles = {
  SAFE: 'text-emerald-700 bg-emerald-600',
  RISKY: 'text-amber-700 bg-amber-500',
  CRITICAL: 'text-red-700 bg-red-600',
  UNKNOWN: 'text-slate-600 bg-slate-400',
};

const formatMinutes = (minutes: number): string => {
  const safeMinutes = Math.max(0, minutes);
  const hours = Math.floor(safeMinutes / 60);
  const remaining = safeMinutes % 60;
  if (!hours) return `${remaining}m`;
  if (!remaining) return `${hours}h`;
  return `${hours}h ${remaining}m`;
};

export function ConnectionRiskCard({ analysis, className }: ConnectionRiskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const progressWidth = `${Math.max(0, Math.min(100, analysis.successRate))}%`;

  return (
    <Card className={cn('rounded-md', className)}>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">
              {analysis.airportName ? `${analysis.airportName} (${analysis.airport})` : analysis.airport}
            </CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Connection window: {formatMinutes(analysis.connectionWindowMinutes)} · Min. {analysis.mct} min required
            </p>
          </div>
          <ConnectionRiskBadge riskLevel={analysis.riskLevel} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className={cn('text-4xl font-black leading-none', rateStyles[analysis.riskLevel].split(' ')[0])}>
              {analysis.riskLevel === 'UNKNOWN' ? 'N/A' : `${Math.round(analysis.successRate)}%`}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Based on {analysis.sampleSize} historical flight pairs
            </p>
          </div>
          {analysis.mctViolation && (
            <p className="max-w-52 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              Below minimum connection time
            </p>
          )}
        </div>

        <div className="h-2 rounded-full bg-slate-100">
          <div
            className={cn('h-2 rounded-full', rateStyles[analysis.riskLevel].split(' ')[1])}
            style={{ width: progressWidth }}
          />
        </div>

        <p className="text-sm text-slate-700">{analysis.recommendation}</p>

        <div className="flex flex-col gap-3 border-t border-slate-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            {analysis.dataNote}. Data powered by FlightAware.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
            Breakdown
          </Button>
        </div>

        {expanded && (
          <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm sm:grid-cols-2">
            <div>
              <p className="font-semibold text-slate-900">Inbound {analysis.inboundFlightIdent}</p>
              <p className="text-slate-600">Arrival on-time rate: {Math.round(analysis.inboundOnTimeRate)}%</p>
              <p className="text-xs text-slate-500">Sample: {analysis.inboundSampleSize} flights</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Outbound {analysis.outboundFlightIdent}</p>
              <p className="text-slate-600">Departure on-time rate: {Math.round(analysis.outboundOnTimeRate)}%</p>
              <p className="text-xs text-slate-500">Sample: {analysis.outboundSampleSize} flights</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

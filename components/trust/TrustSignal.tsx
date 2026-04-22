'use client';

import { Info } from 'lucide-react';

interface TrustSignalProps {
  confidence: number | null;
  explanation?: string;
  missingData?: string[];
  dataSource?: string;
  timestamp?: Date;
  compact?: boolean;
  className?: string;
}

/**
 * Standardized confidence display component
 * Shows: percentage + label + short explanation
 * Example: "Confidence: 62% (Moderate) — based on partial itinerary data."
 */
export function TrustSignal({
  confidence,
  explanation,
  missingData,
  dataSource,
  timestamp,
  compact = false,
  className = '',
}: TrustSignalProps) {
  if (confidence === null) {
    return (
      <div
        className={`flex items-center gap-2 text-xs text-slate-500 ${className}`}
      >
        <Info className="w-4 h-4 opacity-60" />
        <span>Confidence unavailable</span>
      </div>
    );
  }

  const confidencePercent = Math.round(Math.min(100, Math.max(0, confidence)));
  const label = getConfidenceLabel(confidencePercent);
  const labelColor = getConfidenceLabelColor(confidencePercent);

  if (compact) {
    return (
      <div className={`text-xs font-medium ${labelColor} ${className}`}>
        {confidencePercent}% ({label})
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-700">
            Confidence: {confidencePercent}% ({label})
          </div>
        </div>
        <div className={`text-xs font-bold px-2 py-1 rounded ${labelColor}`}>
          {label}
        </div>
      </div>

      {/* Confidence bar */}
      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${getConfidenceBarColor(confidencePercent)} transition-all`}
          style={{ width: `${confidencePercent}%` }}
        />
      </div>

      {/* Explanation */}
      {explanation && (
        <p className="text-xs text-slate-600 leading-relaxed">{explanation}</p>
      )}

      {/* Missing data indicators */}
      {missingData && missingData.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 space-y-1">
          <div className="text-xs font-medium text-amber-800">
            ⚠️ Data limitations:
          </div>
          <ul className="text-xs text-amber-700 space-y-1">
            {missingData.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Data source & timestamp */}
      {(dataSource || timestamp) && (
        <div className="text-xs text-slate-500 space-y-1">
          {dataSource && <div>Source: {dataSource}</div>}
          {timestamp && (
            <div>
              Last updated: {formatTimeAgo(timestamp)}
              <span className="text-slate-400">
                {' '}
                ({timestamp.toLocaleString()})
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getConfidenceLabel(percent: number): string {
  if (percent >= 80) return 'High';
  if (percent >= 60) return 'Moderate';
  if (percent >= 40) return 'Low';
  return 'Very Low';
}

function getConfidenceLabelColor(percent: number): string {
  if (percent >= 80) return 'bg-emerald-100 text-emerald-700';
  if (percent >= 60) return 'bg-blue-100 text-blue-700';
  if (percent >= 40) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

function getConfidenceBarColor(percent: number): string {
  if (percent >= 80) return 'bg-emerald-500';
  if (percent >= 60) return 'bg-blue-500';
  if (percent >= 40) return 'bg-amber-500';
  return 'bg-red-500';
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'moments ago';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return date.toLocaleDateString();
}

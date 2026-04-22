'use client';

import { Info } from 'lucide-react';
import { useState } from 'react';

interface DataSourceInfo {
  name: 'duffel' | 'priceline' | 'internal' | 'historical';
  label: string;
  lastUpdated?: Date;
  isLive?: boolean;
  credibilityScore?: number; // 0-100
  explanation?: string;
}

interface DataSourceBadgeProps {
  source: DataSourceInfo;
  compact?: boolean;
  className?: string;
  showExplanation?: boolean;
}

/**
 * Data source visibility badge
 * Shows: provider name + freshness + credibility note
 * Example: "DUFFEL (Live, 2m ago) — Real-time from official API"
 */
export function DataSourceBadge({
  source,
  compact = false,
  className = '',
  showExplanation = true,
}: DataSourceBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const sourceColor = getSourceColor(source.name);
  const freshness = source.lastUpdated ? formatTimeAgo(source.lastUpdated) : 'unknown';
  const credibilityLabel = source.credibilityScore
    ? getCredibilityLabel(source.credibilityScore)
    : null;

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${sourceColor} ${className}`}
      >
        <span>{getSourceEmoji(source.name)}</span>
        <span>{source.label}</span>
        {source.isLive && <span className="text-[8px]">●</span>}
      </div>
    );
  }

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg border ${sourceColor} cursor-help`}
      >
        <span className="text-sm">{getSourceEmoji(source.name)}</span>
        <span>{source.label}</span>
        {source.isLive && (
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        )}
        {source.lastUpdated && (
          <span className="text-slate-600">({freshness})</span>
        )}
        <Info className="w-3.5 h-3.5 opacity-60" />
      </div>

      {/* Tooltip */}
      {showTooltip && showExplanation && (
        <div
          className={`absolute bottom-full mb-2 left-0 bg-slate-900 text-white text-xs rounded-lg px-3 py-2 w-48 z-50 shadow-lg space-y-1 pointer-events-none`}
        >
          <div className="font-semibold">{source.label}</div>
          {source.isLive && (
            <div className="text-emerald-300">✓ Live data (real-time)</div>
          )}
          {source.lastUpdated && (
            <div>
              Last updated {freshness}
              <div className="text-slate-400 text-[10px]">
                {source.lastUpdated.toLocaleString()}
              </div>
            </div>
          )}
          {credibilityLabel && (
            <div className="text-blue-300">
              Credibility: {credibilityLabel} ({source.credibilityScore}%)
            </div>
          )}
          {source.explanation && (
            <div className="text-slate-300 leading-tight">{source.explanation}</div>
          )}
          <div className="text-slate-500 pt-1 border-t border-slate-700">
            Click to learn about data sources
          </div>
        </div>
      )}
    </div>
  );
}

function getSourceColor(source: string): string {
  switch (source) {
    case 'duffel':
      return 'bg-emerald-50 border-emerald-200 text-emerald-700';
    case 'priceline':
      return 'bg-blue-50 border-blue-200 text-blue-700';
    case 'internal':
      return 'bg-purple-50 border-purple-200 text-purple-700';
    case 'historical':
      return 'bg-slate-100 border-slate-300 text-slate-700';
    default:
      return 'bg-slate-50 border-slate-200 text-slate-600';
  }
}

function getSourceEmoji(source: string): string {
  switch (source) {
    case 'duffel':
      return '🏛️';
    case 'priceline':
      return '⚡';
    case 'internal':
      return '🧠';
    case 'historical':
      return '📊';
    default:
      return '📌';
  }
}

function getCredibilityLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  return 'Limited';
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

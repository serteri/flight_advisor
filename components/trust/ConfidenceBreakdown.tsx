'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FactorItem {
  label: string;
  impact: 'positive' | 'negative' | 'neutral';
  explanation?: string;
}

interface ConfidenceBreakdownProps {
  confidence: number | null;
  positiveFactors: FactorItem[];
  negativeFactors: FactorItem[];
  neutralFactors?: FactorItem[];
  title?: string;
  className?: string;
}

/**
 * Expandable "Why This Score?" component
 * Shows what increased score, decreased score, what is missing
 */
export function ConfidenceBreakdown({
  confidence,
  positiveFactors,
  negativeFactors,
  neutralFactors = [],
  title = 'Why this score?',
  className = '',
}: ConfidenceBreakdownProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (confidence === null) return null;

  const hasFactors =
    positiveFactors.length > 0 ||
    negativeFactors.length > 0 ||
    neutralFactors.length > 0;

  if (!hasFactors) return null;

  return (
    <div className={`border border-slate-200 rounded-lg ${className}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">{title}</span>
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
            {confidence.toFixed(0)}% confidence
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-slate-200 px-4 py-3 space-y-4 bg-slate-50">
          {/* Positive factors */}
          {positiveFactors.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <h4 className="text-sm font-semibold text-emerald-700">
                  Increased confidence
                </h4>
              </div>
              <ul className="space-y-2 ml-6">
                {positiveFactors.map((factor, idx) => (
                  <li key={idx} className="space-y-1">
                    <div className="flex items-start gap-2 text-sm">
                      <span className="text-emerald-600 font-bold">+</span>
                      <span className="text-slate-800 font-medium">
                        {factor.label}
                      </span>
                    </div>
                    {factor.explanation && (
                      <p className="text-xs text-slate-600 ml-6">
                        {factor.explanation}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Negative factors */}
          {negativeFactors.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-red-600" />
                <h4 className="text-sm font-semibold text-red-700">
                  Reduced confidence
                </h4>
              </div>
              <ul className="space-y-2 ml-6">
                {negativeFactors.map((factor, idx) => (
                  <li key={idx} className="space-y-1">
                    <div className="flex items-start gap-2 text-sm">
                      <span className="text-red-600 font-bold">−</span>
                      <span className="text-slate-800 font-medium">
                        {factor.label}
                      </span>
                    </div>
                    {factor.explanation && (
                      <p className="text-xs text-slate-600 ml-6">
                        {factor.explanation}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Neutral factors */}
          {neutralFactors.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Minus className="w-4 h-4 text-slate-400" />
                <h4 className="text-sm font-semibold text-slate-700">
                  Missing data
                </h4>
              </div>
              <ul className="space-y-2 ml-6">
                {neutralFactors.map((factor, idx) => (
                  <li key={idx} className="space-y-1">
                    <div className="flex items-start gap-2 text-sm">
                      <span className="text-slate-400 font-bold">?</span>
                      <span className="text-slate-700 font-medium">
                        {factor.label}
                      </span>
                    </div>
                    {factor.explanation && (
                      <p className="text-xs text-slate-600 ml-6">
                        {factor.explanation}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Call to action */}
          <div className="bg-blue-50 border border-blue-200 rounded px-3 py-2 text-xs text-blue-700">
            💡 <strong>Tip:</strong> Read our{' '}
            <a
              href="/methodology"
              className="underline hover:no-underline font-semibold"
            >
              scoring methodology
            </a>{' '}
            to understand how we calculate confidence.
          </div>
        </div>
      )}
    </div>
  );
}

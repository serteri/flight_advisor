'use client';

import { AlertTriangle, AlertCircle } from 'lucide-react';

interface Limitation {
  id: string;
  title: string;
  description: string;
  severity: 'warning' | 'info';
  impact?: string; // How this affects the score/recommendation
}

interface LimitationDisclosureProps {
  limitations: Limitation[];
  title?: string;
  className?: string;
}

/**
 * Limitation disclosure component
 * Shows what data is incomplete or unavailable
 * Examples:
 * - "Baggage data incomplete"
 * - "Real-time pricing unavailable"
 * - "Partial itinerary detected"
 */
export function LimitationDisclosure({
  limitations,
  title = 'Data Limitations',
  className = '',
}: LimitationDisclosureProps) {
  if (limitations.length === 0) return null;

  const warnings = limitations.filter((l) => l.severity === 'warning');
  const infos = limitations.filter((l) => l.severity === 'info');

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Title */}
      <div className="text-sm font-semibold text-slate-700">{title}</div>

      {/* Warning-level limitations */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((limitation) => (
            <div
              key={limitation.id}
              className="border-l-4 border-amber-400 bg-amber-50 px-4 py-3 rounded-r-lg"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <div className="font-semibold text-amber-900">
                    {limitation.title}
                  </div>
                  <p className="text-sm text-amber-800">{limitation.description}</p>
                  {limitation.impact && (
                    <p className="text-xs text-amber-700 italic">
                      Impact: {limitation.impact}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info-level limitations */}
      {infos.length > 0 && (
        <div className="space-y-2">
          {infos.map((limitation) => (
            <div
              key={limitation.id}
              className="border-l-4 border-blue-300 bg-blue-50 px-4 py-3 rounded-r-lg"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <div className="font-semibold text-blue-900">
                    {limitation.title}
                  </div>
                  <p className="text-sm text-blue-800">{limitation.description}</p>
                  {limitation.impact && (
                    <p className="text-xs text-blue-700 italic">
                      Impact: {limitation.impact}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary note */}
      <div className="text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded border border-slate-200">
        💡 These limitations are factored into our confidence score. Lower
        confidence means less reliable information available.
      </div>
    </div>
  );
}

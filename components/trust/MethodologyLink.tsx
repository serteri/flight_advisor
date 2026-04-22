'use client';

import { BookOpen, ExternalLink } from 'lucide-react';

interface MethodologyLinkProps {
  section?: 'scoring' | 'confidence' | 'data-sources' | 'methodology';
  compact?: boolean;
  className?: string;
}

/**
 * "How we calculate" transparency link
 * Shows a link to detailed methodology explanation
 */
export function MethodologyLink({
  section = 'methodology',
  compact = false,
  className = '',
}: MethodologyLinkProps) {
  const sectionAnchors = {
    scoring: '#scoring-algorithm',
    confidence: '#confidence-calculation',
    'data-sources': '#data-sources',
    methodology: '#overview',
  };

  const href = `/methodology${sectionAnchors[section]}`;
  const linkText = {
    scoring: 'How we score flights',
    confidence: 'How we calculate confidence',
    'data-sources': 'About our data sources',
    methodology: 'Our methodology',
  };

  if (compact) {
    return (
      <a
        href={href}
        className={`text-xs text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1 ${className}`}
      >
        <span>{linkText[section]}</span>
        <ExternalLink className="w-3 h-3" />
      </a>
    );
  }

  return (
    <div
      className={`flex items-start gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg ${className}`}
    >
      <BookOpen className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <div className="text-sm font-semibold text-indigo-900">
          Want to understand our scoring?
        </div>
        <p className="text-xs text-indigo-700 mt-1">
          We're transparent about how we calculate scores, confidence, and assess
          risk.
        </p>
        <a
          href={href}
          className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold mt-2 inline-flex items-center gap-1 hover:underline"
        >
          Read our {section === 'methodology' ? 'full methodology' : 'explanation'}
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

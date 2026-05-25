'use client';

import { useState } from 'react';

type WelcomeBannerProps = {
  enabled: boolean;
};

const DISMISS_KEY = 'fa_welcome_dismissed';

export function WelcomeBanner({ enabled }: WelcomeBannerProps) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(DISMISS_KEY) === 'true';
  });

  if (!enabled || dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, 'true');
    setDismissed(true);
  };

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sky-900">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium">
          👋 Welcome to FlightAgent - paste an itinerary above to get your first score free. No credit card needed.
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="text-xs font-semibold text-sky-700 hover:text-sky-900"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

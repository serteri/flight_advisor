'use client';

import { useState, useEffect } from 'react';
import { grantConsent, denyConsent, getStoredConsent } from '@/lib/analytics/consent';

/**
 * GDPR/Consent Mode v2 banner.
 * Fixed to the bottom of the viewport; disappears once the user
 * has accepted or declined. Does not render on the server.
 */
export function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  // Show only when no prior choice exists.
  useEffect(() => {
    if (getStoredConsent() === null) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const handleAccept = () => {
    grantConsent();
    setVisible(false);
  };

  const handleDecline = () => {
    denyConsent();
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-4 bg-slate-900 px-5 py-4 shadow-2xl sm:px-8"
    >
      {/* Message */}
      <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
        We use analytics to improve{' '}
        <span className="font-semibold text-white">FlightAgent</span>.{' '}
        No personal data is sold.
      </p>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={handleDecline}
          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          Decline
        </button>
        <button
          type="button"
          onClick={handleAccept}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          Accept Analytics
        </button>
      </div>
    </div>
  );
}

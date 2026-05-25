'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { restoreConsent } from '@/lib/analytics/consent';

// Loaded client-side only — prevents any SSR/hydration mismatch on the banner.
const ConsentBanner = dynamic(
  () => import('./ConsentBanner').then((m) => m.ConsentBanner),
  { ssr: false },
);

/**
 * AnalyticsProvider
 *
 * Mount once inside the root layout <body>.
 * - Restores prior consent state to gtag on every page load so returning
 *   users don't silently lose their granted consent after a refresh.
 * - Renders the ConsentBanner for first-time visitors (client-only).
 */
export function AnalyticsProvider() {
  useEffect(() => {
    restoreConsent();
  }, []);

  return <ConsentBanner />;
}

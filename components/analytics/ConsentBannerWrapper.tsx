'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { restoreConsent } from '@/lib/analytics/consent';

// Load the banner only on the client — no SSR needed.
const ConsentBanner = dynamic(
  () => import('./ConsentBanner').then((m) => m.ConsentBanner),
  { ssr: false },
);

/**
 * Client-side wrapper mounted once in the root layout.
 * Responsibilities:
 *  1. Restore prior consent state to gtag on every page load.
 *  2. Render the ConsentBanner (client-only, deferred).
 */
export function ConsentBannerWrapper() {
  useEffect(() => {
    restoreConsent();
  }, []);

  return <ConsentBanner />;
}

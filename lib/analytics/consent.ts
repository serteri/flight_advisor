// lib/analytics/consent.ts
// Consent-state helpers for GA4 Consent Mode v2.
// All functions are client-side only — call inside useEffect.

const STORAGE_KEY = 'fa_consent_analytics';

export type ConsentValue = 'granted' | 'denied' | null;

/** Read the stored consent choice. Returns null if not yet decided. */
export function getStoredConsent(): ConsentValue {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === 'granted' || raw === 'denied') return raw;
  return null;
}

/**
 * On page load, push the previously stored consent state back into
 * gtag so returning users don't have their analytics silently reset.
 * Call once inside a useEffect in ConsentBannerWrapper.
 */
export function restoreConsent(): void {
  if (typeof window === 'undefined') return;
  const stored = getStoredConsent();
  if (stored === 'granted') {
    gtag('consent', 'update', { analytics_storage: 'granted' });
  }
}

/** Grant analytics consent, persist to localStorage, and notify gtag. */
export function grantConsent(): void {
  if (typeof window === 'undefined') return;
  gtag('consent', 'update', { analytics_storage: 'granted' });
  localStorage.setItem(STORAGE_KEY, 'granted');
}

/** Deny analytics consent and persist to localStorage. */
export function denyConsent(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, 'denied');
}

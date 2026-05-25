// lib/analytics/events.ts
// Typed event helpers for FlightAgent GA4 tracking.
//
// Rules:
//  - NEVER include PII (no email, name, flight number, passenger details).
//  - Always guard with typeof window !== 'undefined'.
//  - Keep event names snake_case to match GA4 convention.

function safeGtag(
  eventName: string,
  params?: Record<string, string | number | boolean | undefined>,
): void {
  if (typeof window === 'undefined') return;
  gtag('event', eventName, params);
}

export const analyticsEvents = {
  /** Fired when a user submits an itinerary for scoring. */
  itineraryScored: (flightCount: number): void =>
    safeGtag('itinerary_scored', { flight_count: flightCount }),

  /** Fired when a disruption playbook is generated for a trip. */
  playbookGenerated: (airlineIata: string): void =>
    safeGtag('playbook_generated', { airline_iata: airlineIata }),

  /** Fired when a compensation estimate is calculated. */
  compensationCalculated: (regulation: string, amount: number): void =>
    safeGtag('compensation_calculated', {
      regulation,
      estimated_amount: amount,
    }),

  /** Fired when a user downloads/generates the advisor PDF report. */
  pdfDownloaded: (): void => safeGtag('pdf_downloaded'),

  /** Fired on pricing page view (supplement to automatic pageview). */
  pricingPageViewed: (): void => safeGtag('pricing_page_viewed'),

  /** Fired when a user clicks an upgrade / subscribe CTA. */
  upgradeClicked: (plan: string): void =>
    safeGtag('upgrade_clicked', { plan_name: plan }),

  /** Fired when a user adds a trip to Guardian monitoring. */
  tripMonitoringStarted: (): void => safeGtag('trip_monitoring_started'),

  /** Fired when a connection risk badge is shown (RISKY or CRITICAL). */
  connectionRiskShown: (riskLevel: 'RISKY' | 'CRITICAL'): void =>
    safeGtag('connection_risk_shown', { risk_level: riskLevel }),
} as const;

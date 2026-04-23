# Live QA Checklist (Manual, Browser-First)

Date: 2026-04-23
Scope: End-to-end real user journey validation for scoring, tracking, promotion, Guardian, route watches, and internal diagnostics.
Mode: Manual QA only (no automation framework required).

## 0) Preconditions

- Environment is staging or local with realistic data sources.
- Test account exists and can log in.
- Ideally have both account tiers available:
  - FREE account (to verify access gating)
  - PRO/ELITE account (to verify premium flows)
- Browser DevTools open (Network + Console tabs).
- Keep one QA log template for every failed step:
  - Timestamp (UTC)
  - User email / tier
  - URL
  - Input payload (redact secrets)
  - Expected vs actual
  - HTTP status + response body
  - Console errors
  - Screenshot

## 1) Suggested Order of Testing

1. Score an itinerary (happy path + parser confidence behavior)
2. Track this itinerary from score result
3. View tracked itinerary dashboard and tracked itinerary detail
4. Promote tracked itinerary to booked trip
5. View booked trip monitoring (Guardian detail)
6. Create route tracking watch
7. Verify internal health diagnostics endpoint outputs
8. Run edge-case passes (listed in section 9)
9. Run Guardian/notification simulation checks (section 10)

## 2) Flow A - Score an Itinerary

Entry page: /en/score-flight

### Scenario A1 - Happy Path Scoring

- Steps:
  1. Open score page.
  2. Paste a complete itinerary block (airline, from/to, date-times, price, baggage).
  3. Click Parse and Score Itinerary.
- Expected result:
  - A decision card appears (BUY/WAIT/WATCH).
  - Score and confidence are visible.
  - Explanation sections render: primary reason, positive/negative/missing factors.
  - Derived metrics panel appears (duration, layover, route realism, baggage confidence, parse confidence).
  - Track this itinerary button is enabled.
- Failure signs:
  - Spinner never ends.
  - 4xx/5xx on /api/score-flight.
  - Empty decision card or NaN score/confidence.
  - Decision shown but no explanation fields.
- Log if broken:
  - Request payload sent to /api/score-flight.
  - Response status/body.
  - Which expected section is missing.
  - Screenshot of result panel and network error.

### Scenario A2 - Incomplete Itinerary (Edge Case)

- Steps:
  1. Paste partial text (missing dates or price).
  2. Submit scoring.
- Expected result:
  - Parse warnings or missing-data warnings shown.
  - Confidence is lower than complete input.
  - Recommendation still generated with cautionary action hint.
- Failure signs:
  - Hard crash or blank response.
  - Confidence unrealistically high despite missing key fields.
  - No warning/explanation for missing info.
- Log if broken:
  - Exact pasted text.
  - Parse warnings present/absent.
  - Confidence value and recommendation.

### Scenario A3 - Unrealistic Itinerary (Edge Case)

- Steps:
  1. Paste impossible connection timing or unrealistic route segments.
  2. Submit scoring.
- Expected result:
  - Risk flags and/or route realism degradation appear.
  - Recommendation leans cautious (typically WATCH/WAIT) with explanation.
- Failure signs:
  - Unrealistic itinerary scored as strong BUY with high confidence and no warning.
- Log if broken:
  - Unrealistic fields used.
  - Recommendation + confidence + risk flags.

### Scenario A4 - Missing Baggage (Edge Case)

- Steps:
  1. Paste itinerary text without baggage details.
  2. Submit scoring.
- Expected result:
  - Missing factor/warning references baggage uncertainty.
  - Baggage confidence appears lower.
- Failure signs:
  - Baggage appears as confidently known when omitted.
- Log if broken:
  - Text input proving baggage omission.
  - Missing factor/warning panel evidence.

### Scenario A5 - Low-Confidence Output (Edge Case)

- Steps:
  1. Use sparse/ambiguous itinerary text.
  2. Submit scoring.
- Expected result:
  - Confidence visibly low.
  - Action hint encourages caution or data completion.
- Failure signs:
  - Confidence remains high without justification.
- Log if broken:
  - Input text, confidence %, action hint string.

## 3) Flow B - Track This Itinerary

Entry state: Result visible in score flow

### Scenario B1 - Track from Score Result

- Steps:
  1. On scored result panel, click Track this itinerary.
  2. Wait for success state and redirect.
- Expected result:
  - Button transitions: Saving itinerary... -> Itinerary tracked.
  - Redirect to /en/dashboard/tracked-flights.
  - New watched itinerary appears in list.
- Failure signs:
  - Button fails silently.
  - /api/track-itinerary returns 401/403/500.
  - Redirect occurs but item not created.
- Log if broken:
  - Response from /api/track-itinerary.
  - Whether redirect happened.
  - Whether new item is visible in watchlist.

## 4) Flow C - View Tracked Itinerary Dashboard

Entry page: /en/dashboard/tracked-flights

### Scenario C1 - Watchlist View

- Steps:
  1. Open tracked flights page.
  2. Confirm newly tracked item exists.
  3. Click View Details.
- Expected result:
  - Card shows route, price movement, update timing, sparkline/history.
  - Detail page opens at /en/dashboard/flights/{id}.
- Failure signs:
  - Missing item despite successful tracking API.
  - View Details link broken.
  - Price fields null/NaN or obvious mismatch from tracked snapshot.
- Log if broken:
  - Watchlist screenshot.
  - Detail URL + any 404/500.

### Scenario C2 - Tracked Itinerary Detail Integrity

- Steps:
  1. On detail page, verify sections: change summary, explanation summary, status summary.
  2. Verify recommendation/confidence and tracking badges are coherent.
- Expected result:
  - Status summary reflects tracking state.
  - If limited data, warning appears honestly.
  - Real-time unavailable state is explicitly disclosed.
- Failure signs:
  - Contradictory states (e.g., "healthy" and "limited" simultaneously without context).
  - Missing summary blocks.
- Log if broken:
  - Inconsistent fields and exact labels shown.

## 5) Flow D - Promote to Booked Trip

Entry page: /en/dashboard/flights/{id}

### Scenario D1 - Promote Successfully

- Steps:
  1. On tracked itinerary detail, click I booked this trip.
  2. Wait for redirect.
- Expected result:
  - POST /api/promote-itinerary-to-trip succeeds.
  - Redirect to /en/dashboard/guardian/{tripId}.
  - Tracked itinerary now marked booked/promoted.
- Failure signs:
  - Button spinner loops indefinitely.
  - API returns error with no useful message.
  - No link created between watched itinerary and monitored trip.
- Log if broken:
  - API status/body.
  - Old/new URLs.
  - Tracking state after refresh.

### Scenario D2 - Booked Trip with Missing Booking-Only Fields (Edge Case)

- Steps:
  1. Promote a tracked itinerary that was not imported from real booking confirmation.
  2. Re-open tracked itinerary detail and Guardian detail.
- Expected result:
  - UI indicates promotion happened.
  - Booking data is treated as estimated (not falsely confirmed).
  - Missing booking fields are effectively represented (e.g., PNR/ticket uncertainty in messaging).
- Failure signs:
  - UI claims confirmed booking details that were never provided.
  - No warning about estimated/missing booking confirmation data.
- Log if broken:
  - Exact wording shown in status panels.
  - Any false-confirmation fields.

## 6) Flow E - View Booked Trip Monitoring (Guardian)

Entry pages:
- /en/dashboard/guardian
- /en/dashboard/guardian/{id}

### Scenario E1 - Guardian Detail Baseline

- Steps:
  1. Open Guardian detail from promoted flow.
  2. Check status panel, risks, activity, and notification status sections.
- Expected result:
  - Last checked, next check, and check frequency visible.
  - Data honesty message visible.
  - Delay/cancellation risk fields render with current snapshot.
  - Notification status panel shows either channel records or explicit "no records yet" state.
- Failure signs:
  - Guardian page opens but key sections empty.
  - Risk fields contradict snapshot status.
  - Notification area crashes when no deliveries exist.
- Log if broken:
  - Screenshot of missing/contradictory section.
  - Console errors and failing API calls.

## 7) Flow F - Route Tracking Creation

Entry page: /en/dashboard/routes/add

### Scenario F1 - Create Route Watch (Standard)

- Steps:
  1. Set Origin, Destination, Start Date, optional End Date, Cabin.
  2. Click Start Tracking.
- Expected result:
  - Route is saved and dashboard refreshes.
  - Route appears in dashboard route cards (or route list widget).
- Failure signs:
  - Silent failure or generic alert only.
  - Route created with wrong origin/destination/date.
- Log if broken:
  - Form values entered.
  - Any alert message text.

### Scenario F2 - Route Watch with No Target Price (Edge Case)

- Steps:
  1. Create a route watch without any target-price field/value.
  2. Open route detail after snapshots exist.
- Expected result:
  - Flow still works (no target price required).
  - Timing/explanation should indicate reduced threshold certainty (NO_TARGET behavior).
- Failure signs:
  - Route creation blocked because target price missing.
  - Timing signal pretends threshold-based certainty exists.
- Log if broken:
  - Route payload/value set.
  - Resulting timing/explanation text.

## 8) Flow G - Internal Health Diagnostics Endpoint

Endpoint: /api/internal/health

### Scenario G1 - Default Health JSON

- Steps:
  1. Open /api/internal/health in browser.
- Expected result:
  - 200 JSON with overallStatus, parser/scoring/routeData/guardian, indicators, alerts.
- Failure signs:
  - 500 or malformed JSON.
  - Missing top-level health blocks.
- Log if broken:
  - Full JSON response.
  - Error message and status code.

### Scenario G2 - Period Variants

- Steps:
  1. Open /api/internal/health?period=last_hour
  2. Open /api/internal/health?period=last_24h
  3. Open /api/internal/health?period=last_7d
- Expected result:
  - Valid responses for all supported periods.
- Failure signs:
  - Any valid period returns 400.
- Log if broken:
  - URL + status + body for each period.

### Scenario G3 - Summary Format + Invalid Period

- Steps:
  1. Open /api/internal/health?format=summary
  2. Open /api/internal/health?period=invalid_value
- Expected result:
  - Summary returns condensed fields.
  - Invalid period returns 400 with clear message.
- Failure signs:
  - Summary still returns heavy full payload unexpectedly.
  - Invalid period accepted silently.
- Log if broken:
  - Exact response body for both calls.

## 9) Edge Case Matrix (Quick Regression Pass)

- Incomplete itinerary: must lower confidence and surface warnings.
- Unrealistic itinerary: must flag realism/risk, avoid high-confidence BUY.
- Missing baggage: must show missing-factor behavior, not fake certainty.
- Low-confidence output: must produce cautious action hint and visible confidence drop.
- Route watch without target price: must remain functional and indicate NO_TARGET-style uncertainty.
- Booked trip missing booking-only fields: must be marked estimated/unconfirmed, never shown as fully verified.

## 10) Guardian + Notification QA Suggestions (Safe Simulation)

Use non-production data only.

### Simulation S1 - Safe Delay Event Validation

- Steps:
  1. Use a staging trip with a near-term flight/date.
  2. Force a monitoring cycle (operator action) by triggering /api/cron/guardian in your test environment process.
  3. Refresh Guardian detail page.
- Expected in UI/logs/state:
  - Guardian detail shows increased delay minutes and risk changes.
  - Recent changes includes DELAY-type event.
  - Notification delivery records appear or update status.
  - Worker logs include Guardian cycle execution and notification dispatch lines.
- Failure signs:
  - Snapshot updates but no corresponding event.
  - Event exists but no notification delivery state update.

### Simulation S2 - Safe Cancellation Event Validation

- Steps:
  1. In staging, use a test trip mapped to a known cancelled flight sample/date (or controlled provider response).
  2. Trigger monitoring cycle.
  3. Refresh /en/dashboard/guardian/{id}.
- Expected in UI/logs/state:
  - Flight status switches to cancelled state.
  - Cancellation-related alert appears in Recent changes.
  - EU261 eligibility may change if criteria are met.
  - Notification records show attempted/sent statuses.
- Failure signs:
  - Cancelled status in worker logs but no UI update.
  - EU261 or alert logic regresses (missing or contradictory states).

### Simulation S3 - Data-Issue/Unknown State (Operational Safety)

- Steps:
  1. Use a staging-only invalid/unresolvable flight status source case.
  2. Trigger monitoring cycle.
- Expected:
  - System should degrade gracefully to UNKNOWN/data-quality warning.
  - No crash, no false-positive cancellation.
- Failure signs:
  - Worker throws, monitor loop breaks, or bogus severe alerts are emitted.

## 11) Red-Flag Bugs to Watch Closely

- False certainty bug: UI shows verified booking/PNR/ticket data when data is estimated.
- Confidence realism bug: sparse or contradictory itinerary still returns very high confidence.
- Silent tracking bug: track button appears successful but no watched flight created.
- Promotion linkage bug: itinerary promoted but not linked to Guardian trip, or wrong trip linked.
- Status contradiction bug: Guardian shows ON_TIME while delay/cancel alerts are active (or reverse).
- Notification integrity bug: alert exists but no delivery record/state update.
- Diagnostics blindness bug: /api/internal/health remains HEALTHY even when clear subsystem failures are present.
- Tier leakage bug: premium tracking/monitoring visible or executable for FREE where it should be gated.

## 12) Completion Criteria

Release-ready for live QA sign-off only if all are true:

- All core flows A-G pass at least once end-to-end.
- All edge-case checks in section 9 pass without false certainty.
- At least one Guardian event simulation produces coherent UI + logs + notification state.
- Internal health endpoint responds correctly for normal, summary, and invalid period cases.

# Monetization Model - Flight Decision + Protection System

## 1) Free vs Paid Boundary

### Free (trust-first, conversion-ready)
- Limited scoring: up to 3 full flight scores per month
- Basic explanation: top 3 factors only (price, duration, stops)
- Confidence signal visible (trust requirement)
- No historical trend charts
- No disruption monitoring
- No proactive alerts
- No EU261 compensation insights

### Paid (decision + protection bundle)
- Unlimited scoring
- Full explanation: 10-criteria breakdown + confidence details + missing-data impact
- Itinerary tracking (post-booking)
- Guardian monitoring (24/7 checks)
- Smart alerts (delay, gate change, cancellation risk, compensation opportunities)
- EU261 eligibility insights + action checklist

Design principle:
- Free must answer: "Can I trust this?"
- Paid must answer: "Can this protect me when things go wrong?"

---

## 2) Pricing Model Definition

## Option A - Credits (Pay per Analysis)
Best for pre-booking users who visit occasionally and want one-off decisions.

### Suggested price ladder
- 1 Credit Pack: $4.99 (1 deep analysis)
- 3 Credit Pack: $11.99
- 10 Credit Pack: $29.99
- Expiration: 12 months

### What 1 credit unlocks
- One full 10-criteria score for a specific itinerary snapshot
- Recommendation (BUY / WAIT / AVOID)
- Risk and confidence breakdown
- 7-day refresh window for the same itinerary

### Pros
- Matches occasional behavior
- Low commitment
- Strong first payment conversion

### Cons
- Weak post-booking monetization
- Less recurring revenue

---

## Option B - Per-Trip Protection
Best for post-booking value capture where stakes are highest.

### Suggested plans
- Trip Protect Basic: $9.99 per trip
  - 1 itinerary
  - 30-day monitoring window
  - Core disruption alerts
  - Basic EU261 insight

- Trip Protect Plus: $14.99 per trip
  - 1 itinerary
  - Monitoring until trip completion (up to 90 days)
  - Priority alerts + tighter check interval
  - Full EU261 insights + claim-ready summary

- Add-on traveler seat: +$4.99 per additional passenger beyond first traveler profile

### Pros
- Captures peak willingness-to-pay moment (after booking)
- Clear outcome promise: "we protect this trip"
- High perceived value and trust fit

### Cons
- Revenue tied to booking events
- Needs clear trip lifecycle UX

---

## 3) Final Recommendation

Use a hybrid model with one primary and one secondary offer:

- Primary: Per-Trip Protection (Option B)
- Secondary: Analysis Credits (Option A)

Reason:
- Your product value peaks at decision + disruption moments, not daily usage.
- Per-trip pricing maps directly to user intent and reduces subscription fatigue.
- Credits convert uncertain users before they commit to protection.

### Recommended packaging
- Free Tier (trust entry)
- Analyze Pass (credits)
- Trip Protect (per-trip)

### Optional later stage
- Add annual membership only for power travelers (5+ trips/year). Do not lead with subscription.

---

## 4) Paywall Moment (When to Ask for Payment)

Do not hard-paywall at landing.

### Moment 1 - Decision Paywall (soft -> hard)
Trigger after user receives a basic score on free tier and attempts one of these:
- "Show full 10-factor breakdown"
- "Re-score with baggage + reliability + airport complexity"
- "Run comparison against 3 alternatives"

Offer:
- Buy 1 credit or 3-credit pack

Why this works:
- User already saw initial value and has active intent.

### Moment 2 - Protection Paywall (highest conversion)
Trigger immediately after user clicks:
- "Track & Protect This Flight"
- "Add this booked itinerary"

Offer:
- Trip Protect Basic / Plus

Why this works:
- Highest anxiety and willingness-to-pay occurs right after booking.

### Moment 3 - Incident Paywall (last-chance conversion)
Trigger when disruption risk appears for non-paid user:
- "High delay risk detected"
- "EU261 may apply"

Offer:
- Instant trip activation with 1-click purchase

Guardrail:
- Always show a minimal warning for trust, even if full details are paid.

---

## 5) Value Message (Why Pay)

Core message:
- "Cheap is not always smart. We help you avoid expensive mistakes and protect your trip when plans break."

Proof pillars:
- Better decision: 10-criteria scoring, not just price sorting
- Better timing: buy/wait/avoid recommendation with confidence
- Better protection: Guardian watches for delays, gate changes, cancellations
- Better recovery: EU261 eligibility insight when things go wrong

Economic framing:
- "One bad decision can cost more than Trip Protect."

Trust framing:
- "You see what we know, what we don't know, and why we recommend this decision."

---

## Pricing Structure (Final)

- Free: 3 basic scores/month
- Analyze Credits:
  - 1 credit = $4.99
  - 3 credits = $11.99
  - 10 credits = $29.99
- Trip Protect:
  - Basic = $9.99/trip
  - Plus = $14.99/trip

Suggested default CTA hierarchy:
1. Track & Protect This Flight (primary)
2. Unlock Full Analysis (secondary)

---

## Example UI Text

## A) Free score result card
- Title: "Your Free Flight Score"
- Body: "You unlocked a basic decision view. Get full risk, comfort, and reliability insights in one click."
- CTA 1: "Unlock Full Analysis - $4.99"
- CTA 2: "Track & Protect This Trip - from $9.99"

## B) Decision paywall modal
- Title: "See the Full Decision Before You Book"
- Body: "Unlock the complete 10-factor breakdown, confidence analysis, and BUY/WAIT/AVOID rationale."
- Option 1: "1 Analysis Credit - $4.99"
- Option 2: "3 Credits (Best Value) - $11.99"
- Trust note: "No subscription required. Credits valid for 12 months."

## C) Protection paywall modal
- Title: "Protect This Trip Until Arrival"
- Body: "Get 24/7 Guardian monitoring, disruption alerts, and EU261 guidance for this itinerary."
- Plan 1: "Trip Protect Basic - $9.99"
- Plan 2: "Trip Protect Plus - $14.99"
- CTA: "Activate Protection"

## D) Incident conversion banner
- Title: "Risk Alert Found"
- Body: "This itinerary shows elevated disruption risk. Activate protection now to receive real-time alerts and recovery guidance."
- CTA: "Activate Trip Protection"

## E) Trust-first microcopy
- "You always see a basic score for free."
- "Paid unlocks deeper analysis and active protection."
- "No hidden fees. No automatic renewal on trip passes."

---

## Rollout Plan (30 Days)

Week 1
- Ship free limit + credits checkout
- Add decision paywall after free score

Week 2
- Ship per-trip Basic/Plus plans
- Add protection paywall on "Track & Protect"

Week 3
- Add incident-triggered paywall banner
- A/B test CTA order and pricing anchors

Week 4
- Evaluate metrics and optimize

Core KPIs
- Free -> paid conversion at decision paywall
- Protection attach rate on tracked itineraries
- Incident-triggered conversion
- Refund rate (trust health)
- NPS after disruption events

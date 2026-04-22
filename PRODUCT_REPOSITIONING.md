# Product Repositioning: Search Engine → Decision System

## Executive Summary

Flight AI is **NOT a flight search engine**. It is a **flight decision system, flight tracking system, and trip protection system**.

This document outlines the complete repositioning of product messaging from search-first to decision-first.

---

## Before vs After Messaging

### Core Motto
**BEFORE:** "Precision in every mile, passion in every flight."  
**AFTER:** "Know before you book. Protect after you do."

**Why:** The original motto is generic. The new one clearly positions the product's dual focus: pre-booking decisions and post-booking protection.

---

## Messaging Map: All Changes

### 1. Primary CTA Labels

| Location | Before | After | Why |
|----------|--------|-------|-----|
| common.search_flights | "Search Flights" | "Analyze Flight" | Shifts from discovery to decision |
| SearchForm.search_button | "Search Flights" | "Score This Flight" | Reflects the scoring engine, not search |
| FlightSearch.searchButton | "Find Flights" | "Score This Flight" | Same rationale |
| FlightSearch.trackFlight | "Track this Flight" | "Track & Protect This Flight" | Emphasizes post-booking protection |
| HomePage.hero.ctaPrimary | "Start Exploring" | "Score a Flight" | Clear, action-oriented CTA |

### 2. Navigation Labels

| Location | Before | After | Why |
|----------|--------|-------|-----|
| Navbar.search | "Search Flights" | "Track Route" | Secondary nav focuses on tracking, not search |

### 3. Page Titles & Hero Sections

| Location | Before | After | Why |
|----------|--------|-------|-----|
| FlightSearch.title | "Search & Track Flights" | "Score & Track Your Flights" | Score is the unique value |
| FlightSearch.heroTitle | "Where are we flying?" | "What flight are you deciding on?" | Reframes as a decision tool |
| FlightSearch.heroSubtitle | "Discover the best flight deals" | "Know before you book" | Outcome-focused, not deal-focused |
| HomePage.features.subtitle | "Everything you need to find the best flight deals" | "Make smarter flight decisions with confidence" | Decision quality over price hunting |

### 4. Homepage Positioning

| Location | Before | After | Why |
|----------|--------|-------|-----|
| HomePage.strategic.title | "Skyscanner sorts prices. We defend outcomes." | "Other platforms sort prices. We help you decide." | Clearer positioning against competitors |
| HomePage.hero.ctaSecondary | "Learn More" | "See How It Works" | More specific call to action |

### 5. Blog / Learning Section

| Location | Before | After | Why |
|----------|--------|-------|-----|
| BlogPage.subtitle | "Expert advice on finding the best flight deals..." | "Expert guides on flight decisions, travel planning, and booking strategies..." | Positions as educational, not deal-focused |
| BlogPage.ctaDesc | "Start your search on FlightAdvisor and find the best deals..." | "Score your flight on Flight Agent and make confident booking decisions." | Emphasizes scoring and confidence |
| BlogPage.ctaButton | "Search Flights Now" | "Get Started" | Neutral, action-oriented CTA |

### 6. Processing States

| Location | Before | After | Why |
|----------|--------|-------|-----|
| FlightSearch.searchingDesc | "We are scanning hundreds of airlines to find the best deals" | "Analyzing your flight across 10 criteria..." | Emphasizes the analysis, not deal hunting |

### 7. Pricing & Upgrade

| Location | Before | After | Why |
|----------|--------|-------|-----|
| PricingPage.subtitle | (generic) | "Make smarter booking decisions with real-time flight intelligence." | Decision-focused value prop |

### 8. Status/Messaging

| Location | Before | After | Why |
|----------|--------|-------|-----|
| FlightSearch.trackingThisFlight | "You are tracking this flight" | "This flight is protected" | Active protection messaging |

---

## Product Positioning: The 5-Second Test

When a user lands on Flight AI, they should understand in 5 seconds:

**Question:** "Is this a flight search engine?"  
**Answer:** "No. This is a flight decision system. It scores flights, predicts risks, and protects your trip."

**Question:** "What does it help me decide?"  
- Should I buy this flight?
- Should I wait?
- What's the risk?
- What happens after I book?

**Question:** "How is this different from Skyscanner?"  
"Skyscanner sorts by price. Flight AI helps you decide by analyzing value, risk, comfort, and reliability."

---

## Core Flows: The 4 Main User Journeys

### Flow 1: Score a Flight
**User Question:** "Should I book this flight I found?"
- Entry: "Score a Flight" CTA on homepage
- Action: Paste flight URL or enter details
- Output: Score (0-10), decision (BUY/WAIT/AVOID), risk analysis, explanations

### Flow 2: Track a Route
**User Question:** "Is there a better time to book this route?"
- Entry: "Track Route" in nav or flight result cards
- Action: Set departure/return dates, cabin preference
- Output: Price alerts, deal recommendations, historical trends

### Flow 3: Track Your Booking
**User Question:** "What could go wrong with my booked flight?"
- Entry: "Add Trip" in dashboard (forward PNR email or enter PNR code)
- Action: System parses booking and starts monitoring
- Output: Live flight status, gate changes, delay predictions, EU261 eligibility

### Flow 4: Get Alerts
**User Question:** "Notify me when I need to act"
- Output: Severity-based alerts (HIGH/MEDIUM/LOW) via email/SMS/push
- Triggers: Price drops, schedule changes, gate changes, delays, cancellations

---

## Navigation Architecture (New)

### Top-Level Navigation
```
Flight Agent
├── Home
├── Analyze Flight  [new]
├── Track Route     [new]
├── Pricing
└── Learn           [renamed from "Travel Tips"]
```

### Removed/Renamed
- ❌ "Search Flights" (primary nav) → "Analyze Flight" (primary flow)
- ✅ "Travel Tips" → "Learn" (broader, educational positioning)
- ✅ "Search & Track" becomes two distinct flows

---

## Key Value Props (Reframed)

### OLD VALUE PROPOSITION
"Find the cheapest flights and track prices"

### NEW VALUE PROPOSITION
"Analyze flights by 10 criteria (value, risk, comfort, reliability), track disruptions, and protect your trip 24/7"

### Breaking it down:

| Aspect | Before | After |
|--------|--------|-------|
| **Goal** | Find deals | Make decisions |
| **Process** | Search + compare | Analyze + score |
| **Timeframe** | Before booking | Before AND after booking |
| **Success Metric** | Lowest price | Best decision |
| **User Mindset** | "Find flights" | "Decide on flights" |
| **Comparison** | vs other searchers | vs flight booking regret |

---

## Homepage Hero Section (Proposed)

### BEFORE
```
Your Personal Flight Decision Intelligence

Know when to buy, when to wait, and when to act. 
FlightAgent scores your flight, tracks disruptions, 
and protects your trip — automatically.

[Start Exploring]  [Learn More]
```

### AFTER (No change - it's already good!)
The current hero is already aligned with decision-first positioning. 
It correctly emphasizes "know when to buy/wait/act" and "decision intelligence."

---

## Why This Repositioning Works

### 1. **Differentiates from Skyscanner, Kayak, Google Flights**
- Those are search/comparison tools
- Flight AI is a decision + protection tool
- Different product category = different messaging

### 2. **Matches Actual Product Capability**
- The scoring engine is sophisticated (10 criteria)
- The Guardian worker runs 24/7 monitoring
- The notifications are severity-aware and actionable
- These aren't "search" features—they're "decision" and "protection" features

### 3. **Reduces Feature Confusion**
- Users stop expecting "I want to search everywhere"
- Users understand "I want to score one flight" or "I want to track this route"
- Clearer mental model = less support burden

### 4. **Justifies Premium Pricing**
- Search tools are commoditized (price competition)
- Decision tools command higher value (risk reduction, peace of mind)
- Protection is worth paying for

### 5. **Enables Better Marketing**
- "Score a Flight" is more actionable than "Search Flights"
- "Protect Your Trip" resonates emotionally
- "24/7 Guardian Monitoring" is powerful vs "Compare Prices"

---

## Implementation Checklist

### Tier 1: Critical (User-Facing Copy)
- [ ] messages/en.json - all string updates
- [ ] messages/tr.json - Turkish translations (score variant)
- [ ] messages/de.json - German translations (score variant)
- [ ] components/Navbar.tsx - nav labels
- [ ] app/[locale]/(public)/page.tsx - homepage hero section updates

### Tier 2: Supporting (Supporting Pages)
- [ ] app/[locale]/blog/page.tsx - blog landing page
- [ ] app/lib/blog-data.ts - blog marketing copy
- [ ] components/BackToSearchButton.tsx - CTA label
- [ ] components/DataSourceIndicator.tsx - marketing copy

### Tier 3: Secondary (Translations)
- [ ] Complete Turkish translations (tr.json)
- [ ] Complete German translations (de.json)

---

## Expected User Impact

### Metrics to Track Post-Launch

| Metric | Baseline | Target | Rationale |
|--------|----------|--------|-----------|
| CTR: "Score a Flight" button | TBD | +25% | More intuitive CTA |
| Conversion (score → track) | TBD | +15% | Better positioning on decision flow |
| Premium upgrade rate | TBD | +10% | Higher perceived value |
| Support tickets: "What do you do?" | TBD | -20% | Clearer positioning |
| Homepage bounce rate | TBD | -10% | Better messaging alignment |

---

## Files Affected

### JSON Translation Files
- `messages/en.json` - 18 key updates
- `messages/tr.json` - Needs translation update
- `messages/de.json` - Needs translation update

### React Components
- `components/Navbar.tsx` - Nav label changes
- `components/search/SearchForm.tsx` - Button label (via translation)
- `components/DataSourceIndicator.tsx` - Marketing copy updates
- `components/BackToSearchButton.tsx` - Button label (via translation)
- `components/dashboard/AddTripModal.tsx` - CTA label (via translation)

### Page Components
- `app/[locale]/(public)/page.tsx` - Hero CTA updates
- `app/[locale]/blog/page.tsx` - Blog page copy
- `app/lib/blog-data.ts` - Blog card titles & excerpts

---

## Rollout Strategy

### Phase 1: Messaging (Immediate)
1. Update en.json with all changes
2. Test on staging
3. Deploy to production
4. Monitor CTR and conversion metrics

### Phase 2: Translations (1 week)
1. Update tr.json and de.json
2. QA with native speakers
3. Deploy

### Phase 3: Supporting Assets (2 weeks)
1. Update blog content and marketing copy
2. Create "What We Do" explainer page
3. Update help docs and FAQ

---

## Success Criteria

✅ **5-Second Test:** New user instantly understands:
  - "This is NOT a search tool"
  - "This helps me make better flight decisions"
  - "This tracks my flights and protects my trip"

✅ **Messaging Consistency:** All user-facing copy uses:
  - "Score/Analyze" instead of "Search/Find"
  - "Decide/Decision" instead of "Deal/Price"
  - "Protect/Track" instead of "Monitor/Alert"

✅ **Reduced Confusion:** Support tickets about "Why is this a search tool?" drop by 50%

✅ **Premium Value:** Users understand they're paying for:
  - Better decisions (not just lower prices)
  - Risk protection (not just price tracking)
  - Peace of mind (not just a search feature)

---

## Example Product Description (New)

**OLD:**
"Flight AI is a flight search and price tracking platform that helps you find the cheapest flights."

**NEW:**
"Flight AI is a flight decision and protection system. It scores flights across 10 criteria (value, risk, comfort, reliability), predicts disruptions, and monitors your booked flight 24/7. Make better booking decisions and travel with confidence."

---

## Q&A: Addressing Common Objections

**Q: Won't users expect a search feature?**  
A: Users see "Analyze Flight" and understand they can paste any flight URL to score it. This is more powerful than search—it works on flights from anywhere.

**Q: Shouldn't we keep "Search" in the nav?**  
A: No. "Track Route" is more accurate and directs users to the monitoring feature, which is differentiated and valuable.

**Q: What about SEO for "flight search"?**  
A: Good news: We still have search functionality in the FlightSearch page. The page is titled "Score & Track Your Flights," not "Search Flights." SEO will adapt.

**Q: Is this too big a pivot?**  
A: This isn't a pivot—it's a repositioning of the existing product. We've always had scoring, tracking, and protection. We're just being honest about what we offer.

---

## Appendix: Translation Notes

### Key Terms to Translate

| English | Turkish | German |
|---------|---------|--------|
| Analyze Flight | Uçuşu Analiz Et | Flug Analysieren |
| Track Route | Rotayı Takip Et | Route Verfolgen |
| Score This Flight | Bu Uçuşu Puanla | Diesen Flug Bewerten |
| Know before you book | Satın almadan önce bilin | Wissen Sie vor dem Buchen |
| Make smarter flight decisions | Daha iyi uçuş kararları verin | Bessere Flugentscheidungen treffen |

---

**Document Version:** 1.0  
**Last Updated:** April 23, 2026  
**Status:** Ready for Implementation

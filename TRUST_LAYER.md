# Trust Layer Implementation Guide

## Overview

The Flight AI system now includes a comprehensive **Trust Layer** that makes the system's knowledge, limitations, and confidence explicit to users. This document explains:

1. **What users see** - The new UI patterns for trust signals
2. **How it works** - Technical implementation
3. **Where it appears** - Which components include trust features

---

## Goal

**Users should feel:**
> "I understand what this system knows and what it doesn't."

### Success Indicators

✅ Confidence is shown as: `62% (Moderate) — based on partial itinerary data`  
✅ Data sources are visible with freshness timestamps  
✅ Limitations are disclosed upfront ("Baggage data incomplete")  
✅ "Why this score?" is expandable to show factors  
✅ No fake precision (no "guaranteed" language)  
✅ No over-confident wording when data is limited  

---

## Core Components

### 1. TrustSignal (`components/trust/TrustSignal.tsx`)

Standardized confidence display showing:
- Percentage + label (Low/Moderate/High) 
- Short explanation
- Data source & timestamp
- Missing data indicators

```tsx
<TrustSignal
  confidence={62}
  explanation="Based on partial itinerary data"
  missingData={["Baggage data incomplete", "Real-time availability unknown"]}
  dataSource="DUFFEL"
  timestamp={new Date()}
  compact={false}
/>
```

**Output:**
```
Confidence: 62% (Moderate) — based on partial itinerary data

━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ Data limitations:
  • Baggage data incomplete
  • Real-time availability unknown

Source: DUFFEL
Last updated: 2m ago (Apr 22, 2026, 3:45 PM)
```

### 2. ConfidenceBreakdown (`components/trust/ConfidenceBreakdown.tsx`)

Expandable "Why this score?" section showing factors that:
- **Increased confidence** (✓) - What helped
- **Reduced confidence** (−) - What hurt  
- **Missing data** (?) - What's unknown

```tsx
<ConfidenceBreakdown
  confidence={62}
  positiveFactors={[
    { label: 'Price below route average', explanation: 'Cheaper than typical...' }
  ]}
  negativeFactors={[
    { label: 'Partial itinerary', explanation: 'Missing seat details...' }
  ]}
  neutralFactors={[
    { label: 'Baggage data unavailable', explanation: 'Can\'t verify final cost...' }
  ]}
/>
```

### 3. DataSourceBadge (`components/trust/DataSourceBadge.tsx`)

Shows where data comes from with metadata:
- Provider name (DUFFEL, PRICELINE, internal estimate)
- Freshness (live vs. cached)
- Credibility score
- Hover tooltip with explanation

```tsx
<DataSourceBadge
  source={{
    name: 'duffel',
    label: 'DUFFEL',
    isLive: true,
    lastUpdated: new Date(),
    explanation: 'Real-time from official airline APIs',
  }}
  compact={false}
  showExplanation={true}
/>
```

### 4. LimitationDisclosure (`components/trust/LimitationDisclosure.tsx`)

Alert-style disclosure of data gaps:
- Missing data (warning severity)
- Incomplete features (info severity)
- Impact on score/recommendation

```tsx
<LimitationDisclosure
  limitations={[
    {
      id: 'baggage',
      title: 'Baggage data incomplete',
      description: 'We don\'t have full baggage details...',
      severity: 'warning',
      impact: 'Final ticket price may be higher',
    }
  ]}
/>
```

### 5. MethodologyLink (`components/trust/MethodologyLink.tsx`)

Links to "How we calculate scores" documentation:
- Section-specific anchors (scoring, confidence, data-sources)
- Compact or full card display
- Call-to-action for transparency

```tsx
<MethodologyLink section="scoring" compact={true} />
```

---

## UI Patterns

### Pattern 1: Confidence Display

**Standard Format:**
```
Confidence: 62% (Moderate) — based on partial itinerary data
━━━━━━━━━━━━━━━━━━━━━━━
[████░░░░░░░░] 62%
```

**Labels:**
- 80%+ = "High" (green)
- 60-79% = "Moderate" (blue)
- 40-59% = "Low" (amber)
- <40% = "Very Low" (red)

### Pattern 2: Data Source Badge

**Compact (in result cards):**
```
🏛️ DUFFEL (2m ago) ●
```

**Full (on detail pages):**
```
[🏛️ DUFFEL] (Live, 2m ago)
Real-time data from official airline APIs
```

### Pattern 3: Limitation Disclosure

**Warning (affects score):**
```
⚠️ Baggage data incomplete
  We don't have full baggage details.
  Impact: Final ticket price may be higher due to fees
```

**Info (missing features):**
```
ℹ️ Real-time seat map unavailable
  We can't show live seat availability.
  Impact: Delay risk estimate is route-based only
```

### Pattern 4: Factor Breakdown

```
Why this score?
Confidence: 62%

↑ Increased confidence (3 factors)
  + Price below route average
  + Direct flight available
  + Good airline reliability

↓ Reduced confidence (1 factor)
  − Early morning departure

? Missing data (2 factors)
  ? Real-time seat map unavailable
  ? Baggage policy unavailable
```

---

## Integration Points

### In FlightResultCard

**Where it appears:**
- Main intelligence panel (new Trust Layer section)
- Shows: confidence, data source, limitations, factor breakdown

**What's new:**
- TrustSignal replaces simple "High/Moderate/Low" badge
- DataSourceBadge shows where data came from
- LimitationDisclosure alerts about incomplete data
- ConfidenceBreakdown (PRO+ only) explains what affected score
- MethodologyLink footer directs to documentation

### In DataSourceIndicator

**Where it appears:**
- Above search results, showing active data providers

**What's new:**
- "Updated moments ago" timestamp
- Info box explaining why we use multiple sources
- Live data badge per source
- Source distribution explanation
- Link to data source methodology

### In FlightDetailDialog (Future)

**Coming soon:**
- Confidence breakdown for each metric
- Data source per metric
- Limitation disclosures per section

---

## Data Honesty Principles

✅ **Show, don't hide:**
- Limitations are upfront, not hidden behind paywalls
- Missing data is disclosed as "Unknown", not inferred as fact

✅ **No fake precision:**
- Never show "guaranteed" or "certain" if confidence is <80%
- Never show exact percentages (e.g., "18.4%") — use semantic labels
- Always pair numbers with confidence ranges

✅ **Explain the tradeoff:**
- "Why is confidence only 62%?" → Because baggage data is missing
- "Why didn't you predict a delay?" → Because historical data wasn't available
- "Why is this score different?" → Because new data became available

✅ **Empower users:**
- Show "why this score?" expandable
- Link to methodology so they understand how we work
- Show alternative scenarios ("If baggage was included, confidence would be 75%")

---

## For Developers

### Adding Trust Signals to a Component

1. **Import the components:**
```tsx
import { TrustSignal, DataSourceBadge, LimitationDisclosure, ConfidenceBreakdown, MethodologyLink } from '@/components/trust';
```

2. **Collect confidence data:**
```tsx
const confidence = flight.advancedScore?.confidence ?? null;
const dataSource = 'duffel' | 'priceline' | 'internal';
const limitations = [/* array of Limitation objects */];
```

3. **Render in order:**
```tsx
<TrustSignal confidence={confidence} missingData={...} />
<DataSourceBadge source={...} />
<LimitationDisclosure limitations={...} />
<ConfidenceBreakdown confidence={...} />
<MethodologyLink section="scoring" />
```

### Creating New Limitation Types

```tsx
const limitations = [
  {
    id: 'unique-id',
    title: 'Human-readable title',
    description: 'Explanation of what\'s missing',
    severity: 'warning' | 'info',
    impact: 'How this affects the score/recommendation',
  }
];
```

### Extending TrustSignal

For custom confidence ranges:
```tsx
// In TrustSignal.tsx, modify getConfidenceLabel() and getConfidenceLabelColor()
if (percent >= 90) return 'Very High'; // add new category
```

---

## User Experience

### For Free Users

- See: Confidence, data sources, limitations
- Don't see: Factor breakdown ("Why this score?") detail
- See paywall: "Unlock to see what factors increased/decreased this score"

### For PRO+ Users

- See everything: Confidence, sources, limitations, factor breakdown
- Can expand "Why this score?" to understand score drivers
- See MethodologyLink details

---

## Success Metrics

Track these metrics to validate trust layer success:

1. **Engagement:**
   - % users expanding "Why this score?" (goal: 5-10%)
   - % users clicking MethodologyLink (goal: 2-5%)
   - Hover time on DataSourceBadge (goal: >1s)

2. **Confidence in System:**
   - Survey: "I understand how this score was calculated" (goal: >70% agree)
   - Survey: "I trust the data sources" (goal: >65% agree)
   - Support tickets about "fake precision" or "hidden costs" (goal: <2% of total)

3. **Decision Quality:**
   - Users with high-confidence scores → lower regret rate
   - Users who expand "Why this score?" → higher satisfaction
   - Users who read limitations → fewer "surprise fees" complaints

---

## Files Changed

✅ `components/trust/TrustSignal.tsx` - New component  
✅ `components/trust/ConfidenceBreakdown.tsx` - New component  
✅ `components/trust/DataSourceBadge.tsx` - New component  
✅ `components/trust/LimitationDisclosure.tsx` - New component  
✅ `components/trust/MethodologyLink.tsx` - New component  
✅ `components/trust/index.ts` - Export barrel  
✅ `components/search/FlightResultCard.tsx` - Updated to use TrustSignal + friends  
✅ `components/DataSourceIndicator.tsx` - Enhanced with timestamps & transparency  

---

## Next Steps

1. **Create `/methodology` page** that explains:
   - How we calculate scores
   - What confidence means
   - Data sources and their tradeoffs
   - How factors affect confidence

2. **A/B test** showing/hiding trust signals
   - Hypothesis: More transparency → higher trust + willingness to book
   - Measure: Booking rate, regret rate, satisfaction

3. **Extend to other pages:**
   - ScoreFlight page (already has good transparency)
   - FlightDetailDialog (add per-metric trust signals)
   - Price history chart (show data freshness)
   - Guardian monitoring (show data quality)

4. **Collect user feedback:**
   - "Is this clear?" polls on trust signal components
   - "What questions do you have?" open feedback
   - Support ticket analysis for transparency issues

---

## Questions & Support

If you have questions about the trust layer:

1. Check this guide's "Integration Points" section
2. Review component prop documentation in `.tsx` files
3. Look at FlightResultCard for usage examples
4. Ask for help in #engineering-questions

---

**Last updated:** April 22, 2026  
**Trust Layer Status:** ✅ Production-ready  
**Version:** 1.0

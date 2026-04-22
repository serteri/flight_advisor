# Confidence Score & Explanation Display Audit

## Executive Summary
The codebase has multiple locations displaying confidence scores, recommendations, and explanations. Current displays range from full transparency (detailed dialogs) to partial opacity (blurred premium features). **Major finding:** Data source visibility and limitation disclosures are scattered and incomplete.

---

## 1. PRIMARY SCORE & RECOMMENDATION DISPLAYS

### 1.1 FlightResultCard.tsx (Main Search Results)
**File:** [components/search/FlightResultCard.tsx](components/search/FlightResultCard.tsx)
**What's shown:**
- **Display Score:** Composite score (0-10) prominently displayed
- **Confidence Indicator:** Yes, via `confidenceScore` field (shown as percent or "High/Moderate/Low" label)
- **Decision Recommendation:** BUY_NOW | WAIT | AVOID with decision reason
- **Data Source Label:** Top-left badge showing "DUFFEL" or "PRICELINE"
- **Explanation:** Decision reason text and `decisionReason` field

**Current Pattern:**
```tsx
// Score display
displayScore = Number.isFinite(displayScore) ? displayScore.toFixed(1) : '0.0'

// Decision recommendation
<span className="text-lg text-lime-400 font-medium mt-2">
  {data.recommendation}
</span>

// Confidence (if >= 60%)
{confScore !== null && confScore >= 60 && (
  <span className="text-xs font-bold text-slate-700">
    {confLabel} (${confScore}%)
  </span>
)}

// Decision reason
{decisionReason && (
  <div className="font-medium mt-1">{decisionReason}</div>
)}

// Risk insight (premium, blurred for free users)
{flight.advancedScore?.regretInsight && (
  <p className={`text-xs font-semibold ${!hasPremiumAccess ? 'blur-[3px] select-none' : ''}`}>
    🧠 {flight.advancedScore?.regretInsight}
  </p>
)}
```

**Missing/Hidden:**
- ❌ Why the score was calculated this way (no "breakdown" shown inline)
- ❌ Data source bias/limitations not explained
- ❌ Missing data factors not disclosed
- ❌ Confidence score hidden when < 60%
- ⚠️ Amenities (meal, wifi, baggage) blurred for free users

---

### 1.2 FlightDetailDialog.tsx (Full Details Modal)
**File:** [components/FlightDetailDialog.tsx](components/FlightDetailDialog.tsx#L473)
**What's shown:**
- **Score Breakdown:** 10 detailed metric scores (price, duration, stops, connection, self-transfer, baggage, reliability, aircraft, amenities, airport-index)
- **Confidence Score:** Displayed with color-coded indicator
- **Data Quality Flag:** "invalid" state triggers error message
- **Risk Flags:** List of identified risks (premium feature, blurred for free)
- **Comfort Notes:** Positive indicators (premium feature, blurred for free)
- **Explanation Engine:** Full explanation text if available (premium, blurred for free)
- **Counterfactual Note:** Alternative scenario explanation
- **Value Tag:** "Best Value", "Budget Option", etc.
- **Amenities:** Meal, WiFi, cabin class

**Current Pattern:**
```tsx
// Confidence display with color
const confDot = confVal === null ? 'bg-slate-400' : confVal >= 80 ? 'bg-green-500' : 'bg-amber-400'
const confText = confVal === null ? 'Confidence unavailable' : confVal >= 80 ? `High (${confVal}%)` : `Moderate (${confVal}%)`

// Data quality error
{advScore?.dataQuality === 'invalid' && (
  <div className="bg-red-50 border border-red-200 rounded p-3">
    <h3>⚠️ Data Error</h3>
    <p>{advScore.dataErrorReason || labels.dataErrorFallback}</p>
  </div>
)}

// Explanation (blurred for free users)
{advScore?.explanation && (
  <div className={`bg-indigo-50 ${!hasPremiumAccess ? 'blur-[3px]' : ''}`}>
    <h3>🧠 Explanation Engine</h3>
    <p>{advScore.explanation}</p>
  </div>
)}

// Risk flags & comfort notes (blurred for free users)
<div className={`grid grid-cols-2 ${!hasPremiumAccess ? 'blur-[3px]' : ''}`}>
  <div className="bg-rose-50">
    <h3>🚩 Risk Flags</h3>
    {advScore.riskFlags.map(flag => <li>• {flag}</li>)}
  </div>
  <div className="bg-emerald-50">
    <h3>🛡️ Comfort Notes</h3>
    {advScore.comfortNotes.map(note => <li>• {note}</li>)}
  </div>
</div>
```

**Missing/Hidden:**
- ❌ Data source confidence breakdown (which metric came from which source)
- ❌ Missing data impact on score not explained
- ❌ Historical vs. live data usage not labeled for each metric
- ⚠️ Premium feature paywall prevents free users from seeing explanations
- ❌ No "how this compares to similar flights" benchmark

---

### 1.3 ScoreFlight Page (Manual Score Tool)
**File:** [app/[locale]/(public)/score-flight/page.tsx](app/[locale]/(public)/score-flight/page.tsx#L447)
**What's shown:**
- **Composite Score:** Large display with confidence percentage
- **Recommendation Explanation:** Primary reason + supporting reasons
- **Positive/Negative Factors:** Categorized lists (3-column layout)
- **Missing Factors:** Data gaps that affected the score
- **Risk Flags:** Warning indicators
- **Comfort Notes:** Positive notes
- **Parse Confidence:** How confident was the input parsing (0-100%)
- **Baggage Confidence:** Baggage data quality (0-100%)
- **Derived Metrics:** Connection feasibility, route realism, airline reliability mix

**Current Pattern:**
```tsx
// Decision display
<span className={`text-3xl font-black ${decision.color}`}>{decision.label}</span>
<span className="text-xs text-slate-400">{result.insights.confidence}% confidence</span>

// Primary reason
<p className="text-sm text-slate-800 font-medium">
  {result.recommendationExplanation.primaryReason}
</p>

// Supporting reasons
{result.recommendationExplanation.supportingReasons.map((reason, i) => (
  <li>{reason}</li>
))}

// Factor breakdown
<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
  <div className="rounded-xl border border-emerald-200 bg-emerald-50">
    <div className="text-xs font-bold text-emerald-700">Positive factors</div>
    {result.recommendationExplanation.positiveFactors.map(item => <li>• {item}</li>)}
  </div>
  <div className="rounded-xl border border-red-200 bg-red-50">
    <div className="text-xs font-bold text-red-700">Negative factors</div>
    {result.recommendationExplanation.negativeFactors.map(item => <li>• {item}</li>)}
  </div>
  <div className="rounded-xl border border-amber-200 bg-amber-50">
    <div className="text-xs font-bold text-amber-700">Missing factors</div>
    {result.recommendationExplanation.missingFactors.map(item => <li>• {item}</li>)}
  </div>
</div>

// Parse confidence metrics
<div><span>Parse confidence</span>{Math.round(result.parseConfidence * 100)}%</div>
<div><span>Baggage confidence</span>{Math.round(result.derivedMetrics.baggageConfidenceScore * 100)}%</div>
```

**Missing/Hidden:**
- ❌ No source attribution per metric
- ❌ No timestamp showing when data was last refreshed
- ❌ No explanation of methodology behind scoring

---

## 2. SECONDARY INTELLIGENCE DISPLAYS

### 2.1 VerdictCard.tsx (Compact Recommendation)
**File:** [components/VerdictCard.tsx](components/VerdictCard.tsx)
**What's shown:**
- **Decision:** Recommended | Consider | Avoid
- **Badge:** Visual icon and color coding
- **Headline:** Main recommendation text
- **Pros:** Up to 3 positive factors
- **Cons:** Up to 3 negative factors
- **Warning Banner:** Special alerts (optional)
- **Trade-off Footer:** Context about compromises
- **Scenario Simulation:** Hypothetical journey description
- **Social Proof:** User behavior patterns ("62% of users avoided this layover")

**Pattern:**
```tsx
const styles = {
  recommended: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: CheckCircle2 },
  consider: { bg: 'bg-amber-50', border: 'border-amber-200', icon: Info },
  avoid: { bg: 'bg-red-50', border: 'border-red-200', icon: AlertOctagon }
}

// Pros & cons
{pros.slice(0, 3).map(pro => (
  <div className="flex items-center gap-1.5 text-xs text-emerald-700">
    <ThumbsUp className="w-3 h-3" />
    <span>{pro}</span>
  </div>
))}

// Warning
{verdict.warning && (
  <div className="bg-amber-100 px-4 py-2 flex gap-2">
    <AlertTriangle className="w-4 h-4 text-amber-600" />
    <p className="text-xs text-amber-800">{verdict.warning}</p>
  </div>
)}

// Trade-off
{verdict.tradeoff && (
  <div className="bg-slate-100 px-4 py-2 flex gap-2">
    <ArrowRightLeft className="w-3 h-3 text-slate-500" />
    <p className="text-xs text-slate-600">{verdict.tradeoff}</p>
  </div>
)}
```

**Missing:**
- ❌ No confidence indicator on verdict itself
- ❌ No source attribution
- ❌ No "why should you trust this?" transparency

---

### 2.2 PriceInsightCard.tsx (Price Trend Intelligence)
**File:** [components/PriceInsightCard.tsx](components/PriceInsightCard.tsx)
**What's shown:**
- **Risk Score:** 0-100 visual bar
- **Trend Action:** BUY_NOW | WAIT | MONITOR
- **Confidence Score:** Displayed with shield icon
- **Risk Signals:** List of evidence factors driving the forecast
- **Call to Action:** Specific recommendation text

**Pattern:**
```tsx
// Risk bar with color coding
<div className="h-2 bg-white rounded-full">
  <div
    className={`h-full ${forecast.riskScore >= 70 ? 'bg-red-500' : forecast.riskScore >= 40 ? 'bg-amber-500' : 'bg-emerald-500'}`}
    style={{ width: `${forecast.riskScore}%` }}
  />
</div>

// Confidence display
<span className="text-xs text-slate-500">
  {t('confidence')}: %{forecast.confidence}
</span>

// Signal evidence
{forecast.reasons.map(reason => (
  <div className="flex items-start gap-2 text-xs text-slate-700">
    <Info size={12} className="mt-0.5 opacity-60" />
    <span>{getSignalText(reason)}</span>
  </div>
))}
```

**Missing:**
- ❌ No timestamp of when prediction was generated
- ❌ No historical accuracy metric shown
- ❌ No explanation of what "risk score" actually measures

---

### 2.3 PremiumAnalysisCard.tsx (Guardian Score Card)
**File:** [components/analysis/PremiumAnalysisCard.tsx](components/analysis/PremiumAnalysisCard.tsx)
**What's shown:**
- **Guardian Score:** Large numeric display (0-100?)
- **Recommendation Text:** Human-readable verdict
- **Pros/Cons:** Two-column layout with 5+ factors each

**Missing:**
- ❌ No confidence indicator
- ❌ No methodology explanation
- ❌ No data source attribution

---

### 2.4 MasterScoreCard.tsx (Tiered Metric Display)
**File:** [components/flights/MasterScoreCard.tsx](components/flights/MasterScoreCard.tsx)
**What's shown:**
- **Public Metrics:** Price value, duration, route efficiency (always visible)
- **Guardian Intelligence:** Risk status, comfort level, hidden costs (locked for free users)
- **Status Labels:** EXCELLENT | AVERAGE | WARNING
- **Progress Bars:** Visual representation of each metric
- **Description:** Narrative explanation of status

**Pattern:**
```tsx
// Public metrics
<div className="space-y-3">
  {renderBar(scoreData.priceScore, 25, "Price Value", <TrendingUp />)}
  {renderBar(scoreData.durationScore, 15, "Flight Duration", <Clock />)}
</div>

// Locked guardian intelligence
<div className={`space-y-4 ${!hasPremiumAccess ? 'filter blur-sm opacity-50' : ''}`}>
  <div className="flex items-start gap-3">
    <div className={riskStatus.bg}>
      <AlertTriangle className="w-4 h-4" />
    </div>
    <div>
      <div className="font-semibold">Risk Status</div>
      <p className="text-sm text-gray-600">{riskStatus.desc}</p>
    </div>
  </div>
</div>
```

**Missing:**
- ❌ No breakdown of how metrics were calculated
- ❌ No data source labels on individual metrics

---

## 3. DATA SOURCE INDICATORS

### 3.1 DataSourceIndicator.tsx (Search Results Header)
**File:** [components/DataSourceIndicator.tsx](components/DataSourceIndicator.tsx)
**What's shown:**
- **Active Sources:** Grid display showing DUFFEL | PRICELINE status
- **Flight Count:** Per source (e.g., "DUFFEL: 45", "PRICELINE: 23")
- **Status Badges:** CheckCircle, Loader, or XCircle indicators
- **Active Ratio:** "2/2 sources active"

**Current Code:**
```tsx
<div className="grid grid-cols-2 gap-3">
  {sources.map(source => (
    <div className={`border-2 ${source.status === 'active' ? `border-${source.color}-200` : 'border-slate-100'}`}>
      <span className="uppercase tracking-wide">{source.name}</span>
      {source.status === 'active' 
        ? <CheckCircle /> 
        : <XCircle />}
      <div className="text-xl font-black">{source.count}</div>
    </div>
  ))}
</div>
```

**Missing:**
- ❌ No explanation of what each source provides
- ❌ No timestamp showing when data was last fetched
- ❌ No indication if one source is more reliable than the other
- ❌ No bias disclosure about source preferences

---

### 3.2 Source Labels in FlightResultCard
**Location:** Top-left badge + provider badge
**Current display:**
```tsx
// Top-left corner
<span className={`text-[10px] font-black px-3 py-1 ${src === 'duffel' ? 'bg-emerald-600' : 'bg-blue-600'}`}>
  {sourceLabel}  {/* "DUFFEL" or "PRICELINE" */}
</span>

// Next to flight number
<span className={`text-[10px] font-bold px-2 py-0.5 rounded-full`}>
  {sourceSubLabel}  {/* "🏛️ Duffel" or "⚡ Priceline" */}
</span>
```

**Missing:**
- ❌ No explanation of source differences
- ❌ No indication which source scored higher
- ❌ No "real-time vs. cached" indicator
- ❌ No data freshness timestamp

---

## 4. AMENITY & LIMITATION BADGES

### 4.1 BaggageBadge.tsx
**File:** [components/BaggageBadge.tsx](components/BaggageBadge.tsx)
**What's shown:**
- **Baggage Status:** "23kg included" | "Limited 8kg" | "Not included" | "Check with airline"
- **Color Coding:** Emerald (included), Amber (limited), Red (excluded), Gray (unknown)
- **Compact Option:** Full label or abbreviated version

**Pattern:**
```tsx
// Included baggage
<span className="bg-emerald-50 text-emerald-700">
  ✅ 23kg included
</span>

// Limited baggage
<span className="bg-amber-50 text-amber-600">
  🧳 8kg {compact ? '' : 'restricted'}
</span>

// Excluded
<span className="bg-red-50 text-red-600">
  🚫 Excluded
</span>
```

**Missing:**
- ❌ No explanation of why baggage is limited/excluded
- ❌ No "how confident are we in this data" indicator
- ❌ No link to full baggage policy details
- ❌ No price impact shown (e.g., "Add baggage for +$25")

---

### 4.2 FareExplainer.tsx (Turkish Fare Restrictions)
**File:** [components/FareExplainer.tsx](components/FareExplainer.tsx)
**What's shown:**
- **Baggage Restrictions:** "El bagajı sadece" vs "23kg+ dahil"
- **Refundability:** "İade edilebilir" vs "Dikkat: İade yok"
- **Change Flexibility:** "Tarih değişimi esnek" vs "Ücretli/kapalı"

**Pattern:**
```tsx
{restrictions.baggageIncluded === false ? (
  <> <span className="text-lg">🎒</span> Sadece El Bagajı (Ek ücret gerekir) </>
) : (
  <> <span className="text-lg">✅</span> 23kg+ Bagaj Dahil </>
)}

{restrictions.refundable ? (
  <> <span className="text-lg">🛡️</span> İade Edilebilir Bilet </>
) : (
  <> <span className="text-lg">⚠️</span> Dikkat: İade Yok (Para Yanar) </>
)}

<p className="text-xs opacity-70">
  *Bu analiz havayolu kurallarına göre yapılmıştır. Lütfen satın almadan önce detayları kontrol edin.
</p>
```

**Missing:**
- ❌ No data source for restriction info (airline website vs. cached)
- ❌ No confidence score on restrictions
- ❌ No timestamp of last verification

---

### 4.3 AmenityBadges.tsx (Quick Amenity Summary)
**File:** [components/AmenityBadges.tsx](components/AmenityBadges.tsx)
**What's shown:**
- **Baggage Included:** Badge with logic hierarchy (backend flag > weight > airline DB)
- **Meal Included:** Badge (airline DB lookup)
- **Entertainment:** Badge (airline DB lookup)

**Missing:**
- ❌ No indication of data source confidence
- ❌ No "verify with airline" CTA when uncertain
- ❌ No timestamp showing when airline DB was last updated

---

## 5. SCORING METHODOLOGY & LOGIC LOCATIONS

### 5.1 Core Scoring Engine
**File:** [lib/scoring/flightScoreEngine.ts](lib/scoring/flightScoreEngine.ts)
- Contains raw score calculation logic
- **Missing from UI:** No link to methodology explanation
- **Not displayed:** Individual metric weights or formulas

### 5.2 Confidence Calculation
**File:** [app/api/score-flight/route.ts](app/api/score-flight/route.ts#L79)
- `computeConfidenceCap()` - Determines confidence ceiling based on mode (quick/detailed) and missing data
- `computeModeConfidence()` - Blends parse confidence with base confidence
- **Missing from UI:** Explanation of confidence degradation factors

### 5.3 Score Types (TypeScript Definitions)
**File:** [lib/flightTypes.ts](lib/flightTypes.ts#L127)
- Contains `aiVerdict` interface with decision, badge, reason, pros, cons, warning, tradeoff, scenario, socialProof
- Contains confidence and breakdown fields in various score objects

---

## 6. TRANSPARENCY GAPS

| What's Missing | Location(s) | Impact | Priority |
|---|---|---|---|
| **Source Bias Explanation** | DataSourceIndicator, FlightResultCard | Users don't know if results favor one provider | HIGH |
| **Confidence Degradation Reasons** | All score displays | Unclear why confidence dropped to 50% vs 80% | HIGH |
| **Methodology Link** | All pages | No "how we score" transparency | HIGH |
| **Data Freshness Timestamp** | DataSourceIndicator, all scores | Users don't know if data is 1h or 24h old | HIGH |
| **Missing Data Impact** | scoreFlightPage shows missing factors, but not in FlightResultCard | Users see score but not what was missing to calculate it | MEDIUM |
| **Historical vs Live Data** | FlightDetailDialog mentions it, but not displayed to users | Confusing how "live average" differs from historical | MEDIUM |
| **Score Breakdown per Source** | FlightDetailDialog shows breakdown, but not which metric came from which source | Can't assess if DUFFEL vs PRICELINE is better for reliability | MEDIUM |
| **Amenity Confidence** | BaggageBadge, AmenityBadges | "Check with airline" shown, but no confidence % | MEDIUM |
| **Price Impact of Amenities** | BaggageBadge, FareExplainer | Known (e.g., "Add baggage +$25") but not shown | LOW |
| **Hidden Cost Disclosure** | MasterScoreCard hints at it, but minimal detail | Free users can't see what costs they're missing | MEDIUM |

---

## 7. PREMIUM PAYWALL PATTERNS

Features behind paywall (blurred for free users):
1. **Explanation Engine** - Full narrative explanation (FlightDetailDialog)
2. **Risk Flags** - Identified risks (FlightDetailDialog)
3. **Comfort Notes** - Positive factors (FlightDetailDialog)
4. **Regret Insight** - Psychological framing (FlightResultCard)
5. **Guardian Intelligence** - Risk/Comfort/Hidden Cost analysis (MasterScoreCard)
6. **Amenities in FlightResultCard** - Locked for inline display
7. **Price Intelligence** - Some advanced signals (PriceInsightCard)

---

## 8. COMPONENT HIERARCHY

```
SearchResults Page
├─ DataSourceIndicator (source status)
├─ FlightResultCard (main display, has score, confidence, recommendation)
│  ├─ BaggageBadge (baggage status)
│  ├─ AmenityBadges (meal, wifi, entertainment quick status)
│  └─ VerdictCard (compact recommendation card)
├─ FlightDetailDialog (full details modal)
│  ├─ Score Breakdown section (10 metrics)
│  ├─ Risk Flags section (locked)
│  ├─ Comfort Notes section (locked)
│  ├─ Explanation Engine section (locked)
│  ├─ Amenities section (meal, wifi, cabin class)
│  └─ Duration Debug section (dev only)
├─ MasterScoreCard (tiered display, locked guardian intelligence)
│  ├─ Public Metrics (always visible)
│  └─ Guardian Intelligence (locked)
└─ PremiumAnalysisCard (score + pros/cons)

ScoreFlightPage
├─ Decision display (composite score + confidence%)
├─ Recommendation explanation
├─ Factor breakdown (positive/negative/missing)
├─ Risk flags
├─ Comfort notes
└─ Parse confidence metrics

PriceInsightCard
├─ Trend indicator
├─ Confidence badge
└─ Signal evidence list
```

---

## Recommendations for Transparency

1. **Always Show Confidence %** - Don't hide when < 60%
2. **Data Freshness Badges** - "Updated 2h ago" on every score
3. **"Why This Score" Expandable** - Clickable breakdown without paywall
4. **Source Attribution** - Label each metric with its source
5. **Methodology Link** - "How we score" documentation link on every page
6. **Missing Data Disclosure** - Always show what data was unavailable
7. **Amenity Verification Date** - "Airline policies checked: Jan 15, 2024"
8. **Confidence Breakdown** - Show which factors lowered confidence
9. **Comparison Benchmarks** - "This is [better/worse] than 70% of flights on this route"
10. **"Ask Airline" CTAs** - When baggage/amenities marked unknown


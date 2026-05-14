"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
    BarChart3,
    Plane,
    Bell,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Shield,
    Loader2,
    ArrowLeft,
    TrendingDown,
    TrendingUp,
    Minus,
    Plus,
    Trash2,
    FileDown,
} from "lucide-react";
import { Link } from "@/i18n/routing";

type Decision = "BUY" | "WAIT" | "WATCH";
type TrustBadgeKind = "VERIFIED" | "USER PROVIDED" | "INFERRED" | "ESTIMATED" | "UNAVAILABLE" | "PARTIAL";

type SegmentInput = {
    from: string;
    to: string;
    departureDateTime: string;
    arrivalDateTime: string;
    airline: string;
    flightNumber: string;
    aircraft?: string;
    marketedAirline?: string;
    bookingClass?: string;
    tripDirection?: "OUTBOUND" | "INBOUND";
};

interface ScoreResult {
    decision: Decision;
    scoringMode?: "quick" | "detailed" | "paste";
    accuracyHint?: string;
    parseWarnings?: string[];
    parseConfidence?: number;
    needsReview?: boolean;
    extractedSegments?: SegmentInput[];
    inputSource?: "MANUAL_SEGMENTS" | "PARSED_TEXT";
    derivedMetrics?: {
        tripType: "ONE_WAY" | "ROUND_TRIP";
        totalSegments: number;
        totalDurationMinutes: number;
        totalLayoverMinutes: number;
        outboundDurationMinutes: number;
        inboundDurationMinutes: number;
        connectionCount: number;
        outboundConnectionCount: number;
        inboundConnectionCount: number;
        outboundLayoverMinutes: number;
        inboundLayoverMinutes: number;
        connectionFeasibility: string;
        routeRealism: string;
        airlineReliabilityMix: string;
        baggageConfidenceScore: number;
    };
    passengerPricingContext?: {
        adults: number;
        children: number;
        infants: number;
        totalTravelers: number;
        totalPrice: number;
        comparablePerTravelerPrice: number;
        mixedTravelerTypes: boolean;
    };
    insights: {
        decision: Decision;
        confidence: number;
        riskFlags: string[];
        comfortNotes: string[];
        explanation: string;
    };
    scoreTrust?: {
        reliabilityTier: "HIGH_RELIABILITY" | "MODERATE_RELIABILITY" | "LIMITED_RELIABILITY" | "PRELIMINARY_ESTIMATE";
        reliabilityLabel: "High Reliability" | "Moderate Reliability" | "Limited Reliability" | "Preliminary Estimate";
        reliabilityExplanation: string;
        dataReliabilityLabel: "HIGH" | "MEDIUM" | "LOW";
        dataReliabilityScore: number;
        whyReliabilityIsLimited: string[];
        verificationSummary: {
            verified: string[];
            inferred: string[];
            estimated: string[];
            uncertain: string[];
        };
        dataSourceDisclosure: {
            marketData: "LIVE_PROVIDER_DATA" | "HISTORICAL_ESTIMATE" | "INTERNAL_ESTIMATE";
            priceInput: "USER_PROVIDED_INPUT" | "PARSED_TEXT" | "INFERRED_TEXT" | "UNAVAILABLE_INPUT";
            baggageInput: "USER_PROVIDED_INPUT" | "PARSED_TEXT" | "INFERRED_TEXT" | "UNAVAILABLE_INPUT";
        };
    };
    recommendationExplanation?: {
        primaryReason: string;
        supportingReasons: string[];
        missingDataWarnings: string[];
        actionHint: string;
        positiveFactors: string[];
        negativeFactors: string[];
        missingFactors: string[];
    };
    scoreBreakdown?: Array<{
        component: "price" | "duration" | "connections" | "airlineReliability" | "baggage" | "routeRealism" | "comfort";
        label: string;
        points: number;
        maxPoints?: number;
        sourceReliability?: "HIGH" | "MEDIUM" | "LOW";
        reason: string;
    }>;
    confidenceInputs?: {
        priceSource?: string;
        baggageSource?: string;
        marketDataSource?: string;
        baseConfidence?: number;
        adjustedConfidence?: number;
        presentedConfidence?: number;
        mode?: "quick" | "detailed";
        completenessScore?: number;
        realismScore?: number;
        baggageConfidenceScore?: number;
        parseConfidence?: number;
        priceContextAvailable?: boolean;
        livePriceBenchmarkAvailable?: boolean;
        connectionFeasibility?: string;
        routeRealism?: string;
        warningSignals?: {
            totalWarnings: number;
            missingBaggage: number;
            missingPrice: number;
            missingSegmentTimes: number;
            routeMismatch: number;
            unrealisticLayover: number;
            chronologyIssues: number;
            partialExtraction: number;
            severityPenalty: number;
        };
        passengerPricingContext?: {
            adults: number;
            children: number;
            infants: number;
            totalTravelers: number;
            totalPrice: number;
            comparablePerTravelerPrice: number;
            mixedTravelerTypes: boolean;
        };
        dataReliabilityScore?: number;
        dataReliabilityLabel?: "HIGH" | "MEDIUM" | "LOW";
        reliabilityTier?: string;
    };
    premiumReport?: {
        executiveSummary: { title: string; summary: string; bullets: string[] };
        tripOverview: { title: string; summary: string; bullets: string[] };
        recommendationSummary: { title: string; summary: string; bullets: string[] };
        reliabilityAndVerification: { title: string; summary: string; bullets: string[] };
        routeAndConnectionAnalysis: { title: string; summary: string; bullets: string[] };
        airlineAndAircraftAnalysis: { title: string; summary: string; bullets: string[] };
        baggageAndFareConditions: { title: string; summary: string; bullets: string[] };
        riskAndDisruptionExposure: { title: string; summary: string; bullets: string[] };
        comfortAndFatigueAnalysis: { title: string; summary: string; bullets: string[] };
        pricingContext: { title: string; summary: string; bullets: string[] };
        keyRisks: { title: string; summary: string; bullets: string[] };
        whatWouldImproveThisItinerary: { title: string; summary: string; bullets: string[] };
        finalRecommendation: { title: string; summary: string; bullets: string[] };
    };
    trackingPayload?: {
        trackingType: "ITINERARY_CANDIDATE";
        trip: {
            origin: string;
            destination: string;
            departureDate: string;
            price: number;
            currency: string;
            cabin: "economy" | "premium" | "business" | "first";
            baggage: {
                checkedBaggageKg: number | null;
                cabinBaggageKg: number | null;
                included: boolean | null;
            };
            refundable: boolean | null;
            totalDurationMinutes: number;
            stops: number;
        };
        scoreSnapshot: {
            recommendation: Decision;
            confidence: number;
            primaryReason: string;
            positiveFactor: string | null;
            negativeFactor: string | null;
            missingFactor: string | null;
            actionHint: string;
            dataSourceType: "USER_PASTED_ITINERARY";
            realTimeDataAvailable: boolean;
        };
        segments: Array<{
            from: string;
            to: string;
            departureDateTime: string;
            arrivalDateTime: string;
            airline: string;
            flightNumber: string;
            aircraft?: string;
        }>;
    };
    score: {
        composite: number;
        buyWaitSignal?: { action: string; label?: string };
    };
}

const CURRENCY_OPTIONS = [
    "AUD",
    "USD",
    "EUR",
    "GBP",
    "CAD",
    "NZD",
    "SGD",
    "TRY",
    "JPY",
    "HKD",
    "AED",
] as const;

const getDefaultCurrency = (): string => {
    try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
        return tz.includes("Australia") ? "AUD" : "USD";
    } catch {
        return "USD";
    }
};

const toMoney = (value: number, currency: string): string => {
    if (!Number.isFinite(value)) return "-";
    return `${value.toFixed(2)} ${currency}`;
};

const DECISION_CONFIG: Record<Decision, { label: string; color: string; bg: string; border: string; icon: typeof CheckCircle2 }> = {
    BUY: {
        label: "BUY",
        color: "text-emerald-700",
        bg: "bg-emerald-50",
        border: "border-emerald-300",
        icon: TrendingDown,
    },
    WAIT: {
        label: "WAIT",
        color: "text-red-700",
        bg: "bg-red-50",
        border: "border-red-300",
        icon: TrendingUp,
    },
    WATCH: {
        label: "WATCH",
        color: "text-amber-700",
        bg: "bg-amber-50",
        border: "border-amber-300",
        icon: Minus,
    },
};

const emptySegment = (): SegmentInput => ({
    from: "",
    to: "",
    departureDateTime: "",
    arrivalDateTime: "",
    airline: "",
    flightNumber: "",
    aircraft: "",
    marketedAirline: "",
    bookingClass: "",
});

const tierStyle = (tier?: "HIGH_RELIABILITY" | "MODERATE_RELIABILITY" | "LIMITED_RELIABILITY" | "PRELIMINARY_ESTIMATE") => {
    if (tier === "HIGH_RELIABILITY") return "border-emerald-300 bg-emerald-50 text-emerald-800";
    if (tier === "MODERATE_RELIABILITY") return "border-sky-300 bg-sky-50 text-sky-800";
    if (tier === "LIMITED_RELIABILITY") return "border-amber-300 bg-amber-50 text-amber-800";
    return "border-orange-300 bg-orange-50 text-orange-800";
};

const reportSectionTone = (title: string): string => {
    const key = title.toLowerCase();
    if (key.includes('risk')) return 'border-red-200 bg-red-50';
    if (key.includes('reliability') || key.includes('verification')) return 'border-sky-200 bg-sky-50';
    if (key.includes('pricing')) return 'border-indigo-200 bg-indigo-50';
    if (key.includes('final recommendation')) return 'border-emerald-200 bg-emerald-50';
    return 'border-slate-200 bg-white';
};

const badgeStyle: Record<TrustBadgeKind, string> = {
    VERIFIED: "border-emerald-200 bg-emerald-50 text-emerald-700",
    "USER PROVIDED": "border-cyan-200 bg-cyan-50 text-cyan-700",
    INFERRED: "border-amber-200 bg-amber-50 text-amber-700",
    ESTIMATED: "border-indigo-200 bg-indigo-50 text-indigo-700",
    UNAVAILABLE: "border-red-200 bg-red-50 text-red-700",
    PARTIAL: "border-orange-200 bg-orange-50 text-orange-700",
};

const TrustBadge = ({ kind, label }: { kind: TrustBadgeKind; label?: string }) => (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${badgeStyle[kind]}`}>
        {label || kind}
    </span>
);

const sourceBadge = (source?: string): TrustBadgeKind => {
    if (!source) return "UNAVAILABLE";
    if (/USER_PROVIDED/.test(source)) return "USER PROVIDED";
    if (/PARSED|LIVE_PROVIDER/.test(source)) return "VERIFIED";
    if (/INFERRED/.test(source)) return "INFERRED";
    if (/HISTORICAL|INTERNAL|ESTIMATE/.test(source)) return "ESTIMATED";
    return "UNAVAILABLE";
};

const friendlySource = (source?: string): string => {
    if (!source) return "Unavailable";
    return source.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

const parserReliability = (result: ScoreResult): { label: "LOW" | "MODERATE" | "HIGH"; className: string; note: string } => {
    const parse = result.parseConfidence ?? result.confidenceInputs?.parseConfidence ?? 0;
    const warnings = result.parseWarnings?.length || 0;
    if (parse >= 0.82 && warnings === 0) {
        return {
            label: "HIGH",
            className: "border-emerald-200 bg-emerald-50 text-emerald-800",
            note: "Segments and key fields were extracted with limited ambiguity.",
        };
    }
    if (parse >= 0.55 || warnings <= 2) {
        return {
            label: "MODERATE",
            className: "border-amber-200 bg-amber-50 text-amber-800",
            note: "Some fields may be inferred or should be reviewed before relying on the score.",
        };
    }
    return {
        label: "LOW",
        className: "border-red-200 bg-red-50 text-red-800",
        note: "Extraction is partial. Review segment fields and missing inputs before using the recommendation.",
    };
};

const confidenceDrivers = (result: ScoreResult) => {
    const inputs = result.confidenceInputs;
    const positive: string[] = [];
    const negative: string[] = [];
    const missing: string[] = [];

    if ((inputs?.completenessScore || 0) >= 0.85) positive.push("Complete itinerary structure detected.");
    if ((inputs?.realismScore || 0) >= 0.85 || result.derivedMetrics?.routeRealism === "REALISTIC") positive.push("Route structure looks realistic.");
    if ((inputs?.parseConfidence || result.parseConfidence || 0) >= 0.8) positive.push("Parser reliability is high.");
    if (inputs?.priceSource === "USER_PROVIDED") positive.push("Fare was provided by the user.");
    if (inputs?.baggageSource === "USER_PROVIDED_BAGGAGE" || inputs?.baggageSource === "PARSED_BAGGAGE") positive.push("Baggage data has explicit support.");

    if (!inputs?.livePriceBenchmarkAvailable) negative.push("Live benchmark is unavailable; fare context is estimated or snapshot-based.");
    if (inputs?.baggageSource === "INFERRED_BAGGAGE") negative.push("Baggage allowance was inferred, not fare-confirmed.");
    if ((inputs?.warningSignals?.partialExtraction || 0) > 0) negative.push("Partial extraction required fallback assumptions.");
    if ((inputs?.warningSignals?.chronologyIssues || 0) > 0) negative.push("Timing or layover chronology conflicts were detected.");
    if (inputs?.passengerPricingContext?.mixedTravelerTypes) negative.push("Mixed traveler pricing required adult-equivalent comparison.");

    if (inputs?.priceSource === "UNAVAILABLE") missing.push("Fare input unavailable.");
    if (inputs?.baggageSource === "UNKNOWN_BAGGAGE") missing.push("Baggage allowance unavailable.");
    if ((inputs?.warningSignals?.missingSegmentTimes || 0) > 0) missing.push("Some segment times unavailable or inferred.");
    if (result.recommendationExplanation?.missingFactors?.length) missing.push(...result.recommendationExplanation.missingFactors.slice(0, 3));

    return {
        positive: positive.length ? positive : ["No strong positive confidence driver detected."],
        negative: negative.length ? negative : ["No major negative confidence driver detected."],
        missing: Array.from(new Set(missing)).length ? Array.from(new Set(missing)) : ["No critical missing information detected."],
    };
};

const contradictionSignals = (result: ScoreResult): string[] => {
    const signals: string[] = [];
    const reliability = result.scoreTrust?.dataReliabilityLabel;
    const score = result.score.composite;
    if (score >= 7.5 && reliability === "LOW") {
        signals.push("High score with low data reliability. Treat the recommendation as advisory, not decisive.");
    }
    if (result.decision === "BUY" && result.scoreTrust?.reliabilityTier === "LIMITED_RELIABILITY") {
        signals.push("Strong recommendation with limited reliability. Review uncertainty before booking.");
    }
    if (result.derivedMetrics?.routeRealism === "QUESTIONABLE" && result.insights.comfortNotes.length > 0) {
        signals.push("Comfort notes exist, but route realism is questionable.");
    }
    if (result.confidenceInputs?.priceSource === "UNAVAILABLE" && /price|fare/i.test(result.insights.explanation || "")) {
        signals.push("Pricing language appears despite unavailable fare input.");
    }
    if ((result.confidenceInputs?.warningSignals?.chronologyIssues || 0) > 0) {
        signals.push("Confidence reduced due to conflicting itinerary timing signals.");
    }
    return signals;
};

const impactDirection = (points: number, maxPoints = 10): { label: string; className: string } => {
    const ratio = maxPoints > 0 ? points / maxPoints : 0;
    if (ratio >= 0.75) return { label: "Positive impact", className: "text-emerald-700 bg-emerald-50 border-emerald-200" };
    if (ratio >= 0.45) return { label: "Mixed impact", className: "text-amber-700 bg-amber-50 border-amber-200" };
    return { label: "Negative impact", className: "text-red-700 bg-red-50 border-red-200" };
};

export default function ScoreFlightPage() {
    const router = useRouter();
    const pathname = usePathname();
    const [itineraryText, setItineraryText] = useState("");
    const [overrides, setOverrides] = useState({
        price: "",
        currency: getDefaultCurrency(),
        cabin: "",
        adults: "",
        children: "",
        infants: "",
        checkedBaggageKg: "",
        refundable: false,
    });
    const [segments, setSegments] = useState<SegmentInput[]>([]);
    const [segmentsManuallyEdited, setSegmentsManuallyEdited] = useState(false);
    const [lastScoringSource, setLastScoringSource] = useState<"parsed_text" | "manual_override" | null>(null);
    const [loading, setLoading] = useState(false);
    const [tracking, setTracking] = useState(false);
    const [downloadingReport, setDownloadingReport] = useState(false);
    const [tracked, setTracked] = useState(false);
    const [result, setResult] = useState<ScoreResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const updateSegment = (index: number, patch: Partial<SegmentInput>) => {
        setSegmentsManuallyEdited(true);
        setSegments((prev) => prev.map((segment, i) => (i === index ? { ...segment, ...patch } : segment)));
    };

    const addSegment = () => {
        setSegmentsManuallyEdited(true);
        setSegments((prev) => [...prev, emptySegment()]);
    };
    const removeSegment = (index: number) => {
        setSegmentsManuallyEdited(true);
        setSegments((prev) => prev.filter((_, i) => i !== index));
    };

    const handleTrackItinerary = async () => {
        if (!result?.trackingPayload) return;
        setTracking(true);
        setError(null);

        try {
            const res = await fetch("/api/track-itinerary", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(result.trackingPayload),
            });

            const data = await res.json();
            if (!res.ok) {
                setError(data?.error || "Failed to track itinerary");
                return;
            }

            setTracked(true);
            const locale = pathname?.split("/")[1] || "en";
            setTimeout(() => {
                router.push(`/${locale}/dashboard/tracked-flights`);
            }, 1200);
        } catch {
            setError("Failed to track itinerary. Please try again.");
        } finally {
            setTracking(false);
        }
    };

    const handleDownloadAdvisorReport = async () => {
        if (!result?.premiumReport) {
            setError("Advisor report is not available yet. Score an itinerary first.");
            return;
        }

        setDownloadingReport(true);
        setError(null);

        try {
            const res = await fetch("/api/score-flight/report-pdf", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    decision: result.decision,
                    scoreTrust: result.scoreTrust,
                    trackingPayload: result.trackingPayload,
                    premiumReport: result.premiumReport,
                    generatedAt: new Date().toISOString(),
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data?.error || "Failed to generate advisor report PDF.");
                return;
            }

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const trip = result.trackingPayload?.trip;
            const fileName = `advisor-report-${trip?.origin || "TRIP"}-${trip?.destination || "REPORT"}.pdf`;

            const link = document.createElement("a");
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch {
            setError("Failed to download advisor report. Please try again.");
        } finally {
            setDownloadingReport(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const normalizedPrice = Number(overrides.price);
        if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
            setError("Enter total fare to calculate price value.");
            return;
        }

        setLoading(true);
        setTracked(false);
        setError(null);

        try {
            const useManualOverride = segmentsManuallyEdited && segments.length > 0;
            const adults = overrides.adults.trim() !== "" ? parseInt(overrides.adults, 10) : 1;
            const children = overrides.children.trim() !== "" ? parseInt(overrides.children, 10) : 0;
            const infants = overrides.infants.trim() !== "" ? parseInt(overrides.infants, 10) : 0;
            const payload = {
                mode: "paste",
                itineraryText,
                price: normalizedPrice,
                currency: (overrides.currency || getDefaultCurrency()).toUpperCase().trim(),
                ...(overrides.cabin && { cabin: overrides.cabin }),
                adults,
                children,
                infants,
                ...(overrides.checkedBaggageKg && { checkedBaggageKg: parseFloat(overrides.checkedBaggageKg) }),
                refundable: overrides.refundable,
                ...(useManualOverride && {
                    source: "manual_override" as const,
                    segments: segments.map((segment) => ({
                        from: segment.from.toUpperCase().trim(),
                        to: segment.to.toUpperCase().trim(),
                        departureDateTime: new Date(segment.departureDateTime).toISOString(),
                        arrivalDateTime: new Date(segment.arrivalDateTime).toISOString(),
                        airline: segment.airline.trim(),
                        flightNumber: segment.flightNumber.trim(),
                        ...(segment.aircraft && { aircraft: segment.aircraft.trim() }),
                        ...(segment.marketedAirline && { marketedAirline: segment.marketedAirline.trim() }),
                        ...(segment.bookingClass && { bookingClass: segment.bookingClass.trim().toUpperCase() }),
                        ...(segment.tripDirection && { tripDirection: segment.tripDirection }),
                    })),
                }),
            };

            const res = await fetch("/api/score-flight", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (!res.ok) {
                const msg = data?.issues
                    ? data.issues.map((i: { path: string; message: string }) => `${i.path}: ${i.message}`).join(" | ")
                    : data?.error || "Failed to score itinerary";
                setError(msg);
            } else {
                const scored = data as ScoreResult;
                setResult(scored);
                setLastScoringSource(useManualOverride ? "manual_override" : "parsed_text");
                if (scored.extractedSegments && scored.extractedSegments.length > 0) {
                    setSegments(scored.extractedSegments);
                    // Only reset the flag when scoring from parsed text.
                    // If we just scored from manual segments, keep the flag true so
                    // re-submitting continues to use the edited segments as source of truth.
                    if (!useManualOverride) {
                        setSegmentsManuallyEdited(false);
                    }
                }
            }
        } catch {
            setError("Network error - please try again.");
        } finally {
            setLoading(false);
        }
    };

    const decision = result ? DECISION_CONFIG[result.decision] : null;

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pt-28 pb-24">
            <div className="container mx-auto px-4 md:px-6 max-w-5xl">
                <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-sky-600 transition-colors mb-8">
                    <ArrowLeft className="w-4 h-4" /> Back to home
                </Link>

                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center shadow-md shadow-blue-500/30">
                            <BarChart3 className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Score an Itinerary</h1>
                            <p className="text-slate-500 text-sm">Paste itinerary text, then review extracted segments only if needed</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-6">
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                            Paste your itinerary *
                        </label>
                        <p className="text-xs text-slate-500 mb-2">
                            You don't need to fill forms - just paste your flight details.
                        </p>
                        <textarea
                            required
                            rows={8}
                            value={itineraryText}
                            onChange={(e) => setItineraryText(e.target.value)}
                            placeholder={"Example:\nTurkish Airlines TK79\nIstanbul (IST) -> San Francisco (SFO)\nDeparture: 10 Jun 2026 08:15 | Arrival: 10 Jun 2026 12:05\nPrice: USD 742\nBaggage: 1 checked bag (23 kg) + 8 kg cabin"}
                            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                        />
                    </div>

                    <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-4">
                        <h3 className="text-sm font-semibold text-sky-900 mb-2">What can I paste here?</h3>
                        <ul className="list-disc list-inside text-sm text-sky-900/90 space-y-1">
                            <li>Google Flights results</li>
                            <li>Airline booking page details</li>
                            <li>Booking confirmation email text</li>
                            <li>OTA itinerary (Expedia, Booking, etc.)</li>
                        </ul>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Pricing and passenger inputs</div>
                        <p className="text-xs text-slate-500 mb-3">Total fare is required for score transparency and price value scoring.</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <input
                                type="number"
                                min="1"
                                step="0.01"
                                required
                                placeholder="Total fare *"
                                value={overrides.price}
                                onChange={(e) => setOverrides((prev) => ({ ...prev, price: e.target.value }))}
                                className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm"
                            />
                            <select
                                value={overrides.currency}
                                onChange={(e) => setOverrides((prev) => ({ ...prev, currency: e.target.value }))}
                                className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm bg-white"
                            >
                                {CURRENCY_OPTIONS.map((currency) => (
                                    <option key={currency} value={currency}>{currency}</option>
                                ))}
                            </select>
                            <select
                                value={overrides.cabin}
                                onChange={(e) => setOverrides((prev) => ({ ...prev, cabin: e.target.value }))}
                                className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm bg-white"
                            >
                                <option value="">Cabin (auto)</option>
                                <option value="economy">Economy</option>
                                <option value="premium">Premium Economy</option>
                                <option value="business">Business</option>
                                <option value="first">First</option>
                            </select>
                            <input
                                type="number"
                                min="1"
                                max="9"
                                placeholder="Adults (auto)"
                                value={overrides.adults}
                                onChange={(e) => setOverrides((prev) => ({ ...prev, adults: e.target.value }))}
                                className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm"
                            />
                            <input
                                type="number"
                                min="0"
                                max="8"
                                placeholder="Children (auto)"
                                value={overrides.children}
                                onChange={(e) => setOverrides((prev) => ({ ...prev, children: e.target.value }))}
                                className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm"
                            />
                            <input
                                type="number"
                                min="0"
                                max="8"
                                placeholder="Infants (auto)"
                                value={overrides.infants}
                                onChange={(e) => setOverrides((prev) => ({ ...prev, infants: e.target.value }))}
                                className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm"
                            />
                            <input
                                type="number"
                                min="0"
                                placeholder="Checked bag kg"
                                value={overrides.checkedBaggageKg}
                                onChange={(e) => setOverrides((prev) => ({ ...prev, checkedBaggageKg: e.target.value }))}
                                className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm"
                            />
                            <label className="inline-flex items-center gap-2 text-sm text-slate-700 px-2">
                                <input
                                    type="checkbox"
                                    checked={overrides.refundable}
                                    onChange={(e) => setOverrides((prev) => ({ ...prev, refundable: e.target.checked }))}
                                />
                                Refundable
                            </label>
                        </div>
                    </div>

                    {segments.length > 0 && (
                        <div className="rounded-2xl border border-slate-200 p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Extracted segments (editable fallback)</h3>
                                <Button type="button" variant="outline" size="sm" onClick={addSegment} className="rounded-lg">
                                    <Plus className="w-4 h-4 mr-1" /> Add Segment
                                </Button>
                            </div>

                            {segments.map((segment, index) => (
                                <div key={index} className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50/60">
                                    <div className="flex items-center justify-between">
                                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Segment {index + 1}</div>
                                        {segments.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeSegment(index)}
                                                className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" /> Remove
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        <input value={segment.from} onChange={(e) => updateSegment(index, { from: e.target.value })} placeholder="From" className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm font-mono uppercase" />
                                        <input value={segment.to} onChange={(e) => updateSegment(index, { to: e.target.value })} placeholder="To" className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm font-mono uppercase" />
                                        <input value={segment.airline} onChange={(e) => updateSegment(index, { airline: e.target.value })} placeholder="Airline not detected" className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm" />
                                        <input value={segment.flightNumber} onChange={(e) => updateSegment(index, { flightNumber: e.target.value })} placeholder="Flight number not detected" className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm font-mono" />
                                        <input type="datetime-local" value={segment.departureDateTime ? new Date(segment.departureDateTime).toISOString().slice(0, 16) : ""} onChange={(e) => updateSegment(index, { departureDateTime: e.target.value })} className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm" />
                                        <input type="datetime-local" value={segment.arrivalDateTime ? new Date(segment.arrivalDateTime).toISOString().slice(0, 16) : ""} onChange={(e) => updateSegment(index, { arrivalDateTime: e.target.value })} className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm" />
                                        <input value={segment.aircraft || ""} onChange={(e) => updateSegment(index, { aircraft: e.target.value })} placeholder="Aircraft" className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm" />
                                        <input value={segment.marketedAirline || ""} onChange={(e) => updateSegment(index, { marketedAirline: e.target.value })} placeholder="Marketed Airline" className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm" />
                                        <input value={segment.bookingClass || ""} onChange={(e) => updateSegment(index, { bookingClass: e.target.value })} placeholder="Booking class not detected" className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm font-mono uppercase" />
                                    </div>
                                    {segment.tripDirection && (
                                        <div className="text-xs text-slate-500 font-semibold">
                                            Direction: {segment.tripDirection === "OUTBOUND" ? "Outbound" : "Inbound"}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {error && (
                        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full h-12 rounded-xl bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white font-bold text-base shadow-lg shadow-blue-500/20 disabled:opacity-60"
                    >
                        {loading ? (
                            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Parsing and scoring itinerary...</>
                        ) : (
                            <><Plane className="w-5 h-5 mr-2" /> Parse and Score Itinerary</>
                        )}
                    </Button>
                </form>

                {result && decision && (
                    <div className="mt-8 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {lastScoringSource === "manual_override" && (
                            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                                Using manually edited segments
                            </div>
                        )}

                        {result.accuracyHint && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                {result.accuracyHint}
                            </div>
                        )}

                        {result.parseWarnings && result.parseWarnings.length > 0 && (
                            <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                                <div className="font-semibold mb-1">Parsing notes</div>
                                <ul className="list-disc list-inside">
                                    {result.parseWarnings.map((warning, index) => (
                                        <li key={index}>{warning}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {result.passengerPricingContext && (
                            <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
                                <div className="font-semibold mb-1">Passenger-aware price context</div>
                                <p>
                                    {result.passengerPricingContext.adults} adult, {result.passengerPricingContext.children} child, {result.passengerPricingContext.infants} infant
                                    {" "}({result.passengerPricingContext.totalTravelers} traveler total). Total fare: {toMoney(result.passengerPricingContext.totalPrice, result.trackingPayload?.trip.currency || overrides.currency)}.
                                </p>
                                <p className="mt-1">
                                    Comparable adult-equivalent fare: {toMoney(result.passengerPricingContext.comparablePerTravelerPrice, result.trackingPayload?.trip.currency || overrides.currency)}
                                    {result.passengerPricingContext.mixedTravelerTypes ? " (estimated for mixed traveler types)." : "."}
                                </p>
                            </div>
                        )}

                        {(result.trackingPayload || result.extractedSegments?.length) && (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
                                <div className="font-semibold mb-1">Cabin and booking class</div>
                                <p>Cabin class: {(result.trackingPayload?.trip.cabin || "economy").toString().replace("_", " ")}</p>
                                <p>Booking class: {result.extractedSegments?.[0]?.bookingClass ? result.extractedSegments[0].bookingClass : "Booking class not detected"}</p>
                            </div>
                        )}

                        {result.derivedMetrics && (
                            <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                                <div className="font-semibold mb-1">Trip structure</div>
                                {result.derivedMetrics.tripType === "ROUND_TRIP" ? (
                                    <p>
                                        Round-trip detected. Outbound connections: {result.derivedMetrics.outboundConnectionCount},
                                        Inbound connections: {result.derivedMetrics.inboundConnectionCount},
                                        Total segments: {result.derivedMetrics.totalSegments}.
                                    </p>
                                ) : (
                                    <p>
                                        One-way detected. Connections: {result.derivedMetrics.connectionCount},
                                        Total segments: {result.derivedMetrics.totalSegments}.
                                    </p>
                                )}
                            </div>
                        )}

                        <div className={`rounded-2xl border-2 p-6 flex items-center gap-5 ${decision.bg} ${decision.border}`}>
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 ${decision.bg} border-2 ${decision.border}`}>
                                <decision.icon className={`w-8 h-8 ${decision.color}`} />
                            </div>
                            <div className="flex-1">
                                <div className="flex flex-wrap items-baseline gap-3 mb-1">
                                    <span className={`text-3xl font-black tracking-tight ${decision.color}`}>{decision.label}</span>
                                    <span className="text-sm font-semibold text-slate-500">Score: {result.score.composite.toFixed(1)} / 10</span>
                                    <span className="text-sm font-semibold text-slate-500">Confidence: {result.insights.confidence}%</span>
                                    {result.scoreTrust && (
                                        <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${tierStyle(result.scoreTrust.reliabilityTier)}`}>
                                            {result.scoreTrust.reliabilityLabel}
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-slate-700 leading-relaxed">
                                    {result.score.buyWaitSignal?.label || result.insights.explanation}
                                </p>
                            </div>
                        </div>

                        {contradictionSignals(result).length > 0 && (
                            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
                                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-orange-700 mb-2">
                                    <AlertTriangle className="w-4 h-4" />
                                    Confidence reduced due to conflicting itinerary signals
                                </div>
                                <ul className="space-y-1 text-sm text-orange-900">
                                    {contradictionSignals(result).map((signal, index) => (
                                        <li key={index}>- {signal}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {result.scoreTrust && (
                            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                                    <div>
                                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Trust disclosure</div>
                                        <h3 className="text-lg font-black text-slate-900">What this system currently knows</h3>
                                        <p className="text-sm text-slate-700 mt-1">{result.scoreTrust.reliabilityExplanation}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <TrustBadge kind={sourceBadge(result.scoreTrust.dataSourceDisclosure.priceInput)} label={`Fare: ${friendlySource(result.scoreTrust.dataSourceDisclosure.priceInput)}`} />
                                        <TrustBadge kind={sourceBadge(result.scoreTrust.dataSourceDisclosure.baggageInput)} label={`Baggage: ${friendlySource(result.scoreTrust.dataSourceDisclosure.baggageInput)}`} />
                                        <TrustBadge kind={sourceBadge(result.scoreTrust.dataSourceDisclosure.marketData)} label={`Benchmark: ${friendlySource(result.scoreTrust.dataSourceDisclosure.marketData)}`} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            <TrustBadge kind="VERIFIED" />
                                            <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">Verified facts</div>
                                        </div>
                                        <ul className="space-y-1 text-emerald-900">
                                            {result.scoreTrust.verificationSummary.verified.length > 0
                                                ? result.scoreTrust.verificationSummary.verified.map((item, index) => <li key={index}>- {item}</li>)
                                                : <li>- No strongly verified signal provided.</li>}
                                        </ul>
                                    </div>
                                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            <TrustBadge kind="INFERRED" />
                                            <TrustBadge kind="ESTIMATED" />
                                        </div>
                                        <div className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-2">Estimated context</div>
                                        <ul className="space-y-1 text-amber-900">
                                            {[...result.scoreTrust.verificationSummary.inferred, ...result.scoreTrust.verificationSummary.estimated].length > 0
                                                ? [...result.scoreTrust.verificationSummary.inferred, ...result.scoreTrust.verificationSummary.estimated].map((item, index) => <li key={index}>- {item}</li>)
                                                : <li>- No inferred or estimated signal detected.</li>}
                                        </ul>
                                    </div>
                                    <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            <TrustBadge kind="UNAVAILABLE" />
                                            <TrustBadge kind="PARTIAL" />
                                        </div>
                                        <div className="text-xs font-bold uppercase tracking-wider text-red-700 mb-2">What remains uncertain</div>
                                        <ul className="space-y-1 text-red-900">
                                            {result.scoreTrust.whyReliabilityIsLimited.length > 0
                                                ? result.scoreTrust.whyReliabilityIsLimited.map((item, index) => <li key={index}>- {item}</li>)
                                                : <li>- No major reliability limiter detected.</li>}
                                        </ul>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Parser reliability</div>
                                        <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${parserReliability(result).className}`}>
                                            {parserReliability(result).label}
                                        </div>
                                        <p className="mt-2">{parserReliability(result).note}</p>
                                        <p className="mt-1 text-xs text-slate-500">Parse confidence: {Math.round((result.parseConfidence || 0) * 100)}% | Notes: {result.parseWarnings?.length || 0}</p>
                                    </div>

                                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Data source disclosure</div>
                                        <p>Market benchmark: <span className="font-semibold">{friendlySource(result.scoreTrust.dataSourceDisclosure.marketData)}</span></p>
                                        <p>Fare input: <span className="font-semibold">{friendlySource(result.scoreTrust.dataSourceDisclosure.priceInput)}</span></p>
                                        <p>Baggage input: <span className="font-semibold">{friendlySource(result.scoreTrust.dataSourceDisclosure.baggageInput)}</span></p>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                                    <div className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-3">Why confidence is {result.scoreTrust.dataReliabilityLabel}</div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                        <div>
                                            <div className="font-bold text-emerald-700 mb-1">Positive drivers</div>
                                            <ul className="space-y-1 text-slate-700">
                                                {confidenceDrivers(result).positive.map((item, index) => <li key={index}>+ {item}</li>)}
                                            </ul>
                                        </div>
                                        <div>
                                            <div className="font-bold text-red-700 mb-1">Negative drivers</div>
                                            <ul className="space-y-1 text-slate-700">
                                                {confidenceDrivers(result).negative.map((item, index) => <li key={index}>- {item}</li>)}
                                            </ul>
                                        </div>
                                        <div>
                                            <div className="font-bold text-amber-700 mb-1">Missing-info penalties</div>
                                            <ul className="space-y-1 text-slate-700">
                                                {confidenceDrivers(result).missing.map((item, index) => <li key={index}>- {item}</li>)}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {result.premiumReport && (
                            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 print:shadow-none print:border-slate-300">
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Premium Travel Intelligence Report</div>
                                        <h3 className="text-lg font-black text-slate-900">Advisor Document</h3>
                                    </div>
                                    <div className="text-xs text-slate-500">Structured for mobile and print readability</div>
                                </div>

                                <div className="grid grid-cols-1 gap-3">
                                    {[
                                        result.premiumReport.executiveSummary,
                                        result.premiumReport.tripOverview,
                                        result.premiumReport.recommendationSummary,
                                        result.premiumReport.reliabilityAndVerification,
                                        result.premiumReport.routeAndConnectionAnalysis,
                                        result.premiumReport.airlineAndAircraftAnalysis,
                                        result.premiumReport.baggageAndFareConditions,
                                        result.premiumReport.riskAndDisruptionExposure,
                                        result.premiumReport.comfortAndFatigueAnalysis,
                                        result.premiumReport.pricingContext,
                                        result.premiumReport.keyRisks,
                                        result.premiumReport.whatWouldImproveThisItinerary,
                                        result.premiumReport.finalRecommendation,
                                    ].map((section, index) => (
                                        <section key={`${section.title}-${index}`} className={`rounded-xl border p-4 ${reportSectionTone(section.title)}`}>
                                            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                                                {index + 1}. {section.title}
                                            </div>
                                            <p className="text-sm text-slate-900 font-medium leading-relaxed">{section.summary}</p>
                                            {section.bullets.length > 0 && (
                                                <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
                                                    {section.bullets.map((item, bulletIndex) => (
                                                        <li key={bulletIndex} className="flex gap-2">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0" />
                                                            {item}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </section>
                                    ))}
                                </div>
                            </div>
                        )}

                        {result.recommendationExplanation && (
                            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                                <div>
                                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Recommendation rationale tree</div>
                                    <h3 className="text-lg font-black text-slate-900">
                                        {result.decision} because {result.recommendationExplanation.primaryReason.charAt(0).toLowerCase() + result.recommendationExplanation.primaryReason.slice(1)}
                                    </h3>
                                    {result.recommendationExplanation.supportingReasons.length > 0 && (
                                        <ul className="mt-2 space-y-1 text-sm text-slate-700">
                                            {result.recommendationExplanation.supportingReasons.map((reason, index) => (
                                                <li key={index} className="flex gap-2">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0" />
                                                    {reason}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                                        <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-2">Strongest positive</div>
                                        <ul className="space-y-1 text-sm text-emerald-800">
                                            {result.recommendationExplanation.positiveFactors.length > 0
                                                ? <li>+ {result.recommendationExplanation.positiveFactors[0]}</li>
                                                : <li>- No strong positives detected yet.</li>}
                                        </ul>
                                    </div>

                                    <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                                        <div className="text-xs font-bold uppercase tracking-wider text-red-700 mb-2">Strongest concern</div>
                                        <ul className="space-y-1 text-sm text-red-800">
                                            {result.recommendationExplanation.negativeFactors.length > 0
                                                ? <li>- {result.recommendationExplanation.negativeFactors[0]}</li>
                                                : <li>- No major negatives detected.</li>}
                                        </ul>
                                    </div>

                                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                                        <div className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-2">Biggest uncertainty</div>
                                        <ul className="space-y-1 text-sm text-amber-800">
                                            {result.recommendationExplanation.missingFactors.length > 0
                                                ? <li>- {result.recommendationExplanation.missingFactors[0]}</li>
                                                : result.scoreTrust?.whyReliabilityIsLimited?.[0]
                                                    ? <li>- {result.scoreTrust.whyReliabilityIsLimited[0]}</li>
                                                    : <li>- Required data coverage looks complete.</li>}
                                        </ul>
                                    </div>
                                </div>

                                {result.recommendationExplanation.missingDataWarnings.length > 0 && (
                                    <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                                        <div className="text-xs font-bold uppercase tracking-wider text-orange-700 mb-2">Missing data warnings</div>
                                        <ul className="space-y-1 text-sm text-orange-800">
                                            {result.recommendationExplanation.missingDataWarnings.map((warning, index) => (
                                                <li key={index}>• {warning}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
                                    <div className="text-xs font-bold uppercase tracking-wider text-sky-700 mb-1">What would change the recommendation</div>
                                    <p className="text-sm text-sky-900">{result.recommendationExplanation.actionHint}</p>
                                </div>
                            </div>
                        )}

                        {result.scoreBreakdown && result.scoreBreakdown.length > 0 && (
                            <div className="bg-white rounded-2xl border border-slate-200 p-5">
                                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Score driver breakdown</div>
                                <h3 className="text-lg font-black text-slate-900 mb-3">Why the score moved</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {result.scoreBreakdown.map((item) => (
                                        <div key={item.component} className="rounded-lg border border-slate-200 p-3 bg-slate-50">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <span className="text-sm font-semibold text-slate-900">{item.label}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${impactDirection(item.points, item.maxPoints).className}`}>
                                                        {impactDirection(item.points, item.maxPoints).label}
                                                    </span>
                                                    <span className="text-sm font-bold text-slate-700">{item.points.toFixed(1)}/{item.maxPoints ?? 10}</span>
                                                </div>
                                            </div>
                                            <p className="text-xs text-slate-600 mt-1">{item.reason}</p>
                                            {item.sourceReliability && (
                                                <div className="mt-2">
                                                    <TrustBadge
                                                        kind={item.sourceReliability === "HIGH" ? "VERIFIED" : item.sourceReliability === "MEDIUM" ? "PARTIAL" : "ESTIMATED"}
                                                        label={`Trust: ${item.sourceReliability}`}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {result.derivedMetrics && (
                            <div className="bg-white rounded-2xl border border-slate-200 p-5 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                <div><span className="text-slate-400 block">Trip type</span>{result.derivedMetrics.tripType === "ROUND_TRIP" ? "Round-trip" : "One-way"}</div>
                                <div><span className="text-slate-400 block">Total segments</span>{result.derivedMetrics.totalSegments} <TrustBadge kind={(result.parseWarnings?.length || 0) > 0 ? "PARTIAL" : "VERIFIED"} /></div>
                                {result.derivedMetrics.tripType === "ROUND_TRIP" ? (
                                    <>
                                        <div><span className="text-slate-400 block">Outbound duration</span>{result.derivedMetrics.outboundDurationMinutes} min</div>
                                        <div><span className="text-slate-400 block">Inbound duration</span>{result.derivedMetrics.inboundDurationMinutes} min</div>
                                        <div><span className="text-slate-400 block">Outbound layover</span>{result.derivedMetrics.outboundLayoverMinutes} min</div>
                                        <div><span className="text-slate-400 block">Inbound layover</span>{result.derivedMetrics.inboundLayoverMinutes} min</div>
                                        <div><span className="text-slate-400 block">Outbound connections</span>{result.derivedMetrics.outboundConnectionCount}</div>
                                        <div><span className="text-slate-400 block">Inbound connections</span>{result.derivedMetrics.inboundConnectionCount}</div>
                                    </>
                                ) : (
                                    <>
                                        <div><span className="text-slate-400 block">Total duration</span>{result.derivedMetrics.totalDurationMinutes} min</div>
                                        <div><span className="text-slate-400 block">Total layover</span>{result.derivedMetrics.totalLayoverMinutes} min</div>
                                        <div><span className="text-slate-400 block">Connections</span>{result.derivedMetrics.connectionCount}</div>
                                    </>
                                )}
                                <div><span className="text-slate-400 block">Feasibility</span>{result.derivedMetrics.connectionFeasibility}</div>
                                <div><span className="text-slate-400 block">Route realism</span>{result.derivedMetrics.routeRealism}</div>
                                <div><span className="text-slate-400 block">Airline mix</span>{result.derivedMetrics.airlineReliabilityMix}</div>
                                <div><span className="text-slate-400 block">Baggage source</span><TrustBadge kind={sourceBadge(result.confidenceInputs?.baggageSource)} label={friendlySource(result.confidenceInputs?.baggageSource)} /></div>
                                <div><span className="text-slate-400 block">Price source</span><TrustBadge kind={sourceBadge(result.confidenceInputs?.priceSource)} label={friendlySource(result.confidenceInputs?.priceSource)} /></div>
                            </div>
                        )}

                        {result.insights.riskFlags.length > 0 && (
                            <div className="bg-red-50 rounded-2xl border border-red-200 p-5">
                                <div className="flex items-center gap-2 mb-3 text-xs font-bold uppercase tracking-wider text-red-600">
                                    <AlertTriangle className="w-3.5 h-3.5" /> Risk Flags
                                </div>
                                <ul className="space-y-1.5">
                                    {result.insights.riskFlags.map((flag, i) => (
                                        <li key={i} className="flex items-center gap-2 text-sm text-red-700">
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                                            {flag}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {result.insights.comfortNotes.length > 0 && (
                            <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-5">
                                <div className="flex items-center gap-2 mb-3 text-xs font-bold uppercase tracking-wider text-emerald-700">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Comfort & Quality Notes
                                </div>
                                <ul className="space-y-1.5">
                                    {result.insights.comfortNotes.map((note, i) => (
                                        <li key={i} className="flex items-center gap-2 text-sm text-emerald-800">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                            {note}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="bg-slate-900 rounded-2xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <Shield className="w-6 h-6 text-sky-400 shrink-0" />
                                <div>
                                    <p className="font-semibold text-white text-sm">Want booked trip monitoring?</p>
                                    <p className="text-slate-400 text-xs">Track this itinerary without re-entering any details.</p>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Button
                                    onClick={handleDownloadAdvisorReport}
                                    disabled={downloadingReport || !result.premiumReport}
                                    variant="outline"
                                    className="whitespace-nowrap rounded-xl border-slate-600 bg-transparent text-white hover:bg-slate-800"
                                >
                                    {downloadingReport ? (
                                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Preparing report...</>
                                    ) : (
                                        <><FileDown className="w-4 h-4 mr-2" /> Download advisor report</>
                                    )}
                                </Button>
                                <Button
                                    onClick={handleTrackItinerary}
                                    disabled={tracking || tracked || !result.trackingPayload}
                                    className="whitespace-nowrap rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-semibold shadow-md shadow-blue-700/30"
                                >
                                    {tracking ? (
                                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving itinerary...</>
                                    ) : tracked ? (
                                        <><CheckCircle2 className="w-4 h-4 mr-2" /> Itinerary tracked</>
                                    ) : (
                                        <><Bell className="w-4 h-4 mr-2" /> Track this itinerary</>
                                    )}
                                </Button>
                                <Link href="/dashboard">
                                    <Button variant="outline" className="whitespace-nowrap rounded-xl border-slate-600 bg-transparent text-white hover:bg-slate-800">
                                        <Clock className="w-4 h-4 mr-2" /> Dashboard
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

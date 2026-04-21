"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
    BarChart3,
    Plane,
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
} from "lucide-react";
import { Link } from "@/i18n/routing";

type Decision = "BUY" | "WAIT" | "WATCH";
type ScoreMode = "quick" | "detailed";

type SegmentInput = {
    from: string;
    to: string;
    departureDateTime: string;
    arrivalDateTime: string;
    airline: string;
    flightNumber: string;
    aircraft: string;
    marketedAirline: string;
    bookingClass: string;
};

interface ScoreResult {
    decision: Decision;
    scoringMode?: ScoreMode;
    accuracyHint?: string;
    insights: {
        decision: Decision;
        confidence: number;
        riskFlags: string[];
        comfortNotes: string[];
        explanation: string;
    };
    score: {
        composite: number;
        buyWaitSignal?: { action: string; label?: string };
        decisionReason?: string;
    };
}

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

export default function ScoreFlightPage() {
    const [mode, setMode] = useState<ScoreMode>("quick");

    const [quickForm, setQuickForm] = useState({
        origin: "",
        destination: "",
        departureDate: "",
        price: "",
        currency: "USD",
        stops: "0",
        airline: "",
        cabin: "",
    });

    const [detailedForm, setDetailedForm] = useState({
        totalPrice: "",
        currency: "USD",
        cabin: "economy",
        checkedBaggageKg: "",
        cabinBaggageKg: "",
        refundable: false,
        segments: [emptySegment()],
    });

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ScoreResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const modeDescription = useMemo(() => {
        if (mode === "quick") {
            return "Quick Score gives a rough recommendation with intentionally lower confidence.";
        }
        return "Detailed Itinerary Score uses full segment structure for realistic scoring and better confidence.";
    }, [mode]);

    const updateSegment = (index: number, patch: Partial<SegmentInput>) => {
        setDetailedForm((prev) => ({
            ...prev,
            segments: prev.segments.map((segment, i) => (i === index ? { ...segment, ...patch } : segment)),
        }));
    };

    const addSegment = () => {
        setDetailedForm((prev) => ({
            ...prev,
            segments: [...prev.segments, emptySegment()],
        }));
    };

    const removeSegment = (index: number) => {
        setDetailedForm((prev) => ({
            ...prev,
            segments: prev.segments.filter((_, i) => i !== index),
        }));
    };

    const buildPayload = () => {
        if (mode === "quick") {
            return {
                mode: "quick" as const,
                origin: quickForm.origin.toUpperCase().trim(),
                destination: quickForm.destination.toUpperCase().trim(),
                departureDate: quickForm.departureDate,
                price: parseFloat(quickForm.price),
                currency: quickForm.currency.toUpperCase().trim(),
                stops: parseInt(quickForm.stops, 10),
                ...(quickForm.airline && { airline: quickForm.airline.trim() }),
                ...(quickForm.cabin && { cabin: quickForm.cabin }),
            };
        }

        return {
            mode: "detailed" as const,
            totalPrice: parseFloat(detailedForm.totalPrice),
            currency: detailedForm.currency.toUpperCase().trim(),
            cabin: detailedForm.cabin,
            ...(detailedForm.checkedBaggageKg && { checkedBaggageKg: parseFloat(detailedForm.checkedBaggageKg) }),
            ...(detailedForm.cabinBaggageKg && { cabinBaggageKg: parseFloat(detailedForm.cabinBaggageKg) }),
            refundable: detailedForm.refundable,
            segments: detailedForm.segments.map((segment) => ({
                from: segment.from.toUpperCase().trim(),
                to: segment.to.toUpperCase().trim(),
                departureDateTime: new Date(segment.departureDateTime).toISOString(),
                arrivalDateTime: new Date(segment.arrivalDateTime).toISOString(),
                airline: segment.airline.trim(),
                flightNumber: segment.flightNumber.trim(),
                ...(segment.aircraft && { aircraft: segment.aircraft.trim() }),
                ...(segment.marketedAirline && { marketedAirline: segment.marketedAirline.trim() }),
                ...(segment.bookingClass && { bookingClass: segment.bookingClass.trim().toUpperCase() }),
            })),
        };
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const payload = buildPayload();

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
                setResult(data as ScoreResult);
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
                            <p className="text-slate-500 text-sm">Choose quick estimate or full itinerary realism</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-2 mb-5 flex gap-2">
                    <button
                        type="button"
                        onClick={() => setMode("quick")}
                        className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                            mode === "quick" ? "bg-sky-600 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                        }`}
                    >
                        Quick Score
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode("detailed")}
                        className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                            mode === "detailed" ? "bg-sky-600 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                        }`}
                    >
                        Detailed Itinerary Score
                    </button>
                </div>

                <p className="text-sm text-slate-500 mb-6">{modeDescription}</p>

                <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-6">
                    {mode === "quick" && (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Origin *</label>
                                    <input
                                        required
                                        maxLength={3}
                                        placeholder="BNE"
                                        value={quickForm.origin}
                                        onChange={(e) => setQuickForm((f) => ({ ...f, origin: e.target.value }))}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono font-bold uppercase"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Destination *</label>
                                    <input
                                        required
                                        maxLength={3}
                                        placeholder="IST"
                                        value={quickForm.destination}
                                        onChange={(e) => setQuickForm((f) => ({ ...f, destination: e.target.value }))}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono font-bold uppercase"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Departure Date *</label>
                                    <input
                                        required
                                        type="date"
                                        value={quickForm.departureDate}
                                        onChange={(e) => setQuickForm((f) => ({ ...f, departureDate: e.target.value }))}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Price *</label>
                                    <input
                                        required
                                        type="number"
                                        min="1"
                                        step="0.01"
                                        value={quickForm.price}
                                        onChange={(e) => setQuickForm((f) => ({ ...f, price: e.target.value }))}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Stops *</label>
                                    <select
                                        value={quickForm.stops}
                                        onChange={(e) => setQuickForm((f) => ({ ...f, stops: e.target.value }))}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"
                                    >
                                        <option value="0">Direct</option>
                                        <option value="1">1 Stop</option>
                                        <option value="2">2 Stops</option>
                                        <option value="3">3 Stops</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Currency *</label>
                                    <input
                                        required
                                        maxLength={3}
                                        value={quickForm.currency}
                                        onChange={(e) => setQuickForm((f) => ({ ...f, currency: e.target.value }))}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono uppercase"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Airline</label>
                                    <input
                                        placeholder="Qatar Airways"
                                        value={quickForm.airline}
                                        onChange={(e) => setQuickForm((f) => ({ ...f, airline: e.target.value }))}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Cabin</label>
                                    <select
                                        value={quickForm.cabin}
                                        onChange={(e) => setQuickForm((f) => ({ ...f, cabin: e.target.value }))}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"
                                    >
                                        <option value="">Unspecified</option>
                                        <option value="economy">Economy</option>
                                        <option value="premium">Premium Economy</option>
                                        <option value="business">Business</option>
                                        <option value="first">First</option>
                                    </select>
                                </div>
                            </div>

                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                Quick mode intentionally keeps confidence low/moderate and softens recommendations.
                            </div>
                        </>
                    )}

                    {mode === "detailed" && (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Total Price *</label>
                                    <input
                                        required
                                        type="number"
                                        min="1"
                                        step="0.01"
                                        value={detailedForm.totalPrice}
                                        onChange={(e) => setDetailedForm((f) => ({ ...f, totalPrice: e.target.value }))}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Currency *</label>
                                    <input
                                        required
                                        maxLength={3}
                                        value={detailedForm.currency}
                                        onChange={(e) => setDetailedForm((f) => ({ ...f, currency: e.target.value }))}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono uppercase"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Cabin *</label>
                                    <select
                                        value={detailedForm.cabin}
                                        onChange={(e) => setDetailedForm((f) => ({ ...f, cabin: e.target.value }))}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"
                                    >
                                        <option value="economy">Economy</option>
                                        <option value="premium">Premium Economy</option>
                                        <option value="business">Business</option>
                                        <option value="first">First</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Checked Baggage Kg</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={detailedForm.checkedBaggageKg}
                                        onChange={(e) => setDetailedForm((f) => ({ ...f, checkedBaggageKg: e.target.value }))}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Cabin Baggage Kg</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={detailedForm.cabinBaggageKg}
                                        onChange={(e) => setDetailedForm((f) => ({ ...f, cabinBaggageKg: e.target.value }))}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm"
                                    />
                                </div>
                                <div className="flex items-end">
                                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                                        <input
                                            type="checkbox"
                                            checked={detailedForm.refundable}
                                            onChange={(e) => setDetailedForm((f) => ({ ...f, refundable: e.target.checked }))}
                                        />
                                        Refundable fare
                                    </label>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Segments</h3>
                                    <Button type="button" variant="outline" size="sm" onClick={addSegment} className="rounded-lg">
                                        <Plus className="w-4 h-4 mr-1" /> Add Segment
                                    </Button>
                                </div>

                                {detailedForm.segments.map((segment, index) => (
                                    <div key={index} className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50/60">
                                        <div className="flex items-center justify-between">
                                            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Segment {index + 1}</div>
                                            {detailedForm.segments.length > 1 && (
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
                                            <input
                                                required
                                                maxLength={3}
                                                placeholder="From (IATA)"
                                                value={segment.from}
                                                onChange={(e) => updateSegment(index, { from: e.target.value })}
                                                className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm font-mono font-bold uppercase"
                                            />
                                            <input
                                                required
                                                maxLength={3}
                                                placeholder="To (IATA)"
                                                value={segment.to}
                                                onChange={(e) => updateSegment(index, { to: e.target.value })}
                                                className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm font-mono font-bold uppercase"
                                            />
                                            <input
                                                required
                                                placeholder="Airline"
                                                value={segment.airline}
                                                onChange={(e) => updateSegment(index, { airline: e.target.value })}
                                                className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm"
                                            />
                                            <input
                                                required
                                                placeholder="Flight Number"
                                                value={segment.flightNumber}
                                                onChange={(e) => updateSegment(index, { flightNumber: e.target.value })}
                                                className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm font-mono"
                                            />
                                            <input
                                                required
                                                type="datetime-local"
                                                value={segment.departureDateTime}
                                                onChange={(e) => updateSegment(index, { departureDateTime: e.target.value })}
                                                className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm"
                                            />
                                            <input
                                                required
                                                type="datetime-local"
                                                value={segment.arrivalDateTime}
                                                onChange={(e) => updateSegment(index, { arrivalDateTime: e.target.value })}
                                                className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm"
                                            />
                                            <input
                                                placeholder="Aircraft (optional)"
                                                value={segment.aircraft}
                                                onChange={(e) => updateSegment(index, { aircraft: e.target.value })}
                                                className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm"
                                            />
                                            <input
                                                placeholder="Marketed Airline (optional)"
                                                value={segment.marketedAirline}
                                                onChange={(e) => updateSegment(index, { marketedAirline: e.target.value })}
                                                className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm"
                                            />
                                            <input
                                                placeholder="Booking Class (optional)"
                                                value={segment.bookingClass}
                                                onChange={(e) => updateSegment(index, { bookingClass: e.target.value })}
                                                className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm font-mono uppercase"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
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
                            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Scoring itinerary...</>
                        ) : (
                            <><Plane className="w-5 h-5 mr-2" /> Score Itinerary</>
                        )}
                    </Button>
                </form>

                {result && decision && (
                    <div className="mt-8 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {result.accuracyHint && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                {result.accuracyHint}
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
                                    <span className="text-xs text-slate-400">{result.insights.confidence}% confidence</span>
                                    {result.scoringMode && (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase tracking-wide">
                                            {result.scoringMode}
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-slate-700 leading-relaxed">
                                    {result.score.buyWaitSignal?.label || result.insights.explanation}
                                </p>
                            </div>
                        </div>

                        {result.insights.explanation && (
                            <div className="bg-white rounded-2xl border border-slate-200 p-5">
                                <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                                    <BarChart3 className="w-3.5 h-3.5" /> Decision Reason
                                </div>
                                <p className="text-sm text-slate-700 leading-relaxed">{result.insights.explanation}</p>
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
                                    <p className="font-semibold text-white text-sm">Want full trip protection?</p>
                                    <p className="text-slate-400 text-xs">Track this route and get live disruption alerts.</p>
                                </div>
                            </div>
                            <Link href="/dashboard">
                                <Button className="whitespace-nowrap rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-semibold shadow-md shadow-blue-700/30">
                                    <Clock className="w-4 h-4 mr-2" /> Start Monitoring
                                </Button>
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
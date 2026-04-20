"use client";

import { useState } from "react";
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
} from "lucide-react";
import { Link } from "@/i18n/routing";

type Decision = "BUY" | "WAIT" | "WATCH";

interface ScoreResult {
    decision: Decision;
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

export default function ScoreFlightPage() {
    const [form, setForm] = useState({
        origin: "",
        destination: "",
        departureDateTime: "",
        price: "",
        airline: "",
        flightNumber: "",
        stops: "0",
        cabinClass: "economy",
        baggageIncluded: true,
    });
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ScoreResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const payload = {
                origin: form.origin.toUpperCase().trim(),
                destination: form.destination.toUpperCase().trim(),
                departureDateTime: new Date(form.departureDateTime).toISOString(),
                price: parseFloat(form.price),
                ...(form.airline && { airline: form.airline.trim() }),
                ...(form.flightNumber && { flightNumber: form.flightNumber.trim() }),
                stops: parseInt(form.stops, 10),
                cabinClass: form.cabinClass,
                baggageIncluded: form.baggageIncluded,
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
                    : data?.error || "Failed to score flight";
                setError(msg);
            } else {
                setResult(data as ScoreResult);
            }
        } catch {
            setError("Network error — please try again.");
        } finally {
            setLoading(false);
        }
    };

    const decision = result ? DECISION_CONFIG[result.decision] : null;

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pt-28 pb-24">
            <div className="container mx-auto px-4 md:px-6 max-w-3xl">

                {/* Back */}
                <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-sky-600 transition-colors mb-8">
                    <ArrowLeft className="w-4 h-4" /> Back to home
                </Link>

                {/* Header */}
                <div className="mb-10">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center shadow-md shadow-blue-500/30">
                            <BarChart3 className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Score a Flight</h1>
                            <p className="text-slate-500 text-sm">Get a BUY / WAIT / WATCH recommendation in seconds</p>
                        </div>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-6">

                    {/* Route */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                                From <span className="text-red-500">*</span>
                            </label>
                            <input
                                required
                                maxLength={3}
                                placeholder="SYD"
                                value={form.origin}
                                onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono font-bold uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-400"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                                To <span className="text-red-500">*</span>
                            </label>
                            <input
                                required
                                maxLength={3}
                                placeholder="LHR"
                                value={form.destination}
                                onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono font-bold uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-400"
                            />
                        </div>
                    </div>

                    {/* Date + Price */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                                Departure <span className="text-red-500">*</span>
                            </label>
                            <input
                                required
                                type="datetime-local"
                                value={form.departureDateTime}
                                onChange={(e) => setForm((f) => ({ ...f, departureDateTime: e.target.value }))}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-400"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                                Price (USD) <span className="text-red-500">*</span>
                            </label>
                            <input
                                required
                                type="number"
                                min="1"
                                step="0.01"
                                placeholder="499"
                                value={form.price}
                                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-400"
                            />
                        </div>
                    </div>

                    {/* Optional: Airline + Flight# */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Airline</label>
                            <input
                                placeholder="Singapore Airlines"
                                value={form.airline}
                                onChange={(e) => setForm((f) => ({ ...f, airline: e.target.value }))}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-400"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Flight #</label>
                            <input
                                placeholder="SQ256"
                                value={form.flightNumber}
                                onChange={(e) => setForm((f) => ({ ...f, flightNumber: e.target.value }))}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-400"
                            />
                        </div>
                    </div>

                    {/* Stops + Cabin + Baggage */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Stops</label>
                            <select
                                value={form.stops}
                                onChange={(e) => setForm((f) => ({ ...f, stops: e.target.value }))}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-400 bg-white"
                            >
                                <option value="0">Direct</option>
                                <option value="1">1 Stop</option>
                                <option value="2">2 Stops</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Cabin</label>
                            <select
                                value={form.cabinClass}
                                onChange={(e) => setForm((f) => ({ ...f, cabinClass: e.target.value }))}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-400 bg-white"
                            >
                                <option value="economy">Economy</option>
                                <option value="premium">Premium Economy</option>
                                <option value="business">Business</option>
                                <option value="first">First</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Baggage</label>
                            <select
                                value={form.baggageIncluded ? "yes" : "no"}
                                onChange={(e) => setForm((f) => ({ ...f, baggageIncluded: e.target.value === "yes" }))}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-400 bg-white"
                            >
                                <option value="yes">Included</option>
                                <option value="no">Not included</option>
                            </select>
                        </div>
                    </div>

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
                            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Scoring flight…</>
                        ) : (
                            <><Plane className="w-5 h-5 mr-2" /> Score This Flight</>
                        )}
                    </Button>
                </form>

                {/* Results */}
                {result && decision && (
                    <div className="mt-8 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">

                        {/* Decision Banner */}
                        <div className={`rounded-2xl border-2 p-6 flex items-center gap-5 ${decision.bg} ${decision.border}`}>
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 ${decision.bg} border-2 ${decision.border}`}>
                                <decision.icon className={`w-8 h-8 ${decision.color}`} />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-baseline gap-3 mb-1">
                                    <span className={`text-3xl font-black tracking-tight ${decision.color}`}>{decision.label}</span>
                                    <span className="text-sm font-semibold text-slate-500">
                                        Score: {result.score.composite.toFixed(1)} / 10
                                    </span>
                                    <span className="text-xs text-slate-400">
                                        {result.insights.confidence}% confidence
                                    </span>
                                </div>
                                <p className="text-sm text-slate-700 leading-relaxed">
                                    {result.score.buyWaitSignal?.label || result.insights.explanation}
                                </p>
                            </div>
                        </div>

                        {/* Explanation */}
                        {result.insights.explanation && (
                            <div className="bg-white rounded-2xl border border-slate-200 p-5">
                                <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                                    <BarChart3 className="w-3.5 h-3.5" /> Decision Reason
                                </div>
                                <p className="text-sm text-slate-700 leading-relaxed">{result.insights.explanation}</p>
                            </div>
                        )}

                        {/* Risk Flags */}
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

                        {/* Comfort Notes */}
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

                        {/* Track CTA */}
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

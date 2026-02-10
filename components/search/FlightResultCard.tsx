'use client';

import { useState } from 'react';
import { FlightResult } from '@/types/hybridFlight';
import { Shield, CheckCircle2, AlertTriangle, Wifi, Zap, Utensils, Luggage, Ban, RotateCcw } from 'lucide-react';
import BookButton from './BookButton';
import JuniorBadge from './JuniorBadge';

interface FlightResultCardProps {
    flight: FlightResult;
    isPremiumOverride?: boolean; // For testing
}

export default function FlightResultCard({ flight, isPremiumOverride = false }: FlightResultCardProps) {
    const [analyzing, setAnalyzing] = useState(false);
    const [analysis, setAnalysis] = useState<FlightResult['analysis'] | null>(flight.analysis || null);
    const [score, setScore] = useState<number | null>(flight.agentScore || null);
    const [enrichedFlight, setEnrichedFlight] = useState<FlightResult | null>(flight.agentScore ? flight : null);

    const handleAnalyze = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent triggering other card clicks if any
        if (analyzing || enrichedFlight) return; // Already analyzed

        setAnalyzing(true);
        try {
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(flight),
            });

            if (res.status === 403) {
                // Trigger Premium Modal here (Future task)
                alert("Premium subscription required to see Agent Score!");
                setAnalyzing(false);
                return;
            }

            const data: FlightResult = await res.json();
            setEnrichedFlight(data);
            setAnalysis(data.analysis || null); // Ensure analysis is set
            setScore(data.agentScore ?? 0);
        } catch (error) {
            console.error('Analysis failed', error);
        } finally {
            setAnalyzing(false);
        }
    };

    const scoreColor = (score || 0) >= 8 ? 'text-green-600' : (score || 0) >= 5 ? 'text-yellow-600' : 'text-red-600';

    const formatCurrency = (amount: number, currency: string) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
    };

    return (
        <div className="group relative bg-white border-2 border-slate-100 hover:border-blue-500 rounded-[32px] p-6 mb-6 transition-all shadow-sm hover:shadow-xl overflow-hidden">
            <div className="flex flex-col md:flex-row justify-between gap-6 md:gap-8">

                {/* LEFT: Flight Timeline & Info */}
                <div className="flex-1 space-y-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-xs font-black text-slate-600 shadow-inner">
                            {flight.airline.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-extrabold text-slate-900 text-lg tracking-tight">{flight.airline}</span>
                        {flight.amenities?.hasWifi && <Wifi className="w-3 h-3 text-slate-400" />}
                    </div>

                    <div className="flex justify-between items-center relative py-2">
                        <div className="text-left w-24">
                            <span className="text-3xl font-black tracking-tighter text-slate-900">{flight.departTime ? flight.departTime.split('T')[1].slice(0, 5) : ''}</span>
                            <p className="text-xs font-bold text-slate-400 mt-1">{flight.from}</p>
                        </div>

                        <div className="flex-1 px-4 text-center relative">
                            <div className="h-[2px] bg-slate-200 w-full absolute top-1/2 left-0 -translate-y-1/2 -z-10 rounded-full"></div>
                            <div className="bg-white px-2 inline-block">
                                <span className="text-sm">✈️</span>
                            </div>
                            <p className="text-[10px] font-black text-slate-500 mt-1 uppercase tracking-wider">{Math.floor(flight.duration / 60)}h {flight.duration % 60}m</p>
                            <p className={`text-[10px] font-black mt-0.5 ${flight.stops === 0 ? 'text-green-600' : 'text-orange-500'}`}>
                                {flight.stops === 0 ? 'DIRECT' : `${flight.stops} STOP`}
                            </p>
                        </div>

                        <div className="text-right w-24">
                            <span className="text-3xl font-black tracking-tighter text-slate-900">{flight.arriveTime ? flight.arriveTime.split('T')[1].slice(0, 5) : ''}</span>
                            <p className="text-xs font-bold text-slate-400 mt-1">{flight.to}</p>
                        </div>
                    </div>
                </div>

                {/* RIGHT: Agent Score & Price (The "Lock" Zone) */}
                <div className="md:w-72 md:border-l-2 md:border-slate-50 md:pl-8 flex flex-col justify-center items-center relative">

                    {/* GUARD: Premium Check / Analysis Check */}
                    {/* If we have analysis data (enrichedFlight), show the score. Otherwise show the lock. */}
                    {analysis && enrichedFlight ? (
                        <div className="text-center animate-in fade-in zoom-in duration-500 mb-4">
                            <div className={`text-6xl font-black leading-none tracking-tighter ${scoreColor}`}>
                                {score?.toFixed(1) || "?.?"}
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase mt-2 tracking-widest">Agent Score</p>
                        </div>
                    ) : (
                        <div className="text-center group-hover:scale-105 transition-transform mb-4 relative cursor-pointer" onClick={handleAnalyze}>
                            <div className="text-5xl font-black text-slate-200 blur-[6px] select-none">?.?</div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <button
                                    disabled={analyzing}
                                    className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg border border-white/20 flex items-center gap-1"
                                >
                                    {analyzing ? (
                                        <>
                                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ANALYZING
                                        </>
                                    ) : (
                                        <>
                                            <Shield className="w-3 h-3" />
                                            SKORU GÖR
                                        </>
                                    )}
                                </button>
                            </div>
                            <p className="text-[10px] font-black text-slate-300 uppercase mt-2 tracking-widest">Agent Score</p>
                        </div>
                    )}

                    <div className="text-center w-full">
                        <p className="text-3xl font-black text-slate-900 tracking-tight">{formatCurrency(flight.price, flight.currency)}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-4">Total Price</p>

                        <BookButton flight={flight} />
                    </div>
                </div>
            </div>

            {/* MAGIC CARD PANEL: Premium Details (Only if Analyzed) */}
            {enrichedFlight && (
                <div className="mt-8 pt-6 border-t-2 border-slate-50 grid grid-cols-2 md:grid-cols-4 gap-4 animate-in slide-in-from-top-2 duration-300">
                    <AmenityBox
                        icon={Luggage}
                        label="Baggage"
                        value={flight.baggageSummary?.checked || "Unknown"}
                        sub={flight.baggageSummary?.cabin ? `+ ${flight.baggageSummary.cabin} Cabin` : ''}
                        isGood={flight.baggageSummary?.totalWeight !== "0"}
                    />
                    <AmenityBox
                        icon={RotateCcw}
                        label="Refund"
                        value={flight.legal?.formattedRefund || "Unknown"}
                        isGood={flight.legal?.isRefundable}
                        isBad={!flight.legal?.isRefundable}
                    />
                    <AmenityBox
                        icon={Utensils}
                        label="Meal"
                        value={flight.amenities?.hasMeal ? "Included" : "Paid/None"}
                        isGood={flight.amenities?.hasMeal}
                    />
                    <AmenityBox
                        icon={Wifi}
                        label="Wi-Fi"
                        value={flight.amenities?.hasWifi ? "Available" : "No Wifi"}
                        isGood={flight.amenities?.hasWifi}
                    />

                    {/* Penalties / Pros Text */}
                    <div className="col-span-2 md:col-span-4 mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {flight.scoreDetails?.penalties.length ? (
                            <div className="bg-red-50 rounded-xl p-3 flex gap-3 items-start">
                                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                <div>
                                    <h5 className="text-xs font-bold text-red-800 uppercase mb-1">Warning</h5>
                                    <ul className="text-sm text-red-700 list-disc list-inside">
                                        {flight.scoreDetails?.penalties.map((p, i) => <li key={i}>{p}</li>)}
                                    </ul>
                                </div>
                            </div>
                        ) : null}

                        {flight.scoreDetails?.pros.length ? (
                            <div className="bg-green-50 rounded-xl p-3 flex gap-3 items-start">
                                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                                <div>
                                    <h5 className="text-xs font-bold text-green-800 uppercase mb-1">Highlights</h5>
                                    <ul className="text-sm text-green-700 list-disc list-inside">
                                        {flight.scoreDetails?.pros.map((p, i) => <li key={i}>{p}</li>)}
                                    </ul>
                                </div>
                            </div>
                        ) : null}

                    </div>

                    {/* JUNIOR GUARDIAN BADGE */}
                    <div className="col-span-2 md:col-span-4 mt-2">
                        <JuniorBadge flight={flight} />
                    </div>
                </div>
            )}
        </div>
    );
}

function AmenityBox({ icon: Icon, label, value, sub, isGood, isBad }: any) {
    return (
        <div className={`p-3 rounded-2xl border ${isGood ? 'bg-blue-50 border-blue-100' : isBad ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
            <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${isGood ? 'text-blue-600' : isBad ? 'text-red-500' : 'text-slate-400'}`} />
                <span className="text-[10px] font-black uppercase text-slate-400">{label}</span>
            </div>
            <div className={`font-bold text-sm ${isGood ? 'text-blue-900' : isBad ? 'text-red-900' : 'text-slate-700'}`}>{value}</div>
            {sub && <div className="text-[10px] font-bold text-slate-500 mt-0.5">{sub}</div>}
        </div>
    )
}

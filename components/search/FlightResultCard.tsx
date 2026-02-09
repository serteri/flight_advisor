'use client';

import { useState } from 'react';
import { FlightResult } from '@/types/hybridFlight';
import { Loader2, Shield, Trophy, AlertTriangle, CheckCircle2, Wifi, Zap, Utensils, Armchair, LayoutGrid, Clock } from 'lucide-react';

interface FlightResultCardProps {
    flight: FlightResult;
}

export default function FlightResultCard({ flight }: FlightResultCardProps) {
    const [analyzing, setAnalyzing] = useState(false);
    const [analysis, setAnalysis] = useState<FlightResult['analysis'] | null>(null);
    const [score, setScore] = useState<number | null>(null);
    const [enrichedFlight, setEnrichedFlight] = useState<FlightResult | null>(null);

    const handleAnalyze = async () => {
        setAnalyzing(true);
        try {
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(flight),
            });
            const data: FlightResult = await res.json();
            setEnrichedFlight(data); // Store full enriched flight
            setAnalysis(data.analysis);
            setScore(data.score ?? 0);
        } catch (error) {
            console.error('Analysis failed', error);
        } finally {
            setAnalyzing(false);
        }
    };

    const formatCurrency = (amount: number, currency: string) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
    };

    return (
        <div className="group relative bg-white border border-slate-200 hover:border-blue-500 rounded-3xl p-6 transition-all shadow-sm hover:shadow-xl mb-6">
            {/* FREE VIEW: Basic Info */}
            <div className="flex justify-between items-start">
                <div className="flex gap-4">
                    {/* Airline Logo Placeholder */}
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-500">
                        {flight.airline.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-slate-900">{flight.departTime ? flight.departTime.split('T')[1].slice(0, 5) : formatTime(flight.departTime)} - {flight.arriveTime ? flight.arriveTime.split('T')[1].slice(0, 5) : formatTime(flight.arriveTime)}</h3>
                            {flight.stops === 0 && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">Direct</span>}
                        </div>
                        <p className="text-slate-500 text-sm">{flight.airline} • {flight.duration ? Math.floor(flight.duration / 60) : 0}h {flight.duration ? flight.duration % 60 : 0}m</p>
                        <div className="text-xs text-slate-400 mt-1">{flight.from} → {flight.to}</div>
                    </div>
                </div>

                <div className="text-right">
                    <div className="text-2xl font-black text-slate-900">{formatCurrency(flight.price, flight.currency)}</div>
                    <p className="text-xs text-slate-500 mb-2">per adult</p>

                    {!analysis ? (
                        <button
                            onClick={handleAnalyze}
                            disabled={analyzing}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors"
                        >
                            {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                            AI ANALYZE
                        </button>
                    ) : (
                        <div className="flex items-center gap-2 justify-end">
                            <span className="text-3xl font-black text-blue-600">{score}</span>
                            <div className="text-left leading-tight">
                                <div className="text-[10px] font-bold text-slate-400 uppercase">Agent</div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase">Score</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* PREMIUM VIEW: Analysis Section */}
            {analysis && enrichedFlight && (
                <div className="mt-6 pt-6 border-t border-slate-100 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex items-start gap-4 mb-4">
                        <div className="p-3 bg-blue-50 rounded-2xl">
                            <Trophy className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900">Why this flight?</h4>
                            <p className="text-sm text-slate-600 leading-relaxed">{analysis.recommendationText}</p>
                        </div>
                    </div>

                    {/* Detailed Amenities Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        <AmenityItem icon={Wifi} label="Wi-Fi" value={enrichedFlight.wifi ? "Available" : "No"} high={enrichedFlight.wifi} />
                        <AmenityItem icon={Zap} label="Power" value={enrichedFlight.power ? "USB/Outlets" : "No"} high={enrichedFlight.power} />
                        <AmenityItem icon={Utensils} label="Meal" value={enrichedFlight.meal === 'included' ? "Included" : "Paid/None"} high={enrichedFlight.meal === 'included'} />
                        <AmenityItem icon={Armchair} label="Legroom" value={enrichedFlight.legroom || "Standard"} />
                        <AmenityItem icon={LayoutGrid} label="Layout" value={enrichedFlight.layout || "Unk"} />
                        <AmenityItem icon={Clock} label="Plane Age" value={enrichedFlight.aircraftAge ? `${enrichedFlight.aircraftAge}y` : "Unk"} high={enrichedFlight.aircraftAge ? enrichedFlight.aircraftAge < 5 : false} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-green-50 p-4 rounded-2xl">
                            <h5 className="font-bold text-green-700 text-xs uppercase mb-2 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4" /> Pros
                            </h5>
                            <ul className="space-y-1">
                                {analysis.pros.map((pro, i) => (
                                    <li key={i} className="text-sm text-slate-700">• {pro}</li>
                                ))}
                            </ul>
                        </div>
                        <div className="bg-orange-50 p-4 rounded-2xl">
                            <h5 className="font-bold text-orange-700 text-xs uppercase mb-2 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" /> Cons
                            </h5>
                            <ul className="space-y-1">
                                {analysis.cons.map((con, i) => (
                                    <li key={i} className="text-sm text-slate-700">• {con}</li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {flight.bookingLink && (
                        <a href={flight.bookingLink} target="_blank" rel="noopener noreferrer" className="mt-4 w-full block text-center bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition-colors">
                            Book Now for {formatCurrency(flight.price, flight.currency)}
                        </a>
                    )}
                </div>
            )}
        </div>
    );
}

function AmenityItem({ icon: Icon, label, value, high }: { icon: any, label: string, value: string, high?: boolean }) {
    return (
        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg">
            <Icon className={`w-4 h-4 ${high === true ? 'text-green-600' : high === false ? 'text-red-400' : 'text-slate-400'}`} />
            <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold">{label}</div>
                <div className="text-xs font-bold text-slate-700">{value}</div>
            </div>
        </div>
    )
}

function formatTime(dateString: string) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

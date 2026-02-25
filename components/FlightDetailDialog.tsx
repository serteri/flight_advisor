"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FlightResult } from "@/types/hybridFlight";
import { Plane, Clock, Luggage, Utensils, Wifi, Info } from "lucide-react";
import { AirlineLogo } from "./AirlineLogo";
import { TrackButton } from "@/components/TrackButton";

interface FlightDetailDialogProps {
    flight: FlightResult | null;
    open: boolean;
    onClose: () => void;
    canTrack?: boolean;
}

const safeDate = (d: any) => {
    if (!d) return "--:--";
    try {
        const date = new Date(d);
        return isNaN(date.getTime()) ? "--:--" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
        return "--:--";
    }
};

const toMinutes = (value: unknown): number => {
    if (typeof value === "number" && Number.isFinite(value)) {
        return Math.max(0, value);
    }

    if (typeof value === "string") {
        const isoMatch = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
        if (isoMatch) {
            const h = parseInt(isoMatch[1] || "0", 10);
            const m = parseInt(isoMatch[2] || "0", 10);
            return Math.max(0, h * 60 + m);
        }

        const hmMatch = value.match(/(\d+)\s*h\s*(\d+)?\s*m?/i);
        if (hmMatch) {
            const h = parseInt(hmMatch[1] || "0", 10);
            const m = parseInt(hmMatch[2] || "0", 10);
            return Math.max(0, h * 60 + m);
        }

        const minsMatch = value.match(/(\d+)\s*m(in)?/i);
        if (minsMatch) {
            return Math.max(0, parseInt(minsMatch[1], 10));
        }

        const numeric = parseFloat(value);
        if (Number.isFinite(numeric)) {
            return Math.max(0, numeric);
        }
    }

    return 0;
};

export function FlightDetailDialog({ flight, open, onClose, canTrack = false }: FlightDetailDialogProps) {
    if (!flight) return null;

    const segs = Array.isArray(flight.segments) ? flight.segments.filter(s => s) : [];
    const lays = Array.isArray(flight.layovers) ? flight.layovers : [];

    const formatDuration = (minutes: number | string | undefined) => {
        const resolved = toMinutes(minutes);
        if (!resolved || Number.isNaN(resolved)) return "--";
        const h = Math.floor(resolved / 60);
        const m = resolved % 60;
        return `${h}h ${m}m`;
    };

    const breakdown = flight.advancedScore?.breakdown;
    const breakdownRows = breakdown
        ? [
            { label: "Price Value", value: `${breakdown.priceValue}/20` },
            { label: "Duration", value: `${breakdown.duration}/15` },
            { label: "Stops", value: `${breakdown.stops}/10` },
            { label: "Connection", value: `${breakdown.connection}/10` },
            { label: "Self-Transfer", value: `${breakdown.selfTransfer}/10` },
            { label: "Baggage", value: `${breakdown.baggage}/10` },
            { label: "Reliability", value: `${breakdown.reliability}/10` },
            { label: "Aircraft", value: `${breakdown.aircraft}/5` },
            { label: "Amenities", value: `${breakdown.amenities}/5` },
            { label: "Airport Index", value: `${breakdown.airportIndex}/5` },
        ]
        : [];

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <img src={flight.airlineLogo || ""} alt={flight.airline} className="w-8 h-8" onError={(e) => {(e.target as any).style.display = "none"}} />
                        <span>{flight.airline} {flight.flightNumber}</span>
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-3 text-sm">
                    <div className="bg-slate-50 p-3 rounded border">
                        <div className="grid grid-cols-3 gap-4">
                            <div><div className="text-xs text-slate-500">Kalkis</div><div className="font-bold text-lg">{safeDate(flight.departTime)}</div><div className="text-xs text-slate-600">{flight.from || "XXX"}</div></div>
                            <div className="text-center"><Clock className="w-5 h-5 mx-auto text-slate-400" /><div className="font-bold">{formatDuration(flight.duration || 0)}</div><div className="text-xs bg-blue-100 text-blue-700 w-fit mx-auto px-2 py-1 rounded my-1 font-bold">{flight.stops === 0 ? "Direkt" : flight.stops + " Aktarma"}</div></div>
                            <div className="text-right"><div className="text-xs text-slate-500">Varis</div><div className="font-bold text-lg">{safeDate(flight.arriveTime)}</div><div className="text-xs text-slate-600">{flight.to || "XXX"}</div></div>
                        </div>
                    </div>
                    <div className="bg-white p-3 rounded border"><h3 className="font-bold mb-2 flex items-center gap-1"><Luggage className="w-4 h-4" /> Bagaj</h3><div className="grid grid-cols-2 gap-2 text-xs"><div><div className="text-slate-500">Kabin</div><div className="font-bold">{flight.policies?.cabinBagKg || 7}kg</div></div><div><div className="text-slate-500">Kontrol</div><div className="font-bold">{flight.policies?.baggageKg || 20}kg</div></div></div></div>
                    {segs.length > 0 && (
                        <div className="bg-white p-3 rounded border"><h3 className="font-bold mb-2 flex items-center gap-1"><Plane className="w-4 h-4" /> Segmentler ({segs.length})</h3><div className="space-y-2">{segs.map((s: any, i: number) => {const c = s.operating_carrier || s.operatingCarrier || {name: "Havayolu"}; const d = s.departing_at || s.departure; const a = s.arriving_at || s.arrival; return (<div key={i} className="border-b pb-2 last:border-0"><div className="flex items-center gap-2 mb-1"><AirlineLogo carrierCode={c.iata_code || "XX"} airlineName={c.name} className="w-5 h-5" /><div className="text-xs font-bold flex-1">{c.name}</div><div className="text-xs text-slate-500">Seg {i+1}</div></div><div className="grid grid-cols-3 gap-2 text-xs"><div><div className="text-slate-500">Kal</div><div className="font-bold">{safeDate(d)}</div></div><div className="text-center"><div className="text-slate-500">S</div><div className="font-bold">{formatDuration(s.duration || 0)}</div></div><div className="text-right"><div className="text-slate-500">Var</div><div className="font-bold">{safeDate(a)}</div></div></div>{lays[i] && <div className="mt-1 text-xs bg-amber-50 border border-amber-200 p-1 rounded">⏱️ {lays[i].airport} - {formatDuration(lays[i].duration || 0)}</div>}</div>)})}</div></div>
                    )}

                    {flight.advancedScore && (
                        <div className="bg-white p-3 rounded border space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold">Score Breakdown</h3>
                                <div className="text-right">
                                    <div className="text-xs text-slate-500">Total</div>
                                    <div className="text-xl font-black text-blue-700">
                                        {flight.advancedScore.displayScore.toFixed(1)} / 10
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                {breakdownRows.map((row) => (
                                    <div key={row.label} className="flex justify-between bg-slate-50 rounded px-2 py-1.5">
                                        <span className="font-medium text-slate-600">{row.label}</span>
                                        <span className="font-bold text-slate-900">{row.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {flight.advancedScore && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="bg-rose-50 border border-rose-200 p-3 rounded">
                                <h3 className="font-bold text-rose-700 mb-2">🚩 Risk Flags</h3>
                                {flight.advancedScore.riskFlags.length > 0 ? (
                                    <ul className="space-y-1 text-xs text-rose-700">
                                        {flight.advancedScore.riskFlags.map((flag) => (
                                            <li key={flag}>• {flag}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-xs text-rose-600">Belirgin risk flag yok.</p>
                                )}
                            </div>
                            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded">
                                <h3 className="font-bold text-emerald-700 mb-2">🛡️ Comfort Notes</h3>
                                {flight.advancedScore.comfortNotes.length > 0 ? (
                                    <ul className="space-y-1 text-xs text-emerald-700">
                                        {flight.advancedScore.comfortNotes.map((note) => (
                                            <li key={note}>• {note}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-xs text-emerald-600">Ekstra konfor notu bulunamadı.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {flight.advancedScore && (
                        <div className="bg-indigo-50 p-3 rounded border border-indigo-200">
                            <div className="text-xs text-indigo-700 mb-1">💎 Value Tag</div>
                            <div className="text-sm font-bold text-indigo-900">{flight.advancedScore.valueTag}</div>
                        </div>
                    )}

                    <div className="bg-white p-3 rounded border"><h3 className="font-bold mb-2">Hizmetler</h3><div className="grid grid-cols-3 gap-2 text-xs"><div className="flex items-center gap-1"><Utensils className={`w-4 h-4 ${flight.amenities?.hasMeal ? "text-emerald-600" : "text-slate-300"}`} /><span>{flight.amenities?.hasMeal ? "Yemek" : "Yok"}</span></div><div className="flex items-center gap-1"><Wifi className={`w-4 h-4 ${flight.amenities?.hasWifi ? "text-blue-600" : "text-slate-300"}`} /><span>{flight.amenities?.hasWifi ? "WiFi" : "Yok"}</span></div><div className="flex items-center gap-1"><Info className="w-4 h-4 text-slate-400" /><span>{flight.cabinClass || "Economy"}</span></div></div></div>
                    <div className="bg-blue-50 p-3 rounded border border-blue-200"><div className="text-xs text-blue-700 mb-1">Toplam</div><div className="text-3xl font-bold text-blue-900">${flight.price}</div></div>
                    {canTrack && (
                        <div className="pt-2">
                            <TrackButton
                                flight={{
                                    flightNumber: flight.flightNumber,
                                    airline: flight.airline,
                                    origin: flight.from,
                                    destination: flight.to,
                                    departureTime: flight.departTime,
                                    price: flight.price,
                                    currency: flight.currency,
                                    duration: flight.duration,
                                    stops: flight.stops,
                                    segments: flight.segments as any,
                                    layovers: flight.layovers as any,
                                    cabin: flight.cabinClass
                                }}
                            />
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

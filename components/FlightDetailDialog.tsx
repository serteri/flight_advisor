"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FlightResult } from "@/types/hybridFlight";
import { Plane, Clock, Luggage, Utensils, Wifi, Info } from "lucide-react";
import { AirlineLogo } from "./AirlineLogo";

interface FlightDetailDialogProps {
    flight: FlightResult | null;
    open: boolean;
    onClose: () => void;
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

export function FlightDetailDialog({ flight, open, onClose }: FlightDetailDialogProps) {
    if (!flight) return null;

    const segs = Array.isArray(flight.segments) ? flight.segments.filter(s => s) : [];
    const lays = Array.isArray(flight.layovers) ? flight.layovers : [];

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
                            <div className="text-center"><Clock className="w-5 h-5 mx-auto text-slate-400" /><div className="font-bold">{Math.floor((flight.duration || 0) / 60)}s</div><div className="text-xs bg-blue-100 text-blue-700 w-fit mx-auto px-2 py-1 rounded my-1 font-bold">{flight.stops === 0 ? "Direkt" : flight.stops + " Aktarma"}</div></div>
                            <div className="text-right"><div className="text-xs text-slate-500">Varis</div><div className="font-bold text-lg">{safeDate(flight.arriveTime)}</div><div className="text-xs text-slate-600">{flight.to || "XXX"}</div></div>
                        </div>
                    </div>
                    <div className="bg-white p-3 rounded border"><h3 className="font-bold mb-2 flex items-center gap-1"><Luggage className="w-4 h-4" /> Bagaj</h3><div className="grid grid-cols-2 gap-2 text-xs"><div><div className="text-slate-500">Kabin</div><div className="font-bold">{flight.policies?.cabinBagKg || 7}kg</div></div><div><div className="text-slate-500">Kontrol</div><div className="font-bold">{flight.policies?.baggageKg || 20}kg</div></div></div></div>
                    {segs.length > 0 && (
                        <div className="bg-white p-3 rounded border"><h3 className="font-bold mb-2 flex items-center gap-1"><Plane className="w-4 h-4" /> Segmentler ({segs.length})</h3><div className="space-y-2">{segs.map((s: any, i: number) => {const c = s.operating_carrier || s.operatingCarrier || {name: "Havayolu"}; const d = s.departing_at || s.departure; const a = s.arriving_at || s.arrival; return (<div key={i} className="border-b pb-2 last:border-0"><div className="flex items-center gap-2 mb-1"><AirlineLogo carrierCode={c.iata_code || "XX"} airlineName={c.name} className="w-5 h-5" /><div className="text-xs font-bold flex-1">{c.name}</div><div className="text-xs text-slate-500">Seg {i+1}</div></div><div className="grid grid-cols-3 gap-2 text-xs"><div><div className="text-slate-500">Kal</div><div className="font-bold">{safeDate(d)}</div></div><div className="text-center"><div className="text-slate-500">S</div><div className="font-bold">{s.duration ? Math.floor(s.duration/60) + "s" : "--"}</div></div><div className="text-right"><div className="text-slate-500">Var</div><div className="font-bold">{safeDate(a)}</div></div></div>{lays[i] && <div className="mt-1 text-xs bg-amber-50 border border-amber-200 p-1 rounded">?? {lays[i].airport} - {Math.floor((lays[i].duration || 0)/60)}s {(lays[i].duration || 0) % 60}dk</div>}</div>)})}</div></div>
                    )}
                    <div className="bg-white p-3 rounded border"><h3 className="font-bold mb-2">Hizmetler</h3><div className="grid grid-cols-3 gap-2 text-xs"><div className="flex items-center gap-1"><Utensils className={`w-4 h-4 ${flight.amenities?.hasMeal ? "text-emerald-600" : "text-slate-300"}`} /><span>{flight.amenities?.hasMeal ? "Yemek" : "Yok"}</span></div><div className="flex items-center gap-1"><Wifi className={`w-4 h-4 ${flight.amenities?.hasWifi ? "text-blue-600" : "text-slate-300"}`} /><span>{flight.amenities?.hasWifi ? "WiFi" : "Yok"}</span></div><div className="flex items-center gap-1"><Info className="w-4 h-4 text-slate-400" /><span>{flight.cabinClass || "Economy"}</span></div></div></div>
                    <div className="bg-blue-50 p-3 rounded border border-blue-200"><div className="text-xs text-blue-700 mb-1">Toplam</div><div className="text-3xl font-bold text-blue-900">${flight.price}</div></div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

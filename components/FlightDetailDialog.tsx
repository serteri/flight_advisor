"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FlightResult } from "@/types/hybridFlight";
import { Plane, Clock, Luggage, Utensils, Wifi, Info } from "lucide-react";
import { AirlineLogo } from "./AirlineLogo";
import { TrackButton } from "@/components/TrackButton";
import { useLocale } from "next-intl";
import { hasIncludedMeal } from "@/lib/meal-utils";

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

const hasExplicitTimezone = (value: string): boolean => /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim());

const parseIsoDateToUtcMs = (value: string): number => {
    const text = value.trim();
    if (!text) return NaN;
    if (!hasExplicitTimezone(text)) return NaN;
    const timestamp = new Date(text).getTime();
    return Number.isFinite(timestamp) ? timestamp : NaN;
};

const segmentDurationMinutes = (segment: any): number => {
    const direct = toMinutes(segment?.duration);
    if (direct > 0) return direct;

    const depRaw = segment?.departing_at || segment?.departure;
    const arrRaw = segment?.arriving_at || segment?.arrival;
    const depMs = depRaw ? parseIsoDateToUtcMs(String(depRaw)) : NaN;
    const arrMs = arrRaw ? parseIsoDateToUtcMs(String(arrRaw)) : NaN;

    if (Number.isFinite(depMs) && Number.isFinite(arrMs) && arrMs > depMs) {
        return Math.round((arrMs - depMs) / 60000);
    }

    return 0;
};

const toCode = (value: any): string => {
    if (!value) return 'XXX';
    if (typeof value === 'string') return value.toUpperCase();
    if (typeof value === 'object') {
        const candidate =
            value.iata ||
            value.iata_code ||
            value.iataCode ||
            value.code ||
            value.id ||
            value.airport_code;
        if (candidate) {
            return String(candidate).toUpperCase();
        }
    }
    return String(value).toUpperCase();
};

export function FlightDetailDialog({ flight, open, onClose, canTrack = false }: FlightDetailDialogProps) {
    if (!flight) return null;
    const locale = useLocale();
    const isTr = locale?.toLowerCase().startsWith("tr");
    const mealIncluded = hasIncludedMeal(flight);

    const labels = {
        departure: isTr ? "Kalkış" : "Departure",
        arrival: isTr ? "Varış" : "Arrival",
        direct: isTr ? "Direkt" : "Direct",
        stops: isTr ? "Aktarma" : "Stops",
        baggage: isTr ? "Bagaj" : "Baggage",
        cabin: isTr ? "Kabin" : "Cabin",
        checked: isTr ? "Kontrol" : "Checked",
        segments: isTr ? "Segmentler" : "Segments",
        segment: isTr ? "Seg" : "Seg",
        depShort: "Dep",
        arrShort: "Arr",
        durShort: "Dur",
        scoreBreakdown: isTr ? "Skor Dağılımı" : "Score Breakdown",
        priceReference: isTr ? "Price Value Referansı" : "Price Value Reference",
        historicalMedianUsed: isTr ? "Historical median kullanıldı" : "Historical median used",
        liveAverageUsed: isTr ? "Canlı ortalama kullanıldı" : "Live average used",
        total: isTr ? "Toplam" : "Total",
        dataError: isTr ? "Veri Hatası" : "Data Error",
        dataErrorFallback: isTr
            ? "Bu uçuş verisinde süre tutarsızlığı tespit edildi, sonuç işaretlendi."
            : "Duration inconsistency detected for this flight; result has been flagged.",
        riskFlags: isTr ? "Risk İşaretleri" : "Risk Flags",
        noRisk: isTr ? "Belirgin risk işareti yok." : "No significant risk flags.",
        comfortNotes: isTr ? "Konfor Notları" : "Comfort Notes",
        noComfort: isTr ? "Ekstra konfor notu bulunamadı." : "No extra comfort notes.",
        valueTag: "Value Tag",
        amenities: isTr ? "Hizmetler" : "Amenities",
        meal: isTr ? "Yemek" : "Meal",
        yes: isTr ? "Var" : "Yes",
        no: isTr ? "Yok" : "No",
    };

    const translateValueTag = (valueTag: string) => {
        if (isTr) return valueTag;
        const map: Record<string, string> = {
            'En İyi Fiyat/Performans': 'Best Value',
            'Dengeli Seçenek': 'Balanced Choice',
            'Ekonomik Seçenek': 'Budget Option',
            'En Konforlu Seçenek': 'Most Comfortable',
            'Düşük Riskli Seçenek': 'Low Risk Choice',
            'Veri Hatası': 'Data Error',
        };
        return map[valueTag] || valueTag;
    };

    const translateRiskFlag = (flag: string) => {
        if (isTr) return flag;
        const map: Record<string, string> = {
            'Uzun toplam seyahat süresi': 'Long total travel time',
            'Uzun aktarma beklemesi': 'Long layover wait',
            'Çoklu aktarma': 'Multiple stops',
            'Kısa Aktarma Riski': 'Short connection risk',
            'Kendi Transferin': 'Self-transfer required',
            'Sadece kabin bagajı': 'Cabin baggage only',
            'On-time güvenilirliği düşük': 'Low on-time reliability',
            'Eski Uçak': 'Older aircraft',
            'Fiyat rota ortalamasına göre yüksek': 'Price above route average',
            'Veri Hatası': 'Data Error',
            'Top-30 havayolu dışında': 'Outside top-30 airline reputation list',
            'BNE-IST için 14 saatin altındaki toplam süre gerçekçi değil.': 'Total duration under 14 hours for BNE-IST is not realistic.',
        };
        return map[flag] || flag;
    };

    const translateComfortNote = (note: string) => {
        if (isTr) return note;
        const map: Record<string, string> = {
            'Fiyat rota ortalamasına göre çok avantajlı': 'Price is highly advantageous versus route average',
            '23kg+ check-in bagaj dahil': '23kg+ checked baggage included',
            'Havayolu zamanında kalkış performansı güçlü': 'Strong on-time departure performance',
            'Yeni nesil uçak (A350/787 ailesi)': 'New-generation aircraft (A350/787 family)',
            'WiFi mevcut': 'Wi-Fi available',
            'IFE eğlence sistemi mevcut': 'IFE entertainment system available',
            'Yemek servisi dahil': 'Meal service included',
            'Top-tier havayolu itibarı': 'Top-tier airline reputation',
        };
        return map[note] || note;
    };

    const segs = Array.isArray(flight.segments) ? flight.segments.filter(s => s) : [];
    const lays = Array.isArray(flight.layovers) ? flight.layovers : [];

    const totalSegmentMinutes = segs.reduce((sum, s) => sum + segmentDurationMinutes(s), 0);
    const totalLayoverMinutes = lays.reduce((sum, l: any) => sum + toMinutes(l?.duration), 0);
    const calculatedTotalDuration = totalSegmentMinutes + totalLayoverMinutes;
    const displayTotalDuration = toMinutes(flight.duration || 0) || calculatedTotalDuration;

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
                            <div><div className="text-xs text-slate-500">{labels.departure}</div><div className="font-bold text-lg">{safeDate(flight.departTime)}</div><div className="text-xs text-slate-600">{flight.from || "XXX"}</div></div>
                            <div className="text-center"><Clock className="w-5 h-5 mx-auto text-slate-400" /><div className="font-bold">{formatDuration(displayTotalDuration)}</div><div className="text-xs bg-blue-100 text-blue-700 w-fit mx-auto px-2 py-1 rounded my-1 font-bold">{flight.stops === 0 ? labels.direct : `${flight.stops} ${labels.stops}`}</div></div>
                            <div className="text-right"><div className="text-xs text-slate-500">{labels.arrival}</div><div className="font-bold text-lg">{safeDate(flight.arriveTime)}</div><div className="text-xs text-slate-600">{flight.to || "XXX"}</div></div>
                        </div>
                    </div>
                    <div className="bg-white p-3 rounded border"><h3 className="font-bold mb-2 flex items-center gap-1"><Luggage className="w-4 h-4" /> {labels.baggage}</h3><div className="grid grid-cols-2 gap-2 text-xs"><div><div className="text-slate-500">{labels.cabin}</div><div className="font-bold">{flight.policies?.cabinBagKg || 7}kg</div></div><div><div className="text-slate-500">{labels.checked}</div><div className="font-bold">{flight.policies?.baggageKg || 20}kg</div></div></div></div>
                    {segs.length > 0 && (
                        <div className="bg-white p-3 rounded border"><h3 className="font-bold mb-2 flex items-center gap-1"><Plane className="w-4 h-4" /> {labels.segments} ({segs.length})</h3><div className="space-y-2">{segs.map((s: any, i: number) => {const c = s.operating_carrier || s.operatingCarrier || {}; const airlineName = (s.airline || c.name || flight.airline || (isTr ? "Havayolu" : "Airline")).toString(); const carrierCode = (c.iata_code || s.carrier || s.carrierCode || "XX").toString(); const segFrom = toCode(s.origin || s.from || s.departure_airport || s.departureAirport || s.origin_airport); const segTo = toCode(s.destination || s.to || s.arrival_airport || s.arrivalAirport || s.destination_airport); const d = s.departing_at || s.departure; const a = s.arriving_at || s.arrival; const segMinutes = segmentDurationMinutes(s); return (<div key={i} className="border-b pb-2 last:border-0"><div className="flex items-center gap-2 mb-1"><AirlineLogo carrierCode={carrierCode} airlineName={airlineName} className="w-5 h-5" /><div className="text-sm font-semibold flex-1">{airlineName}</div><div className="text-xs text-slate-500">{labels.segment} {i+1}: {segFrom} → {segTo}</div></div><div className="grid grid-cols-3 gap-2 text-sm"><div><div className="text-slate-500">{labels.depShort}</div><div className="font-semibold">{safeDate(d)}</div></div><div className="text-center"><div className="text-slate-500">{labels.durShort}</div><div className="font-semibold">{formatDuration(segMinutes)}</div></div><div className="text-right"><div className="text-slate-500">{labels.arrShort}</div><div className="font-semibold">{safeDate(a)}</div></div></div>{lays[i] && <div className="mt-1 text-sm bg-amber-50 border border-amber-200 p-1.5 rounded">⏱️ {toCode(lays[i].airport)} - {formatDuration(lays[i].duration || 0)}</div>}</div>)})}</div></div>
                    )}

                    {flight.advancedScore && (
                        <div className="bg-white p-3 rounded border space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-base">{labels.scoreBreakdown}</h3>
                                <div className="text-right">
                                    <div className="text-sm text-slate-500">{labels.total}</div>
                                    <div className="text-2xl font-black text-blue-700">
                                        {flight.advancedScore.displayScore.toFixed(1)} / 10
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                {breakdownRows.map((row) => (
                                    <div key={row.label} className="flex justify-between bg-slate-50 rounded px-2 py-1.5">
                                        <span className="font-semibold text-slate-600">{row.label}</span>
                                        <span className="font-bold text-slate-900">{row.value}</span>
                                    </div>
                                ))}
                            </div>
                            {flight.advancedScore.priceReference && (
                                <div className="text-xs text-slate-500 bg-slate-50 rounded px-2 py-1.5">
                                    {labels.priceReference}: {flight.advancedScore.priceReference.source === 'historicalMedian' ? labels.historicalMedianUsed : labels.liveAverageUsed}
                                    {Number.isFinite(flight.advancedScore.priceReference.amount) && flight.advancedScore.priceReference.amount > 0
                                        ? ` (${Math.round(flight.advancedScore.priceReference.amount)} ${flight.currency || 'USD'})`
                                        : ''}
                                </div>
                            )}
                        </div>
                    )}

                    {flight.advancedScore?.dataQuality === 'invalid' && (
                        <div className="bg-red-50 border border-red-200 rounded p-3">
                            <h3 className="font-bold text-red-700 mb-1 text-base">⚠️ {labels.dataError}</h3>
                            <p className="text-xs text-red-700">
                                {flight.advancedScore.dataErrorReason || labels.dataErrorFallback}
                            </p>
                        </div>
                    )}

                    {flight.advancedScore && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="bg-rose-50 border border-rose-200 p-3 rounded">
                                <h3 className="font-bold text-rose-700 mb-2 text-base">🚩 {labels.riskFlags}</h3>
                                {flight.advancedScore.riskFlags.length > 0 ? (
                                    <ul className="space-y-1.5 text-sm text-rose-700">
                                        {flight.advancedScore.riskFlags.map((flag) => (
                                            <li key={flag}>• {translateRiskFlag(flag)}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-rose-600">{labels.noRisk}</p>
                                )}
                            </div>
                            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded">
                                <h3 className="font-bold text-emerald-700 mb-2 text-base">🛡️ {labels.comfortNotes}</h3>
                                {flight.advancedScore.comfortNotes.length > 0 ? (
                                    <ul className="space-y-1.5 text-sm text-emerald-700">
                                        {flight.advancedScore.comfortNotes.map((note) => (
                                            <li key={note}>• {translateComfortNote(note)}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-emerald-600">{labels.noComfort}</p>
                                )}
                            </div>
                        </div>
                    )}

                    {flight.advancedScore && (
                        <div className="bg-indigo-50 p-3 rounded border border-indigo-200">
                            <div className="text-xs text-indigo-700 mb-1">💎 {labels.valueTag}</div>
                            <div className="text-sm font-bold text-indigo-900">{translateValueTag(flight.advancedScore.valueTag)}</div>
                        </div>
                    )}

                    <div className="bg-white p-3 rounded border"><h3 className="font-bold mb-2">{labels.amenities}</h3><div className="grid grid-cols-3 gap-2 text-sm"><div className="flex items-center gap-1"><Utensils className={`w-4 h-4 ${mealIncluded ? "text-emerald-600" : "text-slate-300"}`} /><span>{mealIncluded ? labels.meal : labels.no}</span></div><div className="flex items-center gap-1"><Wifi className={`w-4 h-4 ${flight.amenities?.hasWifi ? "text-blue-600" : "text-slate-300"}`} /><span>{flight.amenities?.hasWifi ? "WiFi" : labels.no}</span></div><div className="flex items-center gap-1"><Info className="w-4 h-4 text-slate-400" /><span>{flight.cabinClass || "Economy"}</span></div></div></div>
                    <div className="bg-blue-50 p-3 rounded border border-blue-200"><div className="text-xs text-blue-700 mb-1">{labels.total}</div><div className="text-3xl font-bold text-blue-900">${flight.price}</div></div>
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

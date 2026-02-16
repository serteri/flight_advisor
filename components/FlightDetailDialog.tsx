"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FlightResult } from "@/types/hybridFlight";
import { Plane, Clock, Luggage, Utensils, Wifi, MapPin, Info, Calendar, Users, AlertCircle } from "lucide-react";
import { AirlineLogo } from "./AirlineLogo";
import { useFormatter } from "next-intl";

interface FlightDetailDialogProps {
    flight: FlightResult | null;
    open: boolean;
    onClose: () => void;
}

export function FlightDetailDialog({ flight, open, onClose }: FlightDetailDialogProps) {
    const format = useFormatter();

    if (!flight) return null;

    const segments = flight.segments || [];
    const layovers = flight.layovers || [];

    return (
        <Dialog open={open} onOpenChange={(isOpen: boolean) => !isOpen && onClose()}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3 text-2xl">
                        <img src={flight.airlineLogo} alt={flight.airline} className="w-10 h-10 object-contain" />
                        <div>
                            <span className="font-black text-slate-900">{flight.airline}</span>
                            <span className="text-sm font-normal text-slate-500 ml-3">{flight.flightNumber}</span>
                        </div>
                    </DialogTitle>
                    <div className="text-sm text-slate-500 flex items-center gap-4 pt-2">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-slate-500" />
                            <span className="text-sm font-medium text-slate-700">
                                {format.dateTime(new Date(flight.departTime), { 
                                    day: 'numeric', 
                                    month: 'long', 
                                    year: 'numeric' 
                                })}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-slate-500" />
                            <span className="text-sm font-medium text-slate-700">
                                {flight.from} → {flight.to}
                            </span>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                            flight.source === 'DUFFEL' 
                                ? 'bg-emerald-100 text-emerald-700' 
                                : 'bg-blue-100 text-blue-700'
                        }`}>
                            📡 {flight.source}
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-6 mt-6">
                    {/* Uçuş Özeti */}
                    <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-6 border border-slate-200">
                        <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-4">Uçuş Özeti</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <div className="text-xs text-slate-500 mb-1">Kalkış</div>
                                <div className="text-2xl font-black text-slate-900">
                                    {format.dateTime(new Date(flight.departTime), { hour: '2-digit', minute: '2-digit' })}
                                </div>
                                <div className="text-sm font-medium text-slate-600">{flight.from}</div>
                            </div>
                            <div className="flex flex-col items-center justify-center">
                                <Clock className="w-5 h-5 text-slate-400 mb-1" />
                                <div className="text-lg font-bold text-slate-700">
                                    {Math.floor(flight.duration / 60)}s {flight.duration % 60}dk
                                </div>
                                <div className={`text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${
                                    flight.stops === 0 
                                        ? 'bg-green-100 text-green-700' 
                                        : 'bg-orange-100 text-orange-700'
                                }`}>
                                    {flight.stops === 0 ? 'Direkt' : `${flight.stops} Aktarma`}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-slate-500 mb-1">Varış</div>
                                <div className="text-2xl font-black text-slate-900">
                                    {format.dateTime(new Date(flight.arriveTime), { hour: '2-digit', minute: '2-digit' })}
                                </div>
                                <div className="text-sm font-medium text-slate-600">{flight.to}</div>
                            </div>
                        </div>
                    </div>

                    {/* Bagaj Bilgileri */}
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                        <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-4 flex items-center gap-2">
                            <Luggage className="w-4 h-4" />
                            Bagaj Bilgileri
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                        <Luggage className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <span className="font-bold text-slate-900">Kabin Bagajı</span>
                                </div>
                                <div className="text-sm text-slate-600">
                                    {flight.baggageSummary?.cabin || flight.policies?.cabinBagKg 
                                        ? `${flight.policies?.cabinBagKg || 7}kg` 
                                        : '1 Parça (Standart)'}
                                </div>
                                <div className="text-xs text-slate-400 mt-1">Ücretsiz</div>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                                        <Luggage className="w-4 h-4 text-emerald-600" />
                                    </div>
                                    <span className="font-bold text-slate-900">Kontrol Edilen Bagaj</span>
                                </div>
                                <div className="text-sm text-slate-600">
                                    {flight.baggageSummary?.checked || flight.policies?.baggageKg 
                                        ? `${flight.policies?.baggageKg || 20}kg` 
                                        : flight.amenities?.baggage === 'Dahil' 
                                            ? '20kg (Standart)' 
                                            : 'Kontrol Et'}
                                </div>
                                <div className="text-xs text-slate-400 mt-1">
                                    {flight.amenities?.baggage === 'Dahil' ? 'Dahil' : 'Ücretli olabilir'}
                                </div>
                            </div>
                        </div>
                        {flight.baggageSummary?.totalWeight && (
                            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                                <div className="flex items-center gap-2 text-sm text-blue-900">
                                    <Info className="w-4 h-4" />
                                    <span className="font-medium">Toplam Ağırlık: {flight.baggageSummary.totalWeight}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Uçuş Segmentleri */}
                    {segments.length > 0 && (
                        <div className="bg-white rounded-xl border border-slate-200 p-6">
                            <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-4 flex items-center gap-2">
                                <Plane className="w-4 h-4" />
                                Uçuş Detayları ({segments.length} Segment)
                            </h3>
                            <div className="space-y-4">
                                {segments.map((seg: any, idx: number) => {
                                    const layover = layovers[idx];
                                    const operatingCarrier = seg.operating_carrier || seg.operatingCarrier || {};
                                    const marketingCarrier = seg.marketing_carrier || seg.marketingCarrier || {};
                                    const isDifferentCarrier = operatingCarrier.iata_code !== marketingCarrier.iata_code;
                                    
                                    return (
                                        <div key={idx}>
                                            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex items-center gap-3">
                                                        <AirlineLogo 
                                                            carrierCode={operatingCarrier.iata_code || marketingCarrier.iata_code} 
                                                            airlineName={operatingCarrier.name || marketingCarrier.name}
                                                            className="w-8 h-8"
                                                        />
                                                        <div>
                                                            <div className="font-bold text-slate-900">
                                                                {operatingCarrier.name || marketingCarrier.name || 'Havayolu'}
                                                            </div>
                                                            <div className="text-xs text-slate-500">
                                                                {seg.operating_carrier_flight_number || seg.flightNumber || 'FLT'}
                                                            </div>
                                                            {isDifferentCarrier && (
                                                                <div className="text-xs text-amber-600 font-medium mt-1 flex items-center gap-1">
                                                                    <AlertCircle className="w-3 h-3" />
                                                                    Codeshare: Pazarlamacı {marketingCarrier.name}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-xs font-medium text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200">
                                                        Segment {idx + 1}
                                                    </div>
                                                </div>
                                                
                                                <div className="grid grid-cols-3 gap-4 mt-4">
                                                    <div>
                                                        <div className="text-xs text-slate-500 mb-1">Kalkış</div>
                                                        <div className="text-lg font-black text-slate-900">
                                                            {format.dateTime(new Date(seg.departing_at || seg.departure), { 
                                                                hour: '2-digit', 
                                                                minute: '2-digit' 
                                                            })}
                                                        </div>
                                                        <div className="text-sm font-medium text-slate-600">
                                                            {seg.origin?.iata_code || seg.from || 'XXX'}
                                                        </div>
                                                        {seg.origin?.city_name && (
                                                            <div className="text-xs text-slate-400">
                                                                {seg.origin.city_name}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center justify-center">
                                                        <div className="text-center">
                                                            <Plane className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                                                            <div className="text-xs text-slate-500">
                                                                {seg.aircraft || seg.distance || '—'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-xs text-slate-500 mb-1">Varış</div>
                                                        <div className="text-lg font-black text-slate-900">
                                                            {format.dateTime(new Date(seg.arriving_at || seg.arrival), { 
                                                                hour: '2-digit', 
                                                                minute: '2-digit' 
                                                            })}
                                                        </div>
                                                        <div className="text-sm font-medium text-slate-600">
                                                            {seg.destination?.iata_code || seg.to || 'XXX'}
                                                        </div>
                                                        {seg.destination?.city_name && (
                                                            <div className="text-xs text-slate-400">
                                                                {seg.destination.city_name}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Aktarma Süresi */}
                                            {layover && (
                                                <div className="flex items-center justify-center py-3">
                                                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 flex items-center gap-2">
                                                        <Clock className="w-4 h-4 text-amber-600" />
                                                        <span className="text-sm font-bold text-amber-900">
                                                            {layover.airport} havalimanında {Math.floor(layover.duration / 60)}s {layover.duration % 60}dk aktarma
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Hizmetler */}
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                        <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-4">Hizmetler</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div className={`flex items-center gap-3 p-3 rounded-lg ${
                                flight.amenities?.hasMeal ? 'bg-emerald-50 border border-emerald-100' : 'bg-slate-50 border border-slate-100'
                            }`}>
                                <Utensils className={`w-5 h-5 ${flight.amenities?.hasMeal ? 'text-emerald-600' : 'text-slate-300'}`} />
                                <div>
                                    <div className="text-sm font-medium text-slate-900">Yemek</div>
                                    <div className="text-xs text-slate-500">
                                        {flight.amenities?.hasMeal ? 'Dahil' : 'Yok / Ücretli'}
                                    </div>
                                </div>
                            </div>
                            <div className={`flex items-center gap-3 p-3 rounded-lg ${
                                flight.amenities?.hasWifi ? 'bg-blue-50 border border-blue-100' : 'bg-slate-50 border border-slate-100'
                            }`}>
                                <Wifi className={`w-5 h-5 ${flight.amenities?.hasWifi ? 'text-blue-600' : 'text-slate-300'}`} />
                                <div>
                                    <div className="text-sm font-medium text-slate-900">Wi-Fi</div>
                                    <div className="text-xs text-slate-500">
                                        {flight.amenities?.hasWifi ? 'Mevcut' : 'Yok'}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                                <Users className="w-5 h-5 text-slate-400" />
                                <div>
                                    <div className="text-sm font-medium text-slate-900">Sınıf</div>
                                    <div className="text-xs text-slate-500 capitalize">
                                        {flight.cabinClass || 'Economy'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Fiyat Detayları */}
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-sm text-blue-700 font-medium mb-1">Toplam Fiyat</div>
                                <div className="text-4xl font-black text-blue-900">
                                    ${flight.price}
                                </div>
                                <div className="text-xs text-blue-600 mt-1">{flight.currency}</div>
                            </div>
                            {flight.agentScore && (
                                <div className="text-center bg-white rounded-xl p-4 shadow-sm border border-blue-200">
                                    <div className="text-3xl font-black text-blue-600">{flight.agentScore.toFixed(1)}</div>
                                    <div className="text-xs text-slate-500 font-medium">Agent Skoru</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

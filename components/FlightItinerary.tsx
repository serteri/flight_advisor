"use client";

import { Plane, Clock, MapPin, Luggage, Utensils, AlignJustify } from "lucide-react";
import { AirlineLogo } from "./AirlineLogo";
import { useFormatter } from "next-intl";

interface FlightItineraryProps {
    segments: any[];
    layovers: any[];
}

export function FlightItinerary({ segments = [], layovers = [] }: FlightItineraryProps) {
    const format = useFormatter();

    if (!segments || segments.length === 0) return null;

    return (
        <div className="space-y-0 relative">
            {/* Vertical Line */}
            <div className="absolute left-[19px] top-4 bottom-4 w-[2px] bg-slate-200 z-0"></div>

            {segments.map((seg, idx) => {
                const depTime = format.dateTime(new Date(seg.departure), { hour: '2-digit', minute: '2-digit' });
                const arrTime = format.dateTime(new Date(seg.arrival), { hour: '2-digit', minute: '2-digit' });
                const depDate = format.dateTime(new Date(seg.departure), { day: 'numeric', month: 'numeric', year: 'numeric' });

                const durationH = Math.floor(seg.duration / 60);
                const durationM = seg.duration % 60;

                const layover = layovers[idx];

                return (
                    <div key={idx} className="relative z-10">
                        {/* SEGMENT */}
                        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4 shadow-sm hover:border-slate-300 transition-colors">
                            {/* Header: Airline & Flight Num */}
                            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-50">
                                <AirlineLogo carrierCode={seg.carrier} airlineName={seg.carrierName} className="w-6 h-6 object-contain" />
                                <div className="text-sm font-bold text-slate-800">
                                    {seg.carrierName || seg.carrier}
                                    <span className="text-slate-400 font-normal ml-2">{seg.flightNumber}</span>
                                </div>
                            </div>

                            <div className="flex gap-6">
                                {/* Times & Places */}
                                <div className="flex flex-col justify-between gap-6 min-w-[80px]">
                                    <div>
                                        <div className="text-xl font-bold text-slate-900">{depTime}</div>
                                        <div className="text-lg font-medium text-slate-500">{seg.from}</div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-slate-400 flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> {durationH}h {durationM}m
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xl font-bold text-slate-900">{arrTime}</div>
                                        <div className="text-lg font-medium text-slate-500">{seg.to}</div>
                                    </div>
                                </div>

                                {/* Visual Path */}
                                <div className="flex flex-col items-center pt-2">
                                    <div className="w-3 h-3 rounded-full border-2 border-slate-800 bg-white mb-1"></div>
                                    <div className="w-[2px] flex-1 bg-slate-200 my-1 relative"></div>
                                    <div className="w-3 h-3 rounded-full border-2 border-slate-800 bg-slate-800 mt-1"></div>
                                </div>

                                {/* Details Column */}
                                <div className="flex-1 py-1 space-y-4">
                                    <div className="text-sm text-slate-600">
                                        <div className="font-medium text-slate-900 mb-1">Departing from {seg.from}</div>
                                        <div className="text-xs text-slate-400">{depDate}</div>
                                    </div>

                                    {/* Amenities / Info */}
                                    <div className="flex gap-4">
                                        <div className="bg-slate-50 px-3 py-1.5 rounded-md flex items-center gap-2 text-xs font-medium text-slate-600 border border-slate-100">
                                            <Luggage className="w-3 h-3 text-emerald-600" /> Baggage Included
                                        </div>
                                        <div className="bg-slate-50 px-3 py-1.5 rounded-md flex items-center gap-2 text-xs font-medium text-slate-600 border border-slate-100">
                                            <Utensils className="w-3 h-3 text-amber-600" /> Meal Service
                                        </div>
                                        <div className="bg-slate-50 px-3 py-1.5 rounded-md flex items-center gap-2 text-xs font-medium text-slate-600 border border-slate-100">
                                            <AlignJustify className="w-3 h-3 text-blue-600" /> Economy
                                        </div>
                                    </div>

                                    <div className="text-sm text-slate-600 mt-auto">
                                        <div className="font-medium text-slate-900 mb-1">Arriving at {seg.to}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* LAYOVER */}
                        {layover && (
                            <div className="ml-10 mb-4 pl-8 border-l-2 border-dashed border-amber-300 py-2">
                                <div className="bg-amber-50 border border-amber-100 text-amber-800 rounded-lg p-3 inline-flex items-center gap-3 shadow-sm">
                                    <Clock className="w-4 h-4" />
                                    <span className="text-sm font-bold">
                                        {Math.floor(layover.duration / 60)}h {layover.duration % 60}m Layover in {layover.airport}
                                    </span>
                                </div>
                                <div className="text-xs text-slate-400 mt-1 ml-1">connection time</div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

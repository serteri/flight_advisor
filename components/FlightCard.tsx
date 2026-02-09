"use client";

import { useState } from "react";
import {
    Plane,
    ChevronDown,
    ChevronUp,
    Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AirlineLogo } from "@/components/AirlineLogo";
import { useTranslations } from "next-intl";
import { FareExplainer } from "@/components/FareExplainer";
import WatchButton from "@/components/flights/WatchButton";
import { FlightForScoring } from "@/lib/flightTypes";

interface FlightCardProps {
    flight: FlightForScoring;
    searchParams?: any;
    bestPrice?: number;
    bestDuration?: number;
}

export function FlightCard({ flight, bestPrice, bestDuration }: FlightCardProps) {
    if (!flight) return null;
    const [isExpanded, setIsExpanded] = useState(false);
    const t = useTranslations("FlightSearch");

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDuration = (minutes: number) => {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h}h ${m}m`;
    };

    // Calculate times
    const segments = flight.segments || [];
    const firstSegment = segments[0] || {};
    const lastSegment = segments[segments.length - 1] || {};

    // Determine "Best" badges
    const isCheapest = bestPrice && flight.price <= bestPrice * 1.05;
    const isFastest = bestDuration && flight.duration <= bestDuration * 1.05;

    return (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition-shadow mb-3">
            {/* MAIN ROW: Compact & Horizontal */}
            <div className="p-4 flex flex-col md:flex-row md:items-center gap-4 md:gap-6">

                {/* 1. Airline Logo & Name */}
                <div className="flex items-center gap-3 md:w-[180px]">
                    <div className="w-8 h-8 relative flex items-center justify-center">
                        <AirlineLogo
                            carrierCode={flight.carrier}
                            airlineName={flight.carrierName}
                            className="w-full h-full object-contain"
                        />
                    </div>
                    <div className="text-sm font-semibold text-slate-700 truncate">
                        {flight.carrierName}
                    </div>
                </div>

                {/* 2. Flight Schedule & Duration */}
                <div className="flex-1 flex items-center justify-between md:justify-start gap-4 md:gap-12">

                    {/* Departure */}
                    <div className="text-left">
                        <div className="text-lg font-bold text-slate-900 leading-none">
                            {formatTime(firstSegment.departure)}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 font-medium">
                            {firstSegment.from}
                        </div>
                    </div>

                    {/* Duration & Stops Visual */}
                    <div className="flex flex-col items-center w-24 md:w-32">
                        <div className="text-xs text-slate-500 mb-1">
                            {formatDuration(flight.duration)}
                        </div>
                        <div className="w-full h-[1px] bg-slate-300 relative flex items-center justify-center">
                            {flight.stops > 0 && (
                                <div className="bg-white px-1">
                                    <div className="w-1.5 h-1.5 rounded-full border border-slate-400 bg-white" />
                                </div>
                            )}
                        </div>
                        <div className={`text-xs mt-1 font-medium ${flight.stops === 0 ? 'text-green-600' : 'text-slate-500'}`}>
                            {flight.stops === 0 ? 'Direct' :
                                `${flight.stops} stop${flight.stops > 1 ? 's' : ''} ${flight.layovers?.[0] ? `• ${flight.layovers[0].airport}` : ''}`
                            }
                        </div>
                    </div>

                    {/* Arrival */}
                    <div className="text-right md:text-left">
                        <div className="text-lg font-bold text-slate-900 leading-none">
                            {formatTime(lastSegment.arrival)}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 font-medium">
                            {lastSegment.to}
                            {/* +1 day indicator could go here if needed */}
                        </div>
                    </div>
                </div>

                {/* 3. Price & Action */}
                <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center md:min-w-[120px] pt-4 md:pt-0 border-t md:border-t-0 border-slate-100 mt-2 md:mt-0">
                    <div className="text-left md:text-right flex flex-col items-end">
                        {/* SCORE BADGE - RESTORED */}
                        {flight.scores?.total && (
                            <div className={`mb-2 px-2 py-0.5 rounded-md text-xs font-bold text-white shadow-sm w-fit ${flight.scores.total >= 8 ? 'bg-emerald-500' : flight.scores.total >= 6 ? 'bg-blue-500' : 'bg-amber-500'}`}>
                                {flight.scores.total.toFixed(1)} / 10
                            </div>
                        )}

                        {(isCheapest || isFastest) && (
                            <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-0.5">
                                {isCheapest ? "Cheapest" : "Fastest"}
                            </div>
                        )}
                        <div className="text-xl md:text-2xl font-bold text-slate-900 leading-none">
                            {Math.round(flight.price).toLocaleString()} <span className="text-sm font-normal text-slate-500">{flight.currency}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                            {flight.travelClass || "Economy"}
                        </div>
                    </div>

                    <div className="flex gap-2 mt-0 md:mt-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 rounded-full"
                            onClick={() => setIsExpanded(!isExpanded)}
                        >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                        <a
                            href={(flight as any).deepLink || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2 px-6 rounded-lg transition-colors"
                        >
                            Select
                        </a>
                    </div>
                </div>
            </div>

            {/* EXPANDED DETAILS */}
            {isExpanded && (
                <div className="border-t border-slate-100 bg-slate-50/50 p-6 animate-in slide-in-from-top-1">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="font-bold text-sm text-slate-900">Flight Details</h4>
                        <WatchButton flightId={flight.id} />
                    </div>

                    <div className="space-y-6 relative">
                        {segments.map((seg: any, idx: number) => (
                            <div key={idx} className="relative pl-6 border-l-2 border-slate-200 ml-2 pb-6 last:pb-0 last:border-0">
                                {/* Dot */}
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-slate-300 bg-white" />

                                <div className="mb-2">
                                    <div className="font-bold text-slate-900">{formatTime(seg.departure)}</div>
                                    <div className="text-sm text-slate-600">{seg.from}</div>
                                </div>

                                <div className="my-3 text-xs text-slate-500 bg-white border border-slate-200 p-2 rounded w-fit flex gap-2 items-center">
                                    <Clock className="w-3 h-3" />
                                    {formatDuration(seg.duration)}
                                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                                    <Plane className="w-3 h-3" />
                                    {seg.carrierName} ({seg.carrier}{seg.flightNumber})
                                </div>

                                <div>
                                    <div className="font-bold text-slate-900">{formatTime(seg.arrival)}</div>
                                    <div className="text-sm text-slate-600">{seg.to}</div>
                                </div>

                                {flight.layovers?.[idx] && (
                                    <div className="mt-4 p-3 bg-amber-50 text-amber-800 text-xs rounded border border-amber-100">
                                        ⏱ {formatDuration(flight.layovers[idx].duration)} layover in {flight.layovers[idx].city} ({flight.layovers[idx].airport})
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-200">
                        <FareExplainer restrictions={flight.fareRestrictions} />
                    </div>
                </div>
            )}
        </div>
    );
}

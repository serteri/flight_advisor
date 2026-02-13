"use client";

import { useState } from "react";
import {
    Plane,
    ChevronDown,
    ChevronUp,
    Clock,
    ExternalLink,
    Luggage,
    Wifi,
    Info,
    Star // Eklendi
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
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

    // --- PROVIDER LOGIC ---
    const providers = flight.bookingProviders || [];
    const sortedProviders = [...providers].sort((a, b) => a.price - b.price);
    const hasMultipleProviders = providers.length > 1;
    const isDuffel = flight.source === 'duffel' || flight.source === 'DUFFEL';
    
    // Duffel için özel link (Aviasales)
    const actionLink = flight.deepLink || flight.bookingLink || "#";

    return (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition-shadow mb-3 relative group">
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
                    <div className="flex flex-col items-center w-32 md:w-40">
                        <div className="text-xs text-slate-500 mb-1">
                            {formatDuration(flight.duration)}
                        </div>
                        
                        {/* Improved Stops Visualization */}
                        <div className="w-full relative group/stops cursor-help">
                             <div className="w-full h-[1px] bg-slate-300 relative flex items-center justify-center my-1">
                                {flight.stops > 0 && (
                                    <div className="bg-white px-1 flex gap-1">
                                        {flight.layovers && flight.layovers.length > 0 ? (
                                            flight.layovers.map((layover, i) => (
                                                <div key={i} className="w-1.5 h-1.5 rounded-full border border-slate-400 bg-white hover:bg-slate-600 transition-colors" />
                                            ))
                                        ) : (
                                            Array.from({ length: flight.stops }).map((_, i) => (
                                                 <div key={i} className="w-1.5 h-1.5 rounded-full border border-slate-400 bg-white" />
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>

                             {/* Hover Detail for Stops */}
                            {flight.stops > 0 && (
                                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover/stops:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none shadow-lg border border-slate-200">
                                    {flight.layovers?.map(l => `${l.airport} (${formatDuration(l.duration)})`).join(', ') || `${flight.stops} Stop(s)`}
                                </div>
                            )}
                        </div>

                        <div className={`text-xs mt-1 font-medium text-center ${flight.stops === 0 ? 'text-green-600' : 'text-slate-500'}`}>
                            {flight.stops === 0 ? 'Direct' :
                                ((flight.layovers?.length ?? 0) > 0 ? 
                                    <span className="flex flex-col">
                                        <span>{flight.stops} Stop{flight.stops > 1 ? 's' : ''}</span>
                                        <span className="text-[10px] text-slate-400">
                                            {flight.layovers!.map(l => `${l.airport} ${formatDuration(l.duration)}`).join(', ')}
                                        </span>
                                    </span>
                                    : `${flight.stops} Stop${flight.stops > 1 ? 's' : ''}`
                                )
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
                        </div>
                    </div>
                </div>

                {/* 3. Price & Action */}
                <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center md:min-w-[120px] pt-4 md:pt-0 border-t md:border-t-0 border-slate-100 mt-2 md:mt-0">
                    <div className="text-left md:text-right flex flex-col items-end">
                        {/* SCORE BADGE */}
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
                        <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-end gap-1">
                            {flight.baggageIncluded ? (
                                <span className="text-emerald-600 flex items-center gap-0.5"><Luggage className="w-3 h-3" /> Inc.</span>
                            ) : (
                                <span className="text-slate-400 flex items-center gap-0.5" title="Baggage info unavailable"><Luggage className="w-3 h-3" /> ?</span>
                            )}
                            <span className="text-slate-300">|</span>
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
                        
                        {/* --- DUFFEL: Check Availability (No Booking) --- */}
                        {isDuffel ? (
                             <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold h-9 px-4 rounded-lg transition-colors flex items-center gap-2 shadow-sm">
                                <a href={actionLink} target="_blank" rel="noopener noreferrer">
                                    Check Availability <ExternalLink className="w-3 h-3 opacity-70" />
                                </a>
                            </Button>
                        ) : hasMultipleProviders ? (
                            /* --- SKY SCRAPPER: Select Provider Dropdown (Skyscanner Style) --- */
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button className="bg-blue-600 hover:bg-blue-700 text-white h-10 px-3 rounded-lg transition-colors flex items-center gap-2 shadow-sm">
                                        <div className="flex flex-col items-start leading-none">
                                            <span className="text-[10px] opacity-80 font-medium">{providers.length} deals from</span>
                                            <span className="text-sm font-bold">{Math.round(sortedProviders[0].price).toLocaleString()} {sortedProviders[0].currency}</span>
                                        </div>
                                        <ChevronDown className="w-4 h-4 ml-1 opacity-70" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 p-0 shadow-xl border-slate-200" align="end">
                                    <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                        <h4 className="font-semibold text-sm text-slate-700">Select Provider</h4>
                                        <span className="text-[10px] text-slate-400">Trusted Agents</span>
                                    </div>
                                    <div className="max-h-72 overflow-y-auto">
                                        {sortedProviders.map((provider, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 hover:bg-blue-50/30 border-b border-slate-100 last:border-0 transition-colors group/provider">
                                                <div className="flex items-center gap-3">
                                                    {/* Agent Logo */}
                                                    <div className="w-8 h-8 rounded-sm border border-slate-100 bg-white flex items-center justify-center overflow-hidden">
                                                        {provider.logo ? (
                                                            <img src={provider.logo} alt={provider.name} className="w-full h-full object-contain" />
                                                        ) : (
                                                            <span className="text-xs font-bold text-slate-400">{provider.name.charAt(0)}</span>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-sm text-slate-900 leading-tight">
                                                            {provider.name}
                                                            {provider.isOfficial && <span className="ml-1 text-[9px] bg-emerald-100 text-emerald-700 px-1 rounded">Official</span>}
                                                        </span>
                                                        <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                                                            {(provider.rating || 0) > 0 && (
                                                                <span className="flex items-center text-amber-500 font-bold">
                                                                    <Star className="w-2.5 h-2.5 fill-current mr-0.5" /> {provider.rating}
                                                                </span>
                                                            )}
                                                            {provider.reviewCount && <span>({provider.reviewCount})</span>}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col items-end gap-1">
                                                    <span className="font-bold text-slate-900">{Math.round(provider.price).toLocaleString()} {provider.currency}</span>
                                                    <a 
                                                        href={provider.link} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => {
                                                            // Affiliate Override Logic
                                                            if (["Trip.com", "Kiwi.com", "Mytrip", "Gotogate"].some(n => provider.name.includes(n))) {
                                                                e.preventDefault();
                                                                window.open(flight.deepLink || flight.bookingLink, '_blank');
                                                            }
                                                        }}
                                                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-md flex items-center transition-colors shadow-sm"
                                                    >
                                                        Select <ChevronDown className="w-2.5 h-2.5 ml-1 -rotate-90" />
                                                    </a>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="p-2 bg-slate-50 text-[10px] text-center text-slate-400 border-t border-slate-100">
                                        Prices include taxes and fees
                                    </div>
                                </PopoverContent>
                            </Popover>
                        ) : (
                            /* --- FALLBACK: Single View Deal Button --- */
                            <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold h-9 px-4 rounded-lg transition-colors flex items-center gap-2 shadow-sm">
                                <a href={actionLink} target="_blank" rel="noopener noreferrer">
                                    View Deal <ExternalLink className="w-3 h-3 opacity-70" />
                                </a>
                            </Button>
                        )}
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

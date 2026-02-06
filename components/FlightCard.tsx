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
import { AmenityBadges } from "@/components/AmenityBadges";
import { StressMap } from "@/components/StressMap";
import { VerdictCard } from "@/components/VerdictCard";
import { getLayoverGuide } from "@/lib/airportGuide"; // Kept for expanded view logic
import { useTranslations } from "next-intl";
import { FlexibilityWidget } from "@/components/search/FlexibilityWidget";
import { FareExplainer } from "@/components/FareExplainer";
import { analyzeUpgradeOpportunity } from "@/services/guardian/upgradeSniper";
import { analyzeDisruption } from "@/services/guardian/disruption";
import WatchButton from "@/components/flights/WatchButton";

interface FlightCardProps {
    flight: any; // Using any to be flexible with the complex Flight type for now
    searchParams?: any;
    bestPrice?: number;
    bestDuration?: number;
}

export function FlightCard({ flight, searchParams, bestPrice, bestDuration }: FlightCardProps) {
    if (!flight) return null;
    const [isExpanded, setIsExpanded] = useState(false);
    const t = useTranslations("FlightSearch");
    const tCommon = useTranslations(); // For root keys like 'smart_choice'

    // Agent Module Integrations
    const economyPrice = flight.price || 0;
    const businessPrice = flight.businessPrice || (economyPrice * 2.5);
    const sniperResult = analyzeUpgradeOpportunity(economyPrice, businessPrice);
    const delayMinutes = flight.delayMinutes || 0;
    const poorMansBusiness = flight.poorMansBusiness || null;

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

    // Safety Fallbacks
    const scores = flight.scores || { total: 0 };
    const identity = flight.identity || { label: 'standard', emoji: '😐', color: 'bg-gray-100' };
    const verdict = flight.aiVerdict || { decision: 'consider', badge: '', reason: '' };
    const stress = flight.stress || { checkIn: 'low', transfer: 'low', baggage: 'low', timeline: 'smooth' };

    // Translation helpers
    const getIdentityLabel = (label: string) => {
        return tCommon(label) === label ? label : tCommon(label); // Fallback if key missing
    };

    // Calculate days to departure
    const departureDate = new Date(firstSegment.departure);
    const today = new Date();
    const diffTime = Math.abs(departureDate.getTime() - today.getTime());
    const daysToDeparture = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return (
        <div className={`group relative bg-white rounded-2xl shadow-sm border transition-all hover:shadow-md mb-4 overflow-hidden ${verdict.decision === 'recommended'
            ? 'border-emerald-200 ring-1 ring-emerald-100'
            : 'border-slate-200'
            }`}>
            {/* 🎯 UPGRADE SNIPER BADGE */}
            {sniperResult.isSniperDeal && (
                <div className="absolute top-0 right-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-bl-xl shadow-lg z-10 animate-pulse">
                    🎯 {sniperResult.message.split(':')[0]}
                </div>
            )}
            {/* --- TOP BANNER: IDENTITY & BADGE --- */}
            <div className="flex justify-between items-center px-5 py-3 border-b border-slate-50 bg-slate-50/30 rounded-t-2xl">
                <div className="flex gap-2 items-center">
                    {/* Identity Badge */}
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${identity.color}`}>
                        <span>{identity.emoji}</span>
                        <span>{getIdentityLabel(identity.label)}</span>
                    </span>

                    {/* Verdict Badge */}
                    {verdict.badge && (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${verdict.decision === 'recommended' ? 'bg-emerald-100 text-emerald-700' :
                            verdict.decision === 'avoid' ? 'bg-red-100 text-red-700' :
                                'bg-slate-100 text-slate-600'
                            }`}>
                            {tCommon(verdict.badge)}
                        </span>
                    )}
                </div>

                {/* Score & Watch Button */}
                <div className="flex items-center gap-2">
                    <div className="text-right flex items-baseline gap-1">
                        <span className={`text-2xl font-black tracking-tight ${scores.total >= 8.5 ? 'text-emerald-600' :
                            scores.total >= 6.5 ? 'text-slate-700' : 'text-red-500'
                            }`}>
                            {scores.total}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">/10</span>
                    </div>
                    <WatchButton flightId={flight.id} />
                </div>
            </div>

            {/* --- MIDDLE: FLIGHT INFO --- */}
            <div className="p-5">
                <div className="flex flex-col md:flex-row gap-6">

                    {/* LEFT: Flight Details */}
                    <div className="flex-1">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                {/* Carrier Logo & Name */}
                                <div className="w-10 h-10 rounded-full bg-white border border-slate-100 p-1 flex items-center justify-center shadow-sm">
                                    <AirlineLogo
                                        carrierCode={flight.carrier}
                                        airlineName={flight.carrierName}
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                                <div>
                                    <div className="font-bold text-slate-900">{flight.carrierName}</div>
                                    <div className="text-xs text-slate-500">
                                        {flight.flightNumber || `${flight.carrier} Flight`}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Route Visual */}
                        <div className="flex items-center gap-4">
                            <div className="text-center min-w-[60px]">
                                <div className="font-bold text-lg text-slate-900">{formatTime(firstSegment.departure)}</div>
                                <div className="text-xs text-slate-500 font-medium">{firstSegment.from}</div>
                            </div>

                            <div className="flex-1 flex flex-col items-center px-2">
                                <div className="text-[10px] text-slate-400 mb-1">{formatDuration(flight.duration)}</div>
                                <div className="w-full h-[2px] bg-slate-200 relative flex items-center justify-center">
                                    {/* Stops dots */}
                                    {flight.stops > 0 && (
                                        <div className="bg-white px-1 relative z-10 flex gap-1">
                                            {Array.from({ length: flight.stops }).map((_, i) => (
                                                <div key={i} className="w-2 h-2 rounded-full border border-slate-300 bg-white" title={`${flight.stops} Stop`} />
                                            ))}
                                        </div>
                                    )}
                                    <Plane className="absolute right-0 text-slate-300 w-3 h-3 translate-x-1/2" />
                                </div>
                                <div className="text-[10px] text-slate-400 mt-1">
                                    {flight.stops === 0 ? t('nonstop') : `${flight.stops} stop(s)`}
                                </div>
                            </div>

                            <div className="text-center min-w-[60px]">
                                <div className="font-bold text-lg text-slate-900">{formatTime(lastSegment.arrival)}</div>
                                <div className="text-xs text-slate-500 font-medium">{lastSegment.to}</div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Price & Actions */}
                    <div className="flex flex-col items-end justify-between min-w-[140px] pt-2">
                        <div className="text-right flex flex-col items-end gap-1">
                            <div className="text-2xl font-black text-slate-900">
                                {Math.round(flight.price).toLocaleString()}
                                <span className="text-sm font-medium text-slate-500 ml-1">{flight.currency}</span>
                            </div>

                            {/* RISK ANALYSIS WIDGET */}
                            <FlexibilityWidget
                                price={flight.price}
                                daysToDeparture={daysToDeparture}
                            />

                            {/* Amenity Badges */}
                            <div className="mt-2 flex justify-end">
                                <AmenityBadges flight={flight} compact />
                            </div>
                        </div>

                        {/* STRESS MAP (Desktop) */}
                        <div className="mt-4 hidden md:block">
                            <StressMap stress={stress} />
                        </div>

                        {/* 🛡️ DISRUPTION HUNTER / BOOKING BUTTON */}
                        <div className="mt-4">
                            {delayMinutes > 180 ? (
                                <a
                                    href={flight.disruptionLink || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-block w-full px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold rounded-lg hover:from-orange-600 hover:to-red-600 transition shadow-lg text-center"
                                >
                                    ⚠️ 600€ TAZMİNAT AL
                                </a>
                            ) : (
                                <a
                                    href={flight.deepLink || flight.affiliateUrl || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-block w-full px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition shadow-md text-center"
                                >
                                    REZERVE ET
                                </a>
                            )}
                        </div>
                    </div>
                </div>

                {/* 💺 POOR MAN'S BUSINESS ALERT */}
                {poorMansBusiness && (
                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs text-green-700 font-semibold bg-green-50 p-3 rounded-lg">
                        <span className="text-lg">✨</span>
                        <span>{poorMansBusiness.alert}</span>
                    </div>
                )}

                {/* STRESS MAP (Mobile) */}
                <div className="mt-4 md:hidden">
                    <StressMap stress={stress} />
                </div>

                {/* VERDICT CARD */}
                <VerdictCard verdict={verdict} />

                {/* EXPANDER TOGGLE */}
                <div className="mt-4 flex justify-center">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-xs text-slate-400 hover:text-slate-600 h-8 gap-1"
                    >
                        {isExpanded ? (
                            <>
                                <ChevronUp className="w-3 h-3" />
                                {t('hideDetails')}
                            </>
                        ) : (
                            <>
                                <ChevronDown className="w-3 h-3" />
                                {t('flightDetails')}
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* --- EXPANDED DETAILS (LEGACY / SIMPLIFIED) --- */}
            {isExpanded && (
                <div className="border-t border-slate-100 bg-slate-50/50 p-5 rounded-b-2xl animate-in slide-in-from-top-2 duration-200">

                    {/* AGENT ANALYSIS BOX */}
                    <FareExplainer restrictions={flight.fareRestrictions} />

                    <div className="space-y-6 mt-6">
                        {/* Segments Loop */}
                        {segments.map((seg: any, idx: number) => (
                            <div key={idx} className="relative pl-6 border-l-2 border-slate-200 ml-2 pb-6 last:pb-0 last:border-0">
                                {/* Dot */}
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-slate-300 bg-white" />

                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="font-bold text-sm text-slate-800">
                                            {formatTime(seg.departure)} • {seg.from}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1">
                                            {seg.departure.split('T')[0]}
                                        </div>
                                    </div>
                                </div>

                                <div className="my-3 text-xs text-slate-500 flex gap-3 bg-white p-2 rounded border border-slate-100 w-fit">
                                    <span className="flex items-center gap-1">
                                        <Plane className="w-3 h-3" /> {seg.carrierName} ({seg.flightNumber})
                                    </span>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> {formatDuration(seg.duration)}
                                    </span>
                                    <span>•</span>
                                    <span>{seg.cabin || 'Economy'}</span>
                                </div>

                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="font-bold text-sm text-slate-800">
                                            {formatTime(seg.arrival)} • {seg.to}
                                        </div>
                                    </div>
                                </div>

                                {/* Layover Info */}
                                {flight.layovers && flight.layovers[idx] && (
                                    <div className="my-4 p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-800 flex gap-2">
                                        <Clock className="w-4 h-4 shrink-0" />
                                        <div>
                                            <span className="font-bold">{formatDuration(flight.layovers[idx].duration)} Layover in {flight.layovers[idx].airport}</span>
                                            <p className="mt-1 opacity-80">
                                                {/* Simple layover advice placeholder */}
                                                Check connection time.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* TRACK THIS FLIGHT BUTTON */}
                    <div className="mt-8 pt-6 border-t border-slate-200 flex justify-end">
                        <Button
                            disabled={flight.isTracked}
                            onClick={async () => {
                                const btn = document.getElementById(`track-btn-${flight.id}`);
                                if (btn) {
                                    btn.innerText = "Tracking...";
                                    (btn as HTMLButtonElement).disabled = true;
                                }

                                try {
                                    const res = await fetch('/api/track-flight', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            flightNumber: flight.segments[0]?.flightNumber || "UNKNOWN",
                                            airline: flight.carrier,
                                            origin: flight.segments[0]?.from,
                                            destination: flight.segments[flight.segments.length - 1]?.to,
                                            departureDate: flight.segments[0]?.departure,
                                            price: flight.price,
                                            currency: flight.currency,
                                            totalDuration: flight.duration,
                                            stops: flight.stops,
                                            segments: flight.segments,
                                            layovers: flight.layovers,
                                            baggageWeight: flight.baggageWeight
                                        })
                                    });

                                    if (res.ok) {
                                        if (btn) btn.innerText = "Tracked ✅";
                                    } else {
                                        if (btn) {
                                            btn.innerText = "Failed ❌";
                                            (btn as HTMLButtonElement).disabled = false;
                                        }
                                    }
                                } catch (e) {
                                    console.error(e);
                                    if (btn) {
                                        btn.innerText = "Error ❌";
                                        (btn as HTMLButtonElement).disabled = false;
                                    }
                                }
                            }}
                            id={`track-btn-${flight.id}`}
                            className={`gap-2 font-bold shadow-lg shadow-slate-200/50 transition-all ${flight.isTracked
                                ? "bg-green-600 text-white cursor-default hover:bg-green-600 opacity-90 shadow-none"
                                : "bg-slate-900 text-white hover:bg-slate-800"
                                }`}
                        >
                            {flight.isTracked ? (
                                <>
                                    <span className="text-lg">✅</span>
                                    {t('trackingThisFlight')}
                                </>
                            ) : (
                                <>
                                    <span className="text-lg">👀</span>
                                    {t('trackFlight')}
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

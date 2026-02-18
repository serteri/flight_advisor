"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { MasterScoreBreakdown } from "@/lib/flightTypes";
import { Lock, AlertTriangle, CheckCircle, Shield, Plane, Utensils, Luggage, Clock, TrendingUp, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MasterScoreCardProps {
    scoreData: MasterScoreBreakdown;
    isPro?: boolean; // Default false (Free user simulation)
    onUpgrade?: () => void;
}

export function MasterScoreCard({ scoreData, isPro = false, onUpgrade }: MasterScoreCardProps) {
    // 1. Calculate Summary Statuses
    const riskStatus = getStatus(scoreData.reliabilityScore + scoreData.layoverScore, 15);
    const comfortStatus = getStatus(scoreData.aircraftScore + scoreData.airlineScore + scoreData.entertainmentScore, 17);
    const hiddenCostStatus = getStatus(scoreData.baggageScore + scoreData.mealScore, 8);
    
    // Helper function to render a progress bar (0-100%) based on score/max
    const renderBar = (current: number, max: number, label: string, icon: any) => {
        const percent = Math.min(100, (current / max) * 100);
        const color = percent >= 80 ? "bg-emerald-500" : percent >= 50 ? "bg-yellow-500" : "bg-red-500";
        
        return (
            <div className="flex items-center gap-3 w-full text-sm mb-2">
                <div className="w-6 h-6 flex items-center justify-center text-gray-500 bg-gray-50 rounded-full shrink-0">
                    {icon}
                </div>
                <div className="flex-1">
                    <div className="flex justify-between mb-1">
                        <span className="font-medium text-gray-700">{label}</span>
                        <span className="text-gray-500 text-xs">{current}/{max} pts</span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${color}`} style={{ width: `${percent}%` }} />
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
            {/* --- HEADER --- */}
            <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Shield className={cn("w-5 h-5", isPro ? "text-emerald-600" : "text-gray-400")} />
                    <h3 className="font-semibold text-gray-800">Flight Guardian Score</h3>
                </div>
                <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">
                    {isPro ? "PRO ANALYSIS" : "BASIC VIEW"}
                </div>
            </div>

            {/* --- PUBLIC METRICS (ALWAYS VISIBLE) --- */}
            <div className="p-4 border-b">
                <h4 className="text-xs font-semibold text-gray-400 uppercase mb-3">Public Metrics</h4>
                <div className="space-y-3">
                    {renderBar(scoreData.priceScore, 25, "Price Value", <TrendingUp className="w-3 h-3" />)}
                    {renderBar(scoreData.durationScore, 15, "Flight Duration", <Clock className="w-3 h-3" />)}
                    {renderBar(scoreData.stopsScore, 10, "Route Efficiency", <Plane className="w-3 h-3" />)}
                </div>
            </div>

            {/* --- GUARDIAN INTELLIGENCE (TEASER / LOCKED) --- */}
            <div className="relative p-4">
                <h4 className="text-xs font-semibold text-gray-400 uppercase mb-3 flex items-center gap-2">
                    Guardian Intelligence
                    {!isPro && <Lock className="w-3 h-3 text-amber-500" />}
                </h4>

                {/* CONTENT LAYER */}
                <div className={cn("space-y-4 transition-all duration-300", !isPro && "filter blur-sm opacity-50 select-none pointer-events-none")}>
                    
                    {/* 1. RISK ANALYSIS */}
                    <div className="flex items-start gap-3">
                        <div className={cn("mt-1 p-1.5 rounded-full shrink-0", riskStatus.bg)}>
                            {riskStatus.icon}
                        </div>
                        <div>
                            <div className="font-semibold text-gray-800 flex items-center gap-2">
                                Risk Status
                                <span className={cn("text-xs px-2 py-0.5 rounded-full", riskStatus.bg, riskStatus.text)}>
                                    {riskStatus.label}
                                </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                                {riskStatus.desc}
                            </p>
                        </div>
                    </div>

                    {/* 2. COMFORT ANALYSIS */}
                    <div className="flex items-start gap-3">
                        <div className={cn("mt-1 p-1.5 rounded-full shrink-0", comfortStatus.bg)}>
                            <Plane className="w-4 h-4 text-gray-600" />
                        </div>
                        <div>
                            <div className="font-semibold text-gray-800 flex items-center gap-2">
                                Comfort Level
                                <span className={cn("text-xs px-2 py-0.5 rounded-full", comfortStatus.bg, comfortStatus.text)}>
                                    {comfortStatus.label}
                                </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                                {comfortStatus.desc}
                            </p>
                        </div>
                    </div>

                    {/* 3. HIDDEN COSTS */}
                    <div className="flex items-start gap-3">
                        <div className={cn("mt-1 p-1.5 rounded-full shrink-0", hiddenCostStatus.bg)}>
                            <Luggage className="w-4 h-4 text-gray-600" />
                        </div>
                        <div>
                            <div className="font-semibold text-gray-800 flex items-center gap-2">
                                Hidden Costs
                                <span className={cn("text-xs px-2 py-0.5 rounded-full", hiddenCostStatus.bg, hiddenCostStatus.text)}>
                                    {hiddenCostStatus.label}
                                </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                                {hiddenCostStatus.desc}
                            </p>
                        </div>
                    </div>
                </div>

                {/* LOCK OVERLAY (Only visible if !isPro) */}
                {!isPro && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-[1px] z-10 rounded-b-xl border-t border-dashed border-gray-200">
                        <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-100 text-center max-w-[80%]">
                            <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Lock className="w-5 h-5" />
                            </div>
                            <h4 className="font-bold text-gray-900 mb-1">Unlock Full Analysis</h4>
                            <p className="text-xs text-gray-500 mb-4">
                                Is this layover risky? Is the aircraft comfortable? Are there hidden baggage fees?
                            </p>
                            <Button 
                                size="sm" 
                                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-medium shadow-md"
                                onClick={onUpgrade}
                            >
                                Upgrade to View - $4.99
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Helper to determine status based on score thresholds
function getStatus(score: number, max: number) {
    const percent = (score / max) * 100;
    
    if (percent >= 80) {
        return {
            label: "EXCELLENT",
            color: "text-emerald-600",
            bg: "bg-emerald-50",
            text: "text-emerald-700",
            icon: <CheckCircle className="w-4 h-4 text-emerald-600" />,
            desc: "Highly recommended. Minimal risk, great comfort, and no hidden surprises."
        };
    } else if (percent >= 50) {
        return {
            label: "AVERAGE",
            color: "text-yellow-600",
            bg: "bg-yellow-50",
            text: "text-yellow-700",
            icon: <HelpCircle className="w-4 h-4 text-yellow-600" />,
            desc: "Standard experience. Some trade-offs exist between price and comfort."
        };
    } else {
        return {
            label: "WARNING",
            color: "text-red-600",
            bg: "bg-red-50",
            text: "text-red-700",
            icon: <AlertTriangle className="w-4 h-4 text-red-600" />,
            desc: "Proceed with caution. High risk of disruption or significant discomfort."
        };
    }
}

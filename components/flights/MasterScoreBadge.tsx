"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Lock, Trophy, ShieldCheck, AlertTriangle } from "lucide-react";

interface MasterScoreBadgeProps {
    score: number;
    isPro?: boolean; // Default false (Free user simulation)
    compact?: boolean;
}

export function MasterScoreBadge({ score, isPro = false, compact = false }: MasterScoreBadgeProps) {
    // 1. Determine Color & Label based on Score
    let color = "text-gray-500 bg-gray-100 border-gray-200";
    let icon = <ShieldCheck className="w-4 h-4" />;
    let label = "Unknown";
    
    if (score >= 85) {
        color = "text-emerald-700 bg-emerald-50 border-emerald-200";
        icon = <Trophy className="w-4 h-4" />;
        label = "Exceptional";
    } else if (score >= 70) {
        color = "text-blue-700 bg-blue-50 border-blue-200";
        icon = <ShieldCheck className="w-4 h-4" />;
        label = "Great Choice";
    } else if (score >= 50) {
        color = "text-yellow-700 bg-yellow-50 border-yellow-200";
        icon = <ShieldCheck className="w-4 h-4" />;
        label = "Good Value";
    } else {
        color = "text-red-700 bg-red-50 border-red-200";
        icon = <AlertTriangle className="w-4 h-4" />;
        label = "Risky Option";
    }

    // 2. FREE USER VIEW (Teaser Mode)
    if (!isPro) {
        return (
            <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full border border-dashed relative overflow-hidden group cursor-help transition-all hover:bg-gray-50",
                color,
                compact ? "text-xs" : "text-sm"
            )}>
                {/* Background Pattern */}
                <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px]" />
                
                {/* Blurred Content */}
                <div className="relative flex items-center gap-2 filter blur-[2px] opacity-60">
                    <span className="font-bold">87</span>
                    <span className="text-xs">/ 100</span>
                </div>

                {/* Lock Overlay */}
                <div className="absolute inset-0 flex items-center justify-center gap-1 font-semibold text-xs z-10 text-gray-700">
                    <Lock className="w-3 h-3" />
                    <span>?? / 100</span>
                </div>
            </div>
        );
    }

    // 3. PRO USER VIEW (Full Access)
    return (
        <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-sm transition-all hover:scale-105",
            color,
            compact ? "text-xs" : "text-sm"
        )}>
            {icon}
            <div className="flex flex-col leading-none">
                <span className="font-bold text-base">{score} <span className="text-[10px] opacity-70 font-normal">/100</span></span>
                {!compact && <span className="text-[10px] font-medium uppercase tracking-wider opacity-80">{label}</span>}
            </div>
        </div>
    );
}

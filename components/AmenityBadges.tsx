"use client";

import { useTranslations } from 'next-intl';
import { Plane, Wifi, Utensils, Luggage } from "lucide-react";
import { FlightForScoring } from '@/lib/flightScoreEngine'; // Or generic Flight type
import { getAirlineInfo } from '@/lib/airlineDB';

interface AmenityBadgesProps {
    flight: FlightForScoring;
    compact?: boolean;
}

export function AmenityBadges({ flight, compact = false }: AmenityBadgesProps) {
    const t = useTranslations('FlightSearch');

    // 1. Identify Airline for fallback
    // Use carrier name or code. If MIX, this logic is naturally weak, so we rely on backend flags for MIX.
    const airlineCode = flight.carrier?.split(' ')[0] || 'XX';
    const airlineInfo = getAirlineInfo(airlineCode);

    // 2. Determine Baggage Status
    // Priority: 
    // A) Backend explicit flag "baggageIncluded" (Most accurate, handles Mixed Premium vs LCC)
    // B) Backend explicit weight > 0
    // C) Client-side Fallback for Single Airlines (If API failed and Backend Logic missed it)
    let hasBag = false;

    if (flight.baggageIncluded) {
        hasBag = true;
    } else if ((flight.baggageWeight || 0) > 0) {
        hasBag = true;
    } else if (!flight.isSelfTransfer && airlineInfo.hasFreeBag) {
        // Only trust static DB for single carrier flights. 
        // For MIX (Self-Transfer), we trust the Backend's specific logic (which checks both legs).
        hasBag = true;
    }

    // 3. Other Amenities (Trust DB for now as API doesn't send this often)
    const hasMeal = airlineInfo.hasMeals;
    const hasEntertainment = airlineInfo.hasEntertainment;

    return (
        <div className="flex flex-wrap gap-2 items-center">
            {/* 1. BAGAJ */}
            {hasBag ? (
                <div className={`flex items-center gap-1.5 rounded px-2 py-1 border ${compact ? 'text-[10px]' : 'text-xs'} font-medium bg-emerald-50 text-emerald-700 border-emerald-200`}>
                    <Luggage className="w-3.5 h-3.5" />
                    <span>{t('baggage')} Included</span>
                </div>
            ) : (
                <div className={`flex items-center gap-1.5 rounded px-2 py-1 border ${compact ? 'text-[10px]' : 'text-xs'} font-medium bg-slate-50 text-slate-500 border-slate-200`}>
                    <Luggage className="w-3.5 h-3.5 opacity-50" />
                    <span className="line-through decoration-slate-400">{t('baggageExtras.noBaggage')}</span>
                </div>
            )}

            {/* 2. YEMEK */}
            {hasMeal && (
                <div className={`flex items-center gap-1.5 rounded px-2 py-1 border ${compact ? 'text-[10px]' : 'text-xs'} font-medium bg-blue-50 text-blue-700 border-blue-200`}>
                    <Utensils className="w-3.5 h-3.5" />
                    <span>Meal Included</span>
                </div>
            )}

            {/* 3. EKRAN */}
            {hasEntertainment && !compact && (
                <div className="flex items-center gap-1.5 rounded px-2 py-1 border text-xs font-medium bg-purple-50 text-purple-700 border-purple-200">
                    <Wifi className="w-3.5 h-3.5" />
                    <span>Entertainment</span>
                </div>
            )}
        </div>
    );
}

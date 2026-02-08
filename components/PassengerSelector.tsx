"use client";

import { useState, useRef, useEffect } from "react";
import { Users, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";

interface PassengerSelectorProps {
    adults: number;
    setAdults: (val: number) => void;
    childrenCount: number; // Renamed to avoid React children conflict
    setChildrenCount: (val: number) => void;
    infants: number;
    setInfants: (val: number) => void;
    cabin: "ECONOMY" | "BUSINESS" | "FIRST";
    setCabin: (val: "ECONOMY" | "BUSINESS" | "FIRST") => void;
    variant?: "default" | "ghost";
    className?: string;
}

export function PassengerSelector({
    adults,
    setAdults,
    childrenCount,
    setChildrenCount,
    infants,
    setInfants,
    cabin,
    setCabin,
    variant = "default",
    className
}: PassengerSelectorProps) {
    const t = useTranslations('FlightSearch');
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const totalPassengers = adults + childrenCount + infants;

    const getCabinLabel = (c: string) => {
        switch (c) {
            case "ECONOMY": return t('economy');
            case "BUSINESS": return t('business');
            case "FIRST": return t('firstClass');
            default: return c;
        }
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full h-14 px-4 flex items-center justify-between transition-all text-left rounded-xl
                    ${variant === 'default' ? 'bg-slate-50 border border-slate-200 hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200' : 'bg-transparent hover:bg-slate-50/50'}
                `}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    <Users className="h-5 w-5 text-slate-400 shrink-0" />
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-900 truncate">
                            {totalPassengers} {t('passengers')}
                        </span>
                        <span className="text-xs text-slate-500 truncate">
                            {getCabinLabel(cabin)}
                        </span>
                    </div>
                </div>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Popover Content */}
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 z-50 animate-in fade-in zoom-in-95 min-w-[280px]">
                    {/* Cabin Selection */}
                    <div className="mb-4">
                        <label className="text-xs font-semibold text-slate-500 mb-2 block uppercase tracking-wider">
                            {t('cabin')}
                        </label>
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            {(["ECONOMY", "BUSINESS", "FIRST"] as const).map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setCabin(c)}
                                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${cabin === c
                                        ? "bg-white text-blue-600 shadow-sm"
                                        : "text-slate-500 hover:text-slate-800"
                                        }`}
                                >
                                    {getCabinLabel(c)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="h-px bg-slate-100 my-4" />

                    {/* Passenger Counters */}
                    <div className="space-y-4">
                        {/* Adults */}
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-sm font-semibold text-slate-900">{t('adultLabel')}</div>
                                <div className="text-xs text-slate-500">12+</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setAdults(Math.max(1, adults - 1))}
                                    className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors disabled:opacity-50"
                                    disabled={adults <= 1}
                                >
                                    -
                                </button>
                                <span className="w-4 text-center font-semibold text-slate-900">{adults}</span>
                                <button
                                    type="button"
                                    onClick={() => setAdults(Math.min(9, adults + 1))}
                                    className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors disabled:opacity-50"
                                    disabled={adults >= 9}
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        {/* Children */}
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-sm font-semibold text-slate-900">{t('childLabel')}</div>
                                <div className="text-xs text-slate-500">2-11</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setChildrenCount(Math.max(0, childrenCount - 1))}
                                    className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors disabled:opacity-50"
                                    disabled={childrenCount <= 0}
                                >
                                    -
                                </button>
                                <span className="w-4 text-center font-semibold text-slate-900">{childrenCount}</span>
                                <button
                                    type="button"
                                    onClick={() => setChildrenCount(Math.min(9, childrenCount + 1))}
                                    className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors disabled:opacity-50"
                                    disabled={childrenCount >= 9}
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        {/* Infants */}
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-sm font-semibold text-slate-900">{t('infantLabel')}</div>
                                <div className="text-xs text-slate-500">0-2</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setInfants(Math.max(0, infants - 1))}
                                    className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors disabled:opacity-50"
                                    disabled={infants <= 0}
                                >
                                    -
                                </button>
                                <span className="w-4 text-center font-semibold text-slate-900">{infants}</span>
                                <button
                                    type="button"
                                    onClick={() => setInfants(Math.min(adults, infants + 1))} // Infants usually can't exceed adults
                                    className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors disabled:opacity-50"
                                    disabled={infants >= adults}
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="text-sm font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-4 py-2 rounded-lg transition-colors"
                        >
                            {t('select') || 'Done'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

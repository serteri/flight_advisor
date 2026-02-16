"use client";

import { useState } from "react";
import { TrendingDown, TrendingUp, Zap, SlidersHorizontal } from "lucide-react";

export type SortOption = "best" | "cheapest" | "fastest";

interface FlightSortBarProps {
    onSortChange: (sort: SortOption) => void;
    currentSort: SortOption;
    resultCount: number;
}

export function FlightSortBar({ onSortChange, currentSort, resultCount }: FlightSortBarProps) {
    const options: { value: SortOption; label: string; icon: any; description: string }[] = [
        {
            value: "best",
            label: "Best",
            icon: SlidersHorizontal,
            description: "Optimized balance"
        },
        {
            value: "cheapest",
            label: "Cheapest",
            icon: TrendingDown,
            description: "Lowest price first"
        },
        {
            value: "fastest",
            label: "Fastest",
            icon: Zap,
            description: "Shortest duration"
        }
    ];

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm mb-6">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-sm font-bold text-slate-900">{resultCount} flights sorted by</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Choose your preferred sorting</p>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
                {options.map((option) => {
                    const Icon = option.icon;
                    const isActive = currentSort === option.value;

                    return (
                        <button
                            key={option.value}
                            onClick={() => onSortChange(option.value)}
                            className={`relative p-4 rounded-xl border-2 transition-all ${
                                isActive
                                    ? "border-blue-500 bg-blue-50 shadow-md shadow-blue-100"
                                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                            }`}
                        >
                            <div className="flex flex-col items-center text-center gap-2">
                                <div
                                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                        isActive ? "bg-blue-500" : "bg-slate-100"
                                    }`}
                                >
                                    <Icon
                                        className={`w-5 h-5 ${
                                            isActive ? "text-white" : "text-slate-600"
                                        }`}
                                    />
                                </div>
                                <div>
                                    <div
                                        className={`text-sm font-bold ${
                                            isActive ? "text-blue-900" : "text-slate-900"
                                        }`}
                                    >
                                        {option.label}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-0.5">
                                        {option.description}
                                    </div>
                                </div>
                                {isActive && (
                                    <div className="absolute top-2 right-2">
                                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                    </div>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

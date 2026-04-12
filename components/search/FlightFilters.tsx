"use client";

import { Filter } from "lucide-react";

export type FlightFilterState = {
    airline: string;
    stops: "ALL" | "DIRECT" | "ONE_STOP" | "TWO_PLUS";
    source: "ALL" | "DUFFEL" | "PRICELINE";
};

interface FlightFiltersProps {
    filters: FlightFilterState;
    airlines: string[];
    filteredCount: number;
    totalCount: number;
    onChange: (next: FlightFilterState) => void;
    onReset: () => void;
}

export function FlightFilters({
    filters,
    airlines,
    filteredCount,
    totalCount,
    onChange,
    onReset,
}: FlightFiltersProps) {
    return (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-slate-800">
                    <Filter className="h-4 w-4" />
                    <span className="text-sm font-semibold">Flight Filters</span>
                </div>
                <button
                    type="button"
                    onClick={onReset}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                    Reset
                </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="text-xs font-semibold text-slate-600">
                    Airline
                    <select
                        value={filters.airline}
                        onChange={(e) => onChange({ ...filters, airline: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                    >
                        <option value="ALL">All airlines</option>
                        {airlines.map((airline) => (
                            <option key={airline} value={airline}>
                                {airline}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="text-xs font-semibold text-slate-600">
                    Stops
                    <select
                        value={filters.stops}
                        onChange={(e) => onChange({ ...filters, stops: e.target.value as FlightFilterState["stops"] })}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                    >
                        <option value="ALL">Any</option>
                        <option value="DIRECT">Direct</option>
                        <option value="ONE_STOP">1 stop</option>
                        <option value="TWO_PLUS">2+ stops</option>
                    </select>
                </label>

                <label className="text-xs font-semibold text-slate-600">
                    Data Source
                    <select
                        value={filters.source}
                        onChange={(e) => onChange({ ...filters, source: e.target.value as FlightFilterState["source"] })}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                    >
                        <option value="ALL">All sources</option>
                        <option value="DUFFEL">Duffel</option>
                        <option value="PRICELINE">Priceline</option>
                    </select>
                </label>
            </div>

            <p className="mt-3 text-xs text-slate-500">
                Showing {filteredCount} of {totalCount} flights
            </p>
        </div>
    );
}
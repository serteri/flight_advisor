"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Plane, Building, MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CityResult {
    iataCode: string;
    name: string;
    cityName: string;
    countryName: string;
    type: "CITY" | "AIRPORT";
}

interface CitySearchInputProps {
    name?: string;
    label?: string;
    placeholder?: string;
    defaultValue?: string;
    defaultIataCode?: string;
    error?: string;
    onSelect?: (city: any) => void;
    variant?: "default" | "ghost";
    className?: string;
}

export function CitySearchInput({ name, label, placeholder, defaultValue, defaultIataCode, error, onSelect, variant = "default", className }: CitySearchInputProps) {
    const [query, setQuery] = useState(defaultValue || ""); // Visible text
    const [iataCode, setIataCode] = useState(defaultIataCode || ""); // Actual value
    const [suggestions, setSuggestions] = useState<CityResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Update query if defaultValue changes (e.g. from Geolocation)
    useEffect(() => {
        if (defaultValue && defaultValue !== query) {
            setQuery(defaultValue);
        }
        if (defaultIataCode && defaultIataCode !== iataCode) {
            setIataCode(defaultIataCode);
        }
    }, [defaultValue, defaultIataCode]);

    // Simple debounce effect
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.length < 2) {
                setSuggestions([]);
                return;
            }

            // Don't search if the query matches the selected format to avoid re-searching on selection
            if (query.includes('(') && query.includes(')')) {
                return;
            }

            setLoading(true);
            try {
                const res = await fetch(`/api/city-search?keyword=${query}`);
                const data = await res.json();
                if (data.data) {
                    setSuggestions(data.data);
                }
            } catch (err) {
                console.error("Failed to fetch cities", err);
            } finally {
                setLoading(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [query]);

    // Close suggestions on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (city: CityResult) => {
        // For airports, show the full name with code; for cities, show city name
        const displayText = city.type === 'AIRPORT'
            ? city.name  // Already includes airport name + code from API
            : (city.cityName || city.name);
        setQuery(displayText);
        setIataCode(city.iataCode);
        setShowSuggestions(false);

        // Notify parent component
        onSelect?.({ iata: city.iataCode, name: displayText });
    };

    return (
        <div className="relative" ref={wrapperRef}>
            {/* For default variant, label is outside. For ghost, we handle it inside to allow full-height click */}
            {label && variant === "default" && <label className="text-sm font-bold mb-2 block text-slate-700 uppercase tracking-wider text-xs">{label}</label>}

            <div className="relative group">
                {/* Hidden input for the actual form submission */}
                <input type="hidden" name={name} value={iataCode} />

                {/* Icon - only show for default variant or if specifically desired in ghost (skipping for ghost to keep clean text look) */}
                {variant === "default" && (
                    <div className="flex items-center absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10 pointer-events-none">
                        <MapPin size={18} />
                    </div>
                )}

                <div className={cn(
                    "relative transition-all duration-200",
                    variant === "default" && "flex items-center bg-white rounded-lg border-2 border-slate-200 hover:border-blue-400 focus-within:border-blue-600 focus-within:ring-4 focus-within:ring-blue-100",
                    variant === "ghost" && "flex flex-col justify-center px-4 md:px-6 h-full cursor-text hover:bg-slate-100/80 rounded-lg", // Hover effect handled by parent or here
                    error ? "border-red-500 bg-red-50" : "",
                    className
                )}
                    onClick={() => {
                        // Focus the input when clicking the container (mostly for ghost mode user experience)
                        const input = wrapperRef.current?.querySelector('input[type="text"]') as HTMLInputElement;
                        if (input) input.focus();
                    }}
                >
                    {/* Ghost Variant Label */}
                    {variant === "ghost" && label && (
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5 select-none">
                            {label}
                        </div>
                    )}

                    <Input
                        name={`${name}_search`} // distinct visible name
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setShowSuggestions(true);
                            if (e.target.value === "") {
                                setIataCode("");
                            }
                        }}
                        onFocus={() => {
                            if (suggestions.length > 0) setShowSuggestions(true);
                        }}
                        onBlur={() => {
                            setTimeout(() => {
                                if (query && !iataCode && suggestions.length > 0) {
                                    handleSelect(suggestions[0]);
                                } else if (!query) {
                                    setIataCode("");
                                }
                                setShowSuggestions(false);
                            }, 200);
                        }}
                        placeholder={variant === "ghost" ? "" : placeholder} // Hide placeholder in ghost mode as label serves that purpose usually, or keep if empty
                        className={cn(
                            "border-0 bg-transparent focus-visible:ring-0 p-0 shadow-none file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                            variant === "default" && "h-14 pl-12 text-lg font-semibold text-slate-800",
                            variant === "ghost" && "h-auto text-xl md:text-2xl font-black text-slate-900 placeholder:text-slate-300 truncate leading-none"
                        )}
                        autoComplete="off"
                    />

                    {loading && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                        </div>
                    )}
                </div>
            </div>

            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-slate-100 rounded-xl shadow-2xl max-h-80 overflow-y-auto overflow-x-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="py-2">
                        {suggestions.map((city, index) => (
                            <button
                                key={`${city.iataCode}-${city.type}-${index}`}
                                type="button"
                                onClick={() => handleSelect(city)}
                                className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-slate-50 last:border-0 flex items-center justify-between group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-full ${city.type === 'AIRPORT' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                        {city.type === 'AIRPORT' ? <Plane size={18} /> : <Building size={18} />}
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-800 text-base">{city.name}</div>
                                        <div className="text-xs text-slate-500 font-medium">{city.countryName}</div>
                                    </div>
                                </div>
                                {city.type === 'AIRPORT' && (
                                    <div className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded">
                                        {city.iataCode}
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {error && (
                <p className="text-red-500 text-sm mt-1.5 flex items-center gap-1 font-medium animate-in slide-in-from-top-1">
                    <MapPin size={14} /> {error}
                </p>
            )}
        </div>
    );
}

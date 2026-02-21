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
    displayName: string; // New field from API
    detailName: string; // New field from API
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
            // Don't search if query is very short or looks like a completed selection "City (Code)"
            if (query.length < 2 || (query.includes('(') && query.includes(')'))) {
                if (query.length < 2) setSuggestions([]);
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
        }, 300); // Faster debounce for snappy feel

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
        // New Format: "Istanbul (Sabiha Gokcen) - SAW"
        // Using: City (AirportName) - IATA
        const airportName = (city as any).airportName || city.name || city.iataCode;
        const displayText = `${city.displayName || city.cityName} (${airportName}) - ${city.iataCode}`;

        setQuery(displayText);
        setIataCode(city.iataCode);
        setShowSuggestions(false);

        // Notify parent component
        onSelect?.({ iata: city.iataCode, name: displayText });
    };

    return (
        <div className="relative" ref={wrapperRef}>
            {/* For default variant, label is outside. For ghost, we handle it inside. */}
            {label && variant === "default" && <label className="text-sm font-bold mb-2 block text-slate-700 uppercase tracking-wider text-xs">{label}</label>}

            <div className="relative group">
                <input type="hidden" name={name} value={iataCode} />

                {/* Icon - only show for default variant */}
                {variant === "default" && (
                    <div className="flex items-center absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10 pointer-events-none">
                        <MapPin size={18} />
                    </div>
                )}

                <div className={cn(
                    "relative transition-all duration-200",
                    variant === "default" && "flex items-center bg-white rounded-lg border-2 border-slate-200 hover:border-blue-400 focus-within:border-blue-600 focus-within:ring-4 focus-within:ring-blue-100",
                    variant === "ghost" && "flex flex-col justify-center px-4 md:px-6 h-full cursor-text hover:bg-slate-100/80 rounded-lg",
                    error ? "border-red-500 bg-red-50" : "",
                    className
                )}
                    onClick={() => {
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
                        name={`${name}_search`}
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
                            // Small delay to allow click on suggestion to register
                            setTimeout(() => {
                                // If user leaves field without selecting, we could auto-select top result OR clear. 
                                // For now, let's keep it lenient.
                                setShowSuggestions(false);
                            }, 200);
                        }}
                        placeholder={variant === "ghost" ? "" : placeholder}
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

            {/* DROPDOWN SUGGESTIONS */}
            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 left-0 top-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-[400px] overflow-y-auto overflow-x-hidden animate-in fade-in zoom-in-95 duration-150 min-w-[350px] w-full md:w-[150%]">
                    <div className="py-2">
                        {suggestions.map((city, index) => (
                            <button
                                key={`${city.iataCode}-${city.type}-${index}`}
                                type="button"
                                onClick={() => handleSelect(city)}
                                className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 flex items-center justify-between group"
                            >
                                <div className="flex items-center gap-4 overflow-hidden">
                                    {/* Icon Box */}
                                    <div className={`p-2.5 rounded-lg flex-shrink-0 ${city.type === 'AIRPORT' ? 'bg-slate-100 text-slate-600' : 'bg-blue-100 text-blue-600'}`}>
                                        {city.type === 'AIRPORT' ? <Plane size={20} strokeWidth={2} /> : <Building size={20} strokeWidth={2} />}
                                    </div>

                                    {/* Text Info */}
                                    <div className="flex flex-col min-w-0">
                                        {/* Main Line: City Name */}
                                        <div className="font-bold text-slate-900 text-base truncate pr-2">
                                            {city.displayName || city.cityName}
                                        </div>
                                        {/* Sub Line: Airport Name + Country */}
                                        <div className="text-sm text-slate-500 truncate">
                                            {(city as any).airportName && city.detailName 
                                                ? `${(city as any).airportName}, ${city.detailName}`
                                                : (city as any).airportName || city.detailName || 'Airport'
                                            }
                                        </div>
                                    </div>
                                </div>

                                {/* IATA Code Box */}
                                <div className="ml-4 flex-shrink-0">
                                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md group-hover:bg-slate-200 transition-colors">
                                        {city.iataCode}
                                    </span>
                                </div>
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

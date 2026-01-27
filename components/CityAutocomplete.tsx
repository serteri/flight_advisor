"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";

interface AutocompleteResult {
    city: string;
    iata: string;
    country: string;
    type: "CITY" | "AIRPORT";
    name: string;
}

interface CityAutocompleteProps {
    name: string;
    label: string;
    placeholder?: string;
    defaultValue?: string;
    defaultIataCode?: string;
    error?: string;
    onSelect?: (city: string, iata: string) => void;
}

export function CityAutocomplete({
    name,
    label,
    placeholder = "Şehir adı...",
    defaultValue = "",
    defaultIataCode = "",
    error,
    onSelect,
}: CityAutocompleteProps) {
    // Initialize with empty string never undefined (prevents controlled→uncontrolled warning)
    const [input, setInput] = useState(defaultValue || "");
    const [selectedIata, setSelectedIata] = useState(defaultIataCode || "");
    const [suggestions, setSuggestions] = useState<AutocompleteResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [isLocked, setIsLocked] = useState(false); // Lock after selection to prevent reopening
    const wrapperRef = useRef<HTMLDivElement>(null);
    const initializedRef = useRef(false);

    // Sync with defaultValue when it changes (e.g. from geolocation detection)
    useEffect(() => {
        if (defaultValue && !initializedRef.current) {
            setInput(defaultValue);
            initializedRef.current = true;
        }
    }, [defaultValue]);

    useEffect(() => {
        if (defaultIataCode && !selectedIata) {
            setSelectedIata(defaultIataCode);
        }
    }, [defaultIataCode, selectedIata]);

    // Debounced autocomplete fetch
    useEffect(() => {
        // Don't fetch if locked (already selected)
        if (isLocked) {
            return;
        }

        if (!input || input.length < 2) {
            setSuggestions([]);
            setShowDropdown(false);
            return;
        }

        const controller = new AbortController();
        setLoading(true);

        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/autocomplete?q=${encodeURIComponent(input)}`, {
                    signal: controller.signal
                });

                if (!res.ok) throw new Error("Fetch failed");

                const data = await res.json();

                if (data && Array.isArray(data)) {
                    // API returns array directly now
                    setSuggestions(data);
                    setShowDropdown(data.length > 0);
                } else if (data.results && Array.isArray(data.results)) {
                    // Fallback for old structure
                    setSuggestions(data.results);
                    setShowDropdown(data.results.length > 0);
                }
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.error('[CityAutocomplete] Failed to fetch suggestions:', err);
                    setSuggestions([]);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }, 300);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [input, isLocked]);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    function handleSelect(result: AutocompleteResult) {
        setInput(result.city || "");
        setSelectedIata(result.iata || "");
        setShowDropdown(false);
        setIsLocked(true); // Lock to prevent reopening
        onSelect?.(result.city, result.iata);
    }

    function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
        const newValue = e.target.value;
        setInput(newValue);
        // Unlock if user starts typing again
        if (isLocked && newValue !== input) {
            setIsLocked(false);
        }
    }

    return (
        <div className="relative" ref={wrapperRef}>
            <label className="text-sm font-semibold mb-2 block text-slate-700">
                {label}
            </label>

            <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                    type="text"
                    value={input}
                    onChange={handleInputChange}
                    placeholder={placeholder}
                    className={`h-12 pl-10 pr-10 ${error ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                />
                {loading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-600 animate-spin" />
                )}
            </div>

            {/* Hidden input for form submission (IATA code) */}
            <input type="hidden" name={name} value={selectedIata || ""} />

            {error && (
                <p className="text-sm text-red-600 mt-1">{error}</p>
            )}

            {/* Dropdown suggestions - Skyscanner style */}
            {showDropdown && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-80 overflow-y-auto">
                    {suggestions.map((result, idx) => (
                        <button
                            type="button"
                            key={`${result.iata}-${idx}`}
                            onClick={() => handleSelect(result)}
                            className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-slate-100 last:border-b-0 transition-colors focus:bg-blue-50 focus:outline-none"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <div className="font-semibold text-slate-900">
                                        {result.city} ({result.iata})
                                    </div>
                                    <div className="text-sm text-slate-500 mt-0.5">
                                        {result.name}
                                    </div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

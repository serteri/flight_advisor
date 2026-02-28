/**
 * Smart City Autocomplete Component
 * 
 * Skyscanner-style smooth UX with:
 * - Geolocation detection ("Current Location")
 * - City/airport autocomplete
 * - Validation
 * - Smooth animations
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2, X, CheckCircle2 } from 'lucide-react';
import { 
    getUserGeolocation, 
    tryGetMemoizedGeolocation,
    formatGeolocationForDisplay,
    type GeolocationResult 
} from '@/lib/geolocationService';

// List of major international hubs
const MAJOR_AIRPORT_CODES = new Set([
    'LHR', 'CDG', 'AMS', 'FRA', 'DXB', 'IST', 'SIN', 'HND', 'JAL', 'LAX',
    'JFK', 'ORD', 'DFW', 'DEN', 'ATL', 'IAD', 'RDU', 'MIA', 'SFO', 'SEA',
    'LAS', 'PHX', 'SYD', 'MEL', 'NRT', 'ICN', 'PVG', 'PEK', 'HKG', 'BKK',
    'CGK', 'DEL', 'BOM', 'SYD', 'FCO', 'VCE', 'MAD', 'BCN', 'ZRH', 'VIE',
    'PRG', 'WAS', 'BOS', 'PHL', 'DTW', 'MSP', 'DES', 'PIT', 'CLE', 'TPA'
]);

interface SmartCitySearchProps {
    placeholder?: string;
    value: string;
    iataCode: string;
    onChange: (city: string, iata: string) => void;
    isDestination?: boolean;
    disabled?: boolean;
    className?: string;
}

interface CityOption {
    city: string;
    iata: string;
    country: string;
    isMajor?: boolean;
}

let originAutofillInitialized = false;
const ORIGIN_AUTOFILL_SESSION_KEY = 'smartCitySearch.origin.autofill.initialized';

export function SmartCitySearch({
    placeholder = 'From',
    value,
    iataCode,
    onChange,
    isDestination = false,
    disabled = false,
    className = ''
}: SmartCitySearchProps) {
    const [inputValue, setInputValue] = useState(value);
    const [suggestions, setSuggestions] = useState<CityOption[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [loading, setLoading] = useState(false);
    const [geoLocation, setGeoLocation] = useState<GeolocationResult | null>(null);
    const [geoLoading, setGeoLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);
    const onChangeRef = useRef(onChange);

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    // Try to get geolocation on mount (for origin field)
    useEffect(() => {
        if (isDestination) {
            return;
        }

        if (originAutofillInitialized) {
            return;
        }

        if (typeof window !== 'undefined') {
            const alreadyInitializedInSession = sessionStorage.getItem(ORIGIN_AUTOFILL_SESSION_KEY) === '1';
            if (alreadyInitializedInSession) {
                originAutofillInitialized = true;
                return;
            }
        }

        if (value && iataCode) {
            originAutofillInitialized = true;
            if (typeof window !== 'undefined') {
                sessionStorage.setItem(ORIGIN_AUTOFILL_SESSION_KEY, '1');
            }
            return;
        }

        const bootstrapOrigin = async () => {
            try {
                const lastOrigin = localStorage.getItem('lastFlightOrigin');
                const lastOriginIata = localStorage.getItem('lastFlightOriginIata');

                if (lastOrigin && lastOriginIata) {
                    setInputValue(lastOrigin);
                    if (lastOrigin !== value || lastOriginIata !== iataCode) {
                        onChangeRef.current(lastOrigin, lastOriginIata);
                    }
                    return;
                }

                const result = await tryGetMemoizedGeolocation();
                if (result && !('error' in result) && result.city && result.iataCode) {
                    setInputValue(result.city);
                    onChangeRef.current(result.city, result.iataCode);
                    localStorage.setItem('lastFlightOrigin', result.city);
                    localStorage.setItem('lastFlightOriginIata', result.iataCode);
                    setGeoLocation(result);
                }
            } catch {
                // no-op: silent fallback for bootstrap
            } finally {
                originAutofillInitialized = true;
                if (typeof window !== 'undefined') {
                    sessionStorage.setItem(ORIGIN_AUTOFILL_SESSION_KEY, '1');
                }
            }
        };

        void bootstrapOrigin();
    }, [isDestination, value, iataCode]);

    useEffect(() => {
        setInputValue(value);
    }, [value]);

    // Handle input changes and suggest cities
    const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInputValue(val);

        if (val.length < 2) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        setLoading(true);
        try {
            // Call API endpoint instead of client-side search
            const response = await fetch(`/api/airports/search?q=${encodeURIComponent(val)}`);
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const results = await response.json();
            
            if (!Array.isArray(results)) {
                setSuggestions([]);
                setShowSuggestions(true);
                return;
            }
            
            // Sort: major airports first
            const sorted = results.sort((a: CityOption, b: CityOption) => {
                const aMajor = MAJOR_AIRPORT_CODES.has(a.iata.toUpperCase()) ? 1 : 0;
                const bMajor = MAJOR_AIRPORT_CODES.has(b.iata.toUpperCase()) ? 1 : 0;
                return bMajor - aMajor;
            });

            setSuggestions(sorted);
            setShowSuggestions(true);
        } catch (error) {
            console.error('[SmartCitySearch] Search error:', error);
            setSuggestions([]);
            setShowSuggestions(true);
        } finally {
            setLoading(false);
        }
    };

    // Handle city selection
    const handleSelectCity = (city: CityOption) => {
        setInputValue(city.city);
        onChange(city.city, city.iata);
        
        // Save to localStorage (remember last search)
        if (!isDestination) {
            localStorage.setItem('lastFlightOrigin', city.city);
            localStorage.setItem('lastFlightOriginIata', city.iata);
        }
        
        setShowSuggestions(false);
        setSuggestions([]);
    };

    // Handle geolocation click
    const handleUseCurrentLocation = async () => {
        if (!isDestination) {
            setGeoLoading(true);
            const result = await getUserGeolocation(8000);
            
            if (result && !('error' in result) && result.city && result.iataCode) {
                setInputValue(result.city);
                onChange(result.city, result.iataCode);
                setGeoLocation(result);
                setShowSuggestions(false);
            }
            setGeoLoading(false);
        }
    };

    // Close suggestions on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                suggestionsRef.current &&
                !suggestionsRef.current.contains(e.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(e.target as Node)
            ) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Clear input
    const handleClear = () => {
        setInputValue('');
        onChange('', '');
        setSuggestions([]);
        setShowSuggestions(false);
        inputRef.current?.focus();
    };

    return (
        <div className={`relative w-full ${className}`}>
            {/* Input Container */}
            <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <MapPin className="w-5 h-5" />
                </div>

                <input
                    ref={inputRef}
                    type="text"
                    placeholder={placeholder}
                    value={inputValue}
                    onChange={handleInputChange}
                    onFocus={() => inputValue.length >= 2 && setShowSuggestions(true)}
                    disabled={disabled}
                    className={`
                        w-full h-14 pl-12 pr-12 rounded-xl
                        border-2 border-slate-200 
                        focus:border-blue-500 focus:ring-2 focus:ring-blue-200
                        font-medium text-slate-900
                        placeholder:text-slate-400
                        transition-all duration-200
                        ${disabled ? 'bg-slate-50 cursor-not-allowed opacity-50' : 'bg-white'}
                    `}
                />

                {/* Right icons (loading, clear, geo) */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {/* Valid selection indicator */}
                    {iataCode && !loading && (
                        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                    )}

                    {/* Loading indicator */}
                    {loading && (
                        <Loader2 className="w-5 h-5 text-blue-500 animate-spin flex-shrink-0" />
                    )}

                    {/* Clear button */}
                    {inputValue && !loading && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
                        </button>
                    )}

                    {/* Geo button (origin only) */}
                    {!isDestination && !inputValue && !geoLoading && (
                        <button
                            type="button"
                            onClick={handleUseCurrentLocation}
                            className="p-1 hover:bg-blue-50 rounded-lg transition-colors text-blue-600 hover:text-blue-700"
                            title="Use current location"
                        >
                            <MapPin className="w-5 h-5" />
                        </button>
                    )}

                    {/* Geo loading */}
                    {geoLoading && (
                        <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                    )}
                </div>
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
                <div
                    ref={suggestionsRef}
                    className={`
                        absolute top-full left-0 right-0 mt-2 z-50
                        bg-white rounded-xl shadow-lg border border-slate-200
                        overflow-hidden
                        animate-in fade-in slide-in-from-top-2 duration-200
                    `}
                >
                    {/* Major airports section */}
                    {suggestions.filter(s => s.isMajor).length > 0 && (
                        <>
                            <div className="px-4 py-2 text-xs font-bold uppercase text-slate-500 bg-slate-50">
                                Popular Airports
                            </div>
                            {suggestions.filter(s => s.isMajor).map((city) => (
                                <button
                                    key={`${city.iata}-major`}
                                    type="button"
                                    onClick={() => handleSelectCity(city)}
                                    className={`
                                        w-full px-4 py-3 text-left
                                        hover:bg-blue-50 transition-colors
                                        border-b border-slate-100 last:border-0
                                        ${iataCode === city.iata ? 'bg-blue-100' : ''}
                                    `}
                                >
                                    <div className="font-semibold text-slate-900">{city.city}</div>
                                    <div className="text-sm text-slate-500">
                                        {city.iata} • {city.country}
                                    </div>
                                </button>
                            ))}
                        </>
                    )}

                    {/* Other airports section */}
                    {suggestions.filter(s => !s.isMajor).length > 0 && (
                        <>
                            {suggestions.filter(s => s.isMajor).length > 0 && (
                                <div className="px-4 py-2 text-xs font-bold uppercase text-slate-500 bg-slate-50">
                                    Other Airports
                                </div>
                            )}
                            {suggestions.filter(s => !s.isMajor).map((city) => (
                                <button
                                    key={`${city.iata}-other`}
                                    type="button"
                                    onClick={() => handleSelectCity(city)}
                                    className={`
                                        w-full px-4 py-2 text-left
                                        hover:bg-slate-50 transition-colors
                                        border-b border-slate-100 last:border-0
                                        ${iataCode === city.iata ? 'bg-blue-100' : ''}
                                    `}
                                >
                                    <div className="font-medium text-slate-900 text-sm">
                                        {city.city} ({city.iata})
                                    </div>
                                    <div className="text-xs text-slate-400">{city.country}</div>
                                </button>
                            ))}
                        </>
                    )}
                </div>
            )}

            {/* Current Location Suggestion (when geo available) */}
            {!isDestination && geoLocation && !inputValue && showSuggestions && suggestions.length === 0 && (
                <div className={`
                    absolute top-full left-0 right-0 mt-2 z-50
                    bg-white rounded-xl shadow-lg border border-slate-200
                    overflow-hidden
                    animate-in fade-in slide-in-from-top-2 duration-200
                `}>
                    <button
                        type="button"
                        onClick={() => handleSelectCity({
                            city: geoLocation.city || '',
                            iata: geoLocation.iataCode || '',
                            country: geoLocation.country || ''
                        })}
                        className="w-full px-4 py-4 text-left hover:bg-blue-50 transition-colors flex items-center gap-3"
                    >
                        <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <div>
                            <div className="font-semibold text-slate-900">
                                Current Location
                            </div>
                            <div className="text-sm text-slate-500">
                                {formatGeolocationForDisplay(geoLocation)}
                                {geoLocation.confidence === 'high' && ' ✓'}
                            </div>
                        </div>
                    </button>
                </div>
            )}

            {/* No results message */}
            {showSuggestions && !loading && suggestions.length === 0 && inputValue.length >= 2 && (
                <div className={`
                    absolute top-full left-0 right-0 mt-2 z-50
                    bg-white rounded-xl shadow-lg border border-slate-200
                    px-4 py-4 text-center text-slate-500
                    animate-in fade-in slide-in-from-top-2 duration-200
                `}>
                    <p className="text-sm">No airports found for "{inputValue}"</p>
                </div>
            )}
        </div>
    );
}


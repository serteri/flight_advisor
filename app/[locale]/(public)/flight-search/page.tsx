"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CityAutocomplete } from "@/components/CityAutocomplete";
import { DatePicker } from "@/components/DatePicker";
import {
    Plane,
    Loader2,
    Users,
    Clock,
    ArrowRight,
    ArrowRightLeft,
    ChevronDown,
    ChevronUp,
    MapPin,
    Sparkles,
    Check,
    Star,
    CheckCircle2,
    AlertTriangle
} from "lucide-react";
import { useTranslations, useLocale } from 'next-intl';
import { BaggageBadge } from "@/components/BaggageBadge";
import { PriceInsightCard } from "@/components/PriceInsightCard";
import { getLayoverGuide } from "@/lib/airportGuide";
import { TrackButton } from "@/components/TrackButton";
import { FlightCard } from "@/components/FlightCard";
// import type { AnalysisResult, TranslatableText } from "@/lib/flightConsultant";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
    type ScoredFlight,
    type FlightSegment
} from "@/lib/flightScoreEngine";

// Remove local interfaces that are now imported
// Note: ScoredFlight from engine includes segments and baggageStatus


interface FlightGroup {
    id: string;
    mainFlight: ScoredFlight;
    options: ScoredFlight[];
    totalOptions: number;
    cheapestPrice: number;
}

// Popular destinations for quick selection
const popularDestinations = [
    { city: "Istanbul", iata: "IST", country: "Turkey" },
    { city: "London", iata: "LHR", country: "UK" },
    { city: "Paris", iata: "CDG", country: "France" },
    { city: "New York", iata: "JFK", country: "USA" },
    { city: "Dubai", iata: "DXB", country: "UAE" },
    { city: "Tokyo", iata: "NRT", country: "Japan" },
];

export default function SkyscannerSearchPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading...</div>}>
            <SearchPageContent />
        </Suspense>
    );
}

function SearchPageContent() {
    const t = useTranslations('FlightSearch');
    const tConsultant = useTranslations();
    const locale = useLocale() as "en" | "tr" | "de";
    const [loading, setLoading] = useState(false);
    const [tripType, setTripType] = useState<"oneWay" | "roundTrip">("oneWay");
    const [results, setResults] = useState<FlightGroup[]>([]);
    const [sortBy, setSortBy] = useState<"score" | "price" | "duration">("score");
    const [error, setError] = useState<string | null>(null);
    const [expandedFlightId, setExpandedFlightId] = useState<string | null>(null);

    // Form state
    const [fromCity, setFromCity] = useState("");
    const [fromIata, setFromIata] = useState("");
    const [toCity, setToCity] = useState("");
    const [toIata, setToIata] = useState("");
    const [departureDate, setDepartureDate] = useState("");
    const [returnDate, setReturnDate] = useState("");
    const [adults, setAdults] = useState(1);
    const [children, setChildren] = useState(0);
    const [infants, setInfants] = useState(0);
    const [cabin, setCabin] = useState<"ECONOMY" | "BUSINESS" | "FIRST">("ECONOMY");

    // Swap cities function
    const swapCities = () => {
        const tempCity = fromCity;
        const tempIata = fromIata;
        setFromCity(toCity);
        setFromIata(toIata);
        setToCity(tempCity);
        setToIata(tempIata);
    };

    // URL params handling
    const searchParams = useSearchParams();

    // Initial load from URL or Cache
    useEffect(() => {
        const urlOrigin = searchParams.get('origin');
        const urlDestination = searchParams.get('destination');
        const urlDate = searchParams.get('date');
        const urlAdults = searchParams.get('adults');
        const urlChildren = searchParams.get('children');
        const urlInfants = searchParams.get('infants');
        const urlCabin = searchParams.get('cabin');

        // CACHE LOGIC
        const CACHE_KEY = 'flightai_user_location';
        const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

        // 1. Priority: URL Params
        if (urlOrigin && urlDestination && urlDate) {
            setFromIata(urlOrigin);
            setToIata(urlDestination);
            setDepartureDate(urlDate);
            if (urlAdults) setAdults(parseInt(urlAdults));
            if (urlChildren) setChildren(parseInt(urlChildren));
            if (urlInfants) setInfants(parseInt(urlInfants));
            if (urlCabin) setCabin(urlCabin as any);

            // Fetch cities names for UI (optional, but good for UX)
            // For now, we rely on the IATA codes which is fine or we can fetch details.
            // Let's create a quick helper to fetch city name if we only have IATA
            fetchCityName(urlOrigin).then(name => setFromCity(name || urlOrigin));
            fetchCityName(urlDestination).then(name => setToCity(name || urlDestination));

            // TRIGGER SEARCH AUTOMATICALLY
            triggerSearch(urlOrigin, urlDestination, urlDate, urlAdults, urlChildren, urlInfants, urlCabin);
            return;
        }

        // 2. Fallback: Cache or Geo detection (only if no URL params)
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            try {
                const { city, iata, timestamp } = JSON.parse(cached);
                const isExpired = Date.now() - timestamp > CACHE_EXPIRY_MS;
                if (!isExpired && city && iata) {
                    setFromCity(city);
                    setFromIata(iata);
                    return;
                }
            } catch (e) {
                localStorage.removeItem(CACHE_KEY);
            }
        }

        async function detectCity() {
            // ... (existing geo detection logic)
            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition(
                    async (position) => {
                        const { latitude, longitude } = position.coords;
                        try {
                            const res = await fetch(`/api/geo/detect?lat=${latitude}&lon=${longitude}`);
                            const data = await res.json();
                            if (data.city) {
                                const autocompleteRes = await fetch(`/api/autocomplete?q=${encodeURIComponent(data.city)}`);
                                const autocompleteData = await autocompleteRes.json();
                                if (autocompleteData?.[0]) {
                                    setFromCity(autocompleteData[0].city);
                                    setFromIata(autocompleteData[0].iata);
                                    saveToCache(autocompleteData[0].city, autocompleteData[0].iata);
                                }
                            }
                        } catch (err) {
                            console.error('[Auto-detect] Browser geo failed:', err);
                            fallbackToIp();
                        }
                    },
                    () => fallbackToIp()
                );
            } else {
                fallbackToIp();
            }
        }

        async function fallbackToIp() {
            try {
                const res = await fetch('/api/geo/detect');
                const data = await res.json();
                if (data.city) {
                    const autocompleteRes = await fetch(`/api/autocomplete?q=${encodeURIComponent(data.city)}`);
                    const autocompleteData = await autocompleteRes.json();
                    if (autocompleteData?.[0]) {
                        setFromCity(autocompleteData[0].city);
                        setFromIata(autocompleteData[0].iata);
                        saveToCache(autocompleteData[0].city, autocompleteData[0].iata);
                    }
                }
            } catch (err) {
                console.error('[Auto-detect] IP fallback failed:', err);
            }
        }

        async function saveToCache(city: string, iata: string) {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ city, iata, timestamp: Date.now() }));
        }

        detectCity();
    }, [searchParams]);

    // Helper to fetch city name by IATA (simple version)
    const fetchCityName = async (iata: string) => {
        try {
            // This is a bit of a hack, we use the autocomplete API with the IATA code
            // Ideally we should have a `api/city-details?iata=XYZ` endpoint
            const res = await fetch(`/api/autocomplete?q=${iata}`);
            const data = await res.json();
            if (data && data.length > 0) {
                return data[0].city;
            }
            return iata;
        } catch {
            return iata;
        }
    };

    const triggerSearch = async (origin: string, destination: string, date: string, ad?: string | null, ch?: string | null, in_?: string | null, cab?: string | null) => {
        setLoading(true);
        setError(null);
        setResults([]);

        try {
            const res = await fetch('/api/searchFlights', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from: origin,
                    to: destination,
                    departureDate: date,
                    returnDate: undefined, // pending URL support
                    adults: ad ? parseInt(ad) : 1,
                    children: ch ? parseInt(ch) : 0,
                    infants: in_ ? parseInt(in_) : 0,
                    cabin: cab || "ECONOMY",
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || t('error'));
            }

            if (data.results && data.results.length > 0) {
                setResults(data.results);
            } else {
                setError(t('noFlights'));
            }
        } catch (err) {
            console.error('[Search] Error:', err);
            setError(err instanceof Error ? err.message : t('errors.generic'));
        } finally {
            setLoading(false);
        }
    };

    async function handleSearch(e: React.FormEvent) {
        e.preventDefault();

        if (!fromIata || !toIata || !departureDate) {
            setError(t('fillAllFields'));
            return;
        }

        setLoading(true);
        setError(null);
        setResults([]);

        try {
            const res = await fetch('/api/searchFlights', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from: fromIata,
                    to: toIata,
                    departureDate,
                    returnDate: tripType === "roundTrip" ? returnDate : undefined,
                    adults,
                    children,
                    infants,
                    cabin,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || t('error'));
            }

            if (data.results && data.results.length > 0) {
                setResults(data.results); // Now expects FlightGroup[]
            } else {
                setError(t('noFlights'));
            }
        } catch (err) {
            console.error('[Search] Error:', err);
            setError(err instanceof Error ? err.message : t('errors.generic'));
        } finally {
            setLoading(false);
        }
    }

    const [visibleCount, setVisibleCount] = useState(15);

    // Reset pagination when results change
    useEffect(() => {
        setVisibleCount(15);
    }, [results]);

    const formattedDuration = (mins: number) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${h}h ${m}m`;
    };

    const formattedTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    };

    const sortedResults = [...results].sort((a, b) => {
        if (sortBy === "price") return a.cheapestPrice - b.cheapestPrice; // Sort by cheapest option in group
        if (sortBy === "duration") return a.mainFlight.duration - b.mainFlight.duration;
        return (b.mainFlight.score || 0) - (a.mainFlight.score || 0);
    });

    const visibleResults = sortedResults.slice(0, visibleCount);

    const handleLoadMore = () => {
        setVisibleCount(prev => prev + 15);
    };

    const getScoreColor = (score: number) => {
        if (score >= 8) return "bg-emerald-500";
        if (score >= 6) return "bg-blue-500";
        if (score >= 4) return "bg-amber-500";
        return "bg-red-500";
    };

    const selectDestination = (dest: typeof popularDestinations[0]) => {
        setToCity(dest.city);
        setToIata(dest.iata);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
            {/* Hero Section with Search */}
            <div className="relative">
                {/* Background Pattern */}
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />

                <div className="container mx-auto px-4 py-12 max-w-6xl relative">
                    {/* Header */}
                    <div className="text-center mb-10">
                        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 flex items-center justify-center gap-4">
                            <div className="p-3 bg-blue-500/20 rounded-2xl">
                                <Plane className="text-blue-400 h-10 w-10" />
                            </div>
                            {t('heroTitle')}
                        </h1>
                        <p className="text-blue-200/80 text-lg max-w-2xl mx-auto">
                            {t('heroSubtitle')}
                        </p>
                    </div>

                    {/* Search Card */}
                    <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-6 md:p-8 border border-white/20">
                        <form onSubmit={handleSearch} className="space-y-6">
                            {/* Trip Type Toggle */}
                            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
                                <button
                                    type="button"
                                    onClick={() => setTripType("oneWay")}
                                    className={`px-5 py-2.5 rounded-lg font-medium transition-all text-sm ${tripType === "oneWay"
                                        ? "bg-white text-blue-600 shadow-md"
                                        : "text-slate-600 hover:text-slate-900"
                                        }`}
                                >
                                    {t('oneWay')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTripType("roundTrip")}
                                    className={`px-5 py-2.5 rounded-lg font-medium transition-all text-sm ${tripType === "roundTrip"
                                        ? "bg-white text-blue-600 shadow-md"
                                        : "text-slate-600 hover:text-slate-900"
                                        }`}
                                >
                                    {t('roundTrip')}
                                </button>
                            </div>

                            {/* From & To with Swap Button */}
                            <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-end">
                                <CityAutocomplete
                                    name="from"
                                    label={t('from')}
                                    placeholder={t('placeholder')}
                                    defaultValue={fromCity}
                                    defaultIataCode={fromIata}
                                    onSelect={(city, iata) => {
                                        setFromCity(city);
                                        setFromIata(iata);
                                    }}
                                />

                                {/* Swap Button */}
                                <button
                                    type="button"
                                    onClick={swapCities}
                                    className="hidden md:flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 transition-all hover:scale-110 active:scale-95 mb-0.5"
                                    title="Swap cities"
                                >
                                    <ArrowRightLeft className="h-5 w-5" />
                                </button>

                                <CityAutocomplete
                                    name="to"
                                    label={t('to')}
                                    placeholder={t('placeholder')}
                                    defaultValue={toCity}
                                    defaultIataCode={toIata}
                                    onSelect={(city, iata) => {
                                        setToCity(city);
                                        setToIata(iata);
                                    }}
                                />
                            </div>

                            {/* Mobile Swap Button */}
                            <div className="md:hidden flex justify-center -mt-2">
                                <button
                                    type="button"
                                    onClick={swapCities}
                                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm font-medium transition-all"
                                >
                                    <ArrowRightLeft className="h-4 w-4" />
                                    Swap
                                </button>
                            </div>

                            {/* Dates */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <DatePicker
                                    label={t('departureDate')}
                                    placeholder={t('selectDate') || "Select date"}
                                    value={departureDate}
                                    onChange={(date) => setDepartureDate(date)}
                                    minDate={new Date()}
                                    locale={locale}
                                    disabled={false}
                                />
                                <DatePicker
                                    label={t('returnDate')}
                                    placeholder={t('selectDate') || "Select date"}
                                    value={returnDate}
                                    onChange={(date) => setReturnDate(date)}
                                    minDate={departureDate ? new Date(departureDate) : new Date()}
                                    locale={locale}
                                    disabled={tripType === "oneWay"}
                                />
                            </div>

                            {/* Cabin & Passengers */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium mb-2 block text-slate-700">
                                        {t('cabin')}
                                    </label>
                                    <select
                                        value={cabin}
                                        onChange={(e) => setCabin(e.target.value as any)}
                                        className="w-full h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    >
                                        <option value="ECONOMY">{t('economy')}</option>
                                        <option value="BUSINESS">{t('business')}</option>
                                        <option value="FIRST">{t('firstClass')}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium mb-2 block text-slate-700 flex items-center gap-2">
                                        <Users className="h-4 w-4" />
                                        {t('passengers')}
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {/* Adults */}
                                        <div className="flex flex-col">
                                            <span className="text-xs text-slate-500 mb-1">{t('adultLabel')}</span>
                                            <div className="flex items-center h-12 rounded-xl border border-slate-200 bg-white">
                                                <button
                                                    type="button"
                                                    onClick={() => setAdults(Math.max(1, adults - 1))}
                                                    className="px-3 h-full text-slate-600 hover:bg-slate-50 rounded-l-xl"
                                                >-</button>
                                                <span className="flex-1 text-center font-medium">{adults}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setAdults(Math.min(9, adults + 1))}
                                                    className="px-3 h-full text-slate-600 hover:bg-slate-50 rounded-r-xl"
                                                >+</button>
                                            </div>
                                        </div>
                                        {/* Children (2-11) */}
                                        <div className="flex flex-col">
                                            <span className="text-xs text-slate-500 mb-1">{t('childLabel')}</span>
                                            <div className="flex items-center h-12 rounded-xl border border-slate-200 bg-white">
                                                <button
                                                    type="button"
                                                    onClick={() => setChildren(Math.max(0, children - 1))}
                                                    className="px-3 h-full text-slate-600 hover:bg-slate-50 rounded-l-xl"
                                                >-</button>
                                                <span className="flex-1 text-center font-medium">{children}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setChildren(Math.min(8, children + 1))}
                                                    className="px-3 h-full text-slate-600 hover:bg-slate-50 rounded-r-xl"
                                                >+</button>
                                            </div>
                                        </div>
                                        {/* Infants (0-2) */}
                                        <div className="flex flex-col">
                                            <span className="text-xs text-slate-500 mb-1">{t('infantLabel')}</span>
                                            <div className="flex items-center h-12 rounded-xl border border-slate-200 bg-white">
                                                <button
                                                    type="button"
                                                    onClick={() => setInfants(Math.max(0, infants - 1))}
                                                    className="px-3 h-full text-slate-600 hover:bg-slate-50 rounded-l-xl"
                                                >-</button>
                                                <span className="flex-1 text-center font-medium">{infants}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setInfants(Math.min(adults, infants + 1))}
                                                    className="px-3 h-full text-slate-600 hover:bg-slate-50 rounded-r-xl"
                                                >+</button>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">{t('totalPassengers', { count: adults + children + infants })}</p>
                                </div>
                            </div>

                            {/* Search Button */}
                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full h-14 text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-lg shadow-blue-500/25 transition-all active:scale-[0.99]"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        {t('searching')}
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="mr-2 h-5 w-5" />
                                        {t('searchButton')}
                                    </>
                                )}
                            </Button>
                        </form>

                        {/* Popular Destinations */}
                        {!results.length && !loading && (
                            <div className="mt-8 pt-6 border-t border-slate-100">
                                <p className="text-sm font-medium text-slate-500 mb-3">Popular destinations</p>
                                <div className="flex flex-wrap gap-2">
                                    {popularDestinations.map((dest) => (
                                        <button
                                            key={dest.iata}
                                            type="button"
                                            onClick={() => selectDestination(dest)}
                                            className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-sm text-slate-700 transition-all"
                                        >
                                            <MapPin className="h-3.5 w-3.5" />
                                            {dest.city}
                                            <span className="text-xs text-slate-400">({dest.iata})</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-2xl">
                            <p className="text-red-700 font-medium">{error}</p>
                        </div>
                    )}
                </div>
            </div >

            {/* Skeleton Loading State */}
            {loading && (
                <div className="bg-slate-50 min-h-screen py-8">
                    <div className="container mx-auto px-4 max-w-5xl">
                        {/* Loading Header */}
                        <div className="flex items-center justify-center mb-8">
                            <div className="flex flex-col items-center gap-4">
                                <div className="relative">
                                    <Plane className="h-12 w-12 text-blue-600 animate-bounce" />
                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-blue-200 rounded-full animate-pulse" />
                                </div>
                                <div className="text-center">
                                    <p className="text-lg font-semibold text-slate-700">{t('searching')}</p>
                                    <p className="text-sm text-slate-500 mt-1">{t('searchingDesc')}</p>
                                </div>
                            </div>
                        </div>

                        {/* Skeleton Cards */}
                        <div className="space-y-4">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="bg-white rounded-2xl p-6 shadow-sm animate-pulse">
                                    <div className="flex items-center justify-between">
                                        {/* Left: Airline */}
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-slate-200 rounded-xl" />
                                            <div>
                                                <div className="h-4 w-24 bg-slate-200 rounded mb-2" />
                                                <div className="h-3 w-16 bg-slate-100 rounded" />
                                            </div>
                                        </div>

                                        {/* Center: Route */}
                                        <div className="flex-1 mx-8">
                                            <div className="flex items-center justify-between">
                                                <div className="text-center">
                                                    <div className="h-5 w-12 bg-slate-200 rounded mb-1 mx-auto" />
                                                    <div className="h-3 w-8 bg-slate-100 rounded mx-auto" />
                                                </div>
                                                <div className="flex-1 mx-4">
                                                    <div className="h-0.5 w-full bg-slate-200 rounded" />
                                                    <div className="h-3 w-16 bg-slate-100 rounded mx-auto mt-1" />
                                                </div>
                                                <div className="text-center">
                                                    <div className="h-5 w-12 bg-slate-200 rounded mb-1 mx-auto" />
                                                    <div className="h-3 w-8 bg-slate-100 rounded mx-auto" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right: Price & Score */}
                                        <div className="text-right">
                                            <div className="h-6 w-20 bg-slate-200 rounded mb-2 ml-auto" />
                                            <div className="h-4 w-12 bg-blue-100 rounded ml-auto" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Fun Facts While Loading */}
                        <div className="mt-8 text-center">
                            <p className="text-sm text-slate-400 italic">
                                💡 Biliyor muydun? Salı günleri genellikle en ucuz uçuş günüdür!
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Results Section */}
            {results.length > 0 && (
                <div className="bg-slate-50 min-h-screen py-8">
                    <div className="container mx-auto px-4 max-w-5xl">
                        {/* Results Header */}
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900">
                                    {results.length} {t('resultsFound')}
                                </h2>
                                <p className="text-slate-500 text-sm mt-1">
                                    {fromCity} ({fromIata}) → {toCity} ({toIata})
                                </p>
                            </div>

                            {/* Sort Buttons */}
                            <div className="flex gap-2 bg-white p-1 rounded-xl shadow-sm">
                                <button
                                    onClick={() => setSortBy("score")}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${sortBy === "score"
                                        ? "bg-blue-600 text-white"
                                        : "text-slate-600 hover:bg-slate-50"
                                        }`}
                                >
                                    Best
                                </button>
                                <button
                                    onClick={() => setSortBy("price")}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${sortBy === "price"
                                        ? "bg-blue-600 text-white"
                                        : "text-slate-600 hover:bg-slate-50"
                                        }`}
                                >
                                    {t('cheapest')}
                                </button>
                                <button
                                    onClick={() => setSortBy("duration")}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${sortBy === "duration"
                                        ? "bg-blue-600 text-white"
                                        : "text-slate-600 hover:bg-slate-50"
                                        }`}
                                >
                                    {t('fastest')}
                                </button>
                            </div>
                        </div>

                        {/* Flight Cards */}
                        <div className="space-y-4">
                            {visibleResults.map((group, index) => (
                                <FlightCard
                                    key={group.id}
                                    flight={group.mainFlight}
                                />
                            ))}
                        </div>

                        {/* Load More Button */}
                        {visibleCount < sortedResults.length && (
                            <div className="mt-8 flex justify-center">
                                <button
                                    onClick={handleLoadMore}
                                    className="px-8 py-3 bg-white text-blue-600 font-medium rounded-xl shadow-sm border border-blue-100 hover:bg-blue-50 transition-all active:scale-95 flex items-center gap-2"
                                >
                                    {/* You can add a translation for this like t('showMore') */}
                                    Show more results
                                    <ChevronDown className="h-4 w-4" />
                                </button>
                            </div>
                        )}

                        <div className="mt-4 text-center text-slate-400 text-sm">
                            Showing {Math.min(visibleCount, sortedResults.length)} of {sortedResults.length} flights
                        </div>
                    </div>
                </div>
            )
            }
        </div >
    );
}


// Helper needed here or import
// Helper removed (imported from @/lib/flightScoreEngine)


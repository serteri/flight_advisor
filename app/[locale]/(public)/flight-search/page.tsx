"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CityAutocomplete } from "@/components/CityAutocomplete";
import { DatePicker } from "@/components/DatePicker";
import {
    Plane,
    Loader2,
    Users,
    ArrowRightLeft,
    MapPin,
    Sparkles,
    ChevronDown
} from "lucide-react";
import { useTranslations, useLocale } from 'next-intl';
import FlightResultCard from "@/components/search/FlightResultCard";
import { DataSourceIndicator } from "@/components/DataSourceIndicator";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { FlightResult } from "@/types/hybridFlight";

// Popular destinations for quick selection
const popularDestinations = [
    { city: "Istanbul", iata: "IST" },
    { city: "London", iata: "LHR" },
    { city: "Paris", iata: "CDG" },
    { city: "New York", iata: "JFK" },
    { city: "Dubai", iata: "DXB" },
    { city: "Tokyo", iata: "NRT" },
];

export default function SkyscannerSearchPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading...</div>}>
            <SearchPageContent />
        </Suspense>
    );
}

// ... (Importlar aynı)

// ... (Importlar aynı)

function SearchPageContent() {
    const t = useTranslations('FlightSearch');
    const locale = useLocale() as "en" | "tr" | "de";
    const [loading, setLoading] = useState(false);
    const [tripType, setTripType] = useState<"oneWay" | "roundTrip">("oneWay");
    const [results, setResults] = useState<FlightResult[]>([]);
    const [error, setError] = useState<string | null>(null);

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
    const [cabin, setCabin] = useState<"economy" | "business" | "first">("economy");

    // Pagination state
    const [visibleCount, setVisibleCount] = useState(20);

    const showMore = () => {
        setVisibleCount(prev => prev + 20);
    };

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

    // Unified Search Logic
    const executeSearch = async (params: {
        origin: string;
        destination: string;
        date: string;
        returnDate?: string;
        adults: number;
        cabin: string;
    }) => {
        if (!params.origin || !params.destination || !params.date) {
            setError(t('fillAllFields'));
            return;
        }

        setLoading(true);
        setError(null);
        setResults([]);
        setVisibleCount(20); // Reset pagination

        try {
            // Convert params to URLSearchParams for GET request
            const queryParams = new URLSearchParams({
                origin: params.origin,
                destination: params.destination,
                date: params.date,
                adults: params.adults.toString(),
                cabin: params.cabin,
                tripType: tripType === "roundTrip" ? "ROUND_TRIP" : "ONE_WAY" // Ensure upper case for backend
            });

            if (params.returnDate) {
                queryParams.append('returnDate', params.returnDate);
            }

            const res = await fetch(`/api/search?${queryParams.toString()}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || t('error'));
            }

            // API flat array döner: [...] veya {results: [...]}
            const flights = Array.isArray(data) ? data : (data.results || []);

            if (flights.length > 0) {
                setResults(flights);
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

    // Initial load from URL
    useEffect(() => {
        const urlOrigin = searchParams.get('origin');
        const urlDestination = searchParams.get('destination');
        const urlDate = searchParams.get('date');
        const urlReturnDate = searchParams.get('returnDate');
        const urlAdults = searchParams.get('adults');
        const urlCabin = searchParams.get('cabin');

        if (urlOrigin && urlDestination && urlDate) {
            // Populate Form State
            setFromIata(urlOrigin);
            setFromCity(urlOrigin); // Set City to IATA so input isn't empty

            setToIata(urlDestination);
            setToCity(urlDestination); // Set City to IATA so input isn't empty

            setDepartureDate(urlDate);

            if (urlReturnDate) {
                setReturnDate(urlReturnDate);
                setTripType("roundTrip");
            }

            if (urlAdults) setAdults(parseInt(urlAdults));
            if (urlCabin) setCabin(urlCabin as any);

            // Trigger Search
            executeSearch({
                origin: urlOrigin,
                destination: urlDestination,
                date: urlDate,
                returnDate: urlReturnDate || undefined,
                adults: urlAdults ? parseInt(urlAdults) : 1,
                cabin: urlCabin || 'economy'
            });
        }
    }, [searchParams]);

    async function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        executeSearch({
            origin: fromIata,
            destination: toIata,
            date: departureDate,
            returnDate: tripType === "roundTrip" ? returnDate : undefined,
            adults: adults + children + infants,
            cabin: cabin
        });
    }

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
                                <button type="button" onClick={() => setTripType("oneWay")} className={`px-5 py-2.5 rounded-lg font-medium transition-all text-sm ${tripType === "oneWay" ? "bg-white text-blue-600 shadow-md" : "text-slate-600 hover:text-slate-900"}`}>{t('oneWay')}</button>
                                <button type="button" onClick={() => setTripType("roundTrip")} className={`px-5 py-2.5 rounded-lg font-medium transition-all text-sm ${tripType === "roundTrip" ? "bg-white text-blue-600 shadow-md" : "text-slate-600 hover:text-slate-900"}`}>{t('roundTrip')}</button>
                            </div>

                            {/* From & To with Swap Button */}
                            <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-end">
                                <CityAutocomplete name="from" label={t('from')} placeholder={t('placeholder')} defaultValue={fromCity} defaultIataCode={fromIata} onSelect={(city, iata) => { setFromCity(city); setFromIata(iata); }} />
                                <button type="button" onClick={swapCities} className="hidden md:flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 transition-all hover:scale-110 active:scale-95 mb-0.5"><ArrowRightLeft className="h-5 w-5" /></button>
                                <CityAutocomplete name="to" label={t('to')} placeholder={t('placeholder')} defaultValue={toCity} defaultIataCode={toIata} onSelect={(city, iata) => { setToCity(city); setToIata(iata); }} />
                            </div>

                            {/* Dates */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <DatePicker label={t('departureDate')} placeholder={t('selectDate')} value={departureDate} onChange={setDepartureDate} minDate={new Date()} locale={locale} />
                                <DatePicker label={t('returnDate')} placeholder={t('selectDate')} value={returnDate} onChange={setReturnDate} minDate={departureDate ? new Date(departureDate) : new Date()} locale={locale} disabled={tripType === "oneWay"} />
                            </div>

                            {/* Search Button */}
                            <Button type="submit" disabled={loading} className="w-full h-14 text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-lg shadow-blue-500/25 transition-all active:scale-[0.99]">
                                {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> {t('searching')}</> : <><Sparkles className="mr-2 h-5 w-5" /> {t('searchButton')}</>}
                            </Button>
                        </form>

                        {!results.length && !loading && (
                            <div className="mt-8 pt-6 border-t border-slate-100">
                                <p className="text-sm font-medium text-slate-500 mb-3">Popular destinations</p>
                                <div className="flex flex-wrap gap-2">
                                    {popularDestinations.map((dest) => (
                                        <button key={dest.iata} type="button" onClick={() => selectDestination(dest)} className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-sm text-slate-700 transition-all"><MapPin className="h-3.5 w-3.5" />{dest.city}<span className="text-xs text-slate-400">({dest.iata})</span></button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {error && <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-2xl"><p className="text-red-700 font-medium">{error}</p></div>}
                </div>
            </div >

            {/* Skeleton Loading State */}
            {loading && (
                <div className="bg-slate-50 min-h-screen py-8">
                    <div className="container mx-auto px-4 max-w-5xl text-center">
                        <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
                        <p className="text-lg text-slate-600 font-medium">{t('searchingDesc')}</p>
                    </div>
                </div>
            )}

            {/* Results Section */}
            {results.length > 0 && (
                <div className="bg-slate-50 min-h-screen py-8">
                    <div className="container mx-auto px-4 max-w-5xl">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-slate-900">{results.length} {t('resultsFound')}</h2>
                        </div>
                        
                        {/* Veri Kaynağı Göstergesi */}
                        <DataSourceIndicator flights={results} />
                        
                        <div className="space-y-4">
                            {results.slice(0, visibleCount).map((flight) => (
                                <FlightResultCard
                                    key={flight.id}
                                    flight={flight}
                                    isPremium={false} // MOCKED: Set to true to unlock
                                />
                            ))}
                        </div>

                        {/* DAHA FAZLA GÖSTER BUTONU */}
                        {results.length > visibleCount && (
                            <div className="mt-8 text-center">
                                <button
                                    onClick={showMore}
                                    className="bg-white border border-slate-300 text-slate-600 font-bold py-3 px-8 rounded-full hover:bg-slate-50 hover:border-slate-400 transition shadow-sm"
                                >
                                    {t('showMore', { count: results.length - visibleCount })}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div >
    );
}

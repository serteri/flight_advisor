"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { SmartCitySearch } from "@/components/SmartCitySearch";
import { DatePicker } from "@/components/DatePicker";
import {
    Plane,
    Loader2,
    ArrowRightLeft,
    MapPin,
    Sparkles
} from "lucide-react";
import { useTranslations, useLocale } from 'next-intl';
import FlightResultCard from "@/components/search/FlightResultCard";
import { FlightFilters, FlightFilterState } from "@/components/search/FlightFilters";
import { DataSourceIndicator } from "@/components/DataSourceIndicator";
import { FlightSortBar, SortOption } from "@/components/FlightSortBar";
import { PassengerSelector } from "@/components/PassengerSelector";
import { Suspense } from "react";
import { FlightResult } from "@/types/hybridFlight";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useSession } from "next-auth/react";
import type { UserTier } from "@/lib/tierUtils";

// Popular destinations for quick selection
const popularDestinations = [
    { city: "Istanbul", iata: "IST" },
    { city: "London", iata: "LHR" },
    { city: "Paris", iata: "CDG" },
    { city: "New York", iata: "JFK" },
    { city: "Dubai", iata: "DXB" },
    { city: "Tokyo", iata: "NRT" },
];

type SearchCabin = "economy" | "premium" | "business" | "first";
type SelectorCabin = "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";
type SearchPersona = "budget" | "comfort" | "business" | "family";
type ChampionBadge = 'Best Overall' | 'Best Value' | 'Lowest Risk' | 'Fastest';

const normalizeCabinParam = (value: string | null): SearchCabin => {
    switch ((value || '').toLowerCase()) {
        case 'premium':
        case 'premium_economy':
            return 'premium';
        case 'business':
            return 'business';
        case 'first':
            return 'first';
        default:
            return 'economy';
    }
};

const toSelectorCabin = (value: SearchCabin): SelectorCabin => {
    switch (value) {
        case 'premium':
            return 'PREMIUM_ECONOMY';
        case 'business':
            return 'BUSINESS';
        case 'first':
            return 'FIRST';
        default:
            return 'ECONOMY';
    }
};

const fromSelectorCabin = (value: SelectorCabin): SearchCabin => {
    switch (value) {
        case 'PREMIUM_ECONOMY':
            return 'premium';
        case 'BUSINESS':
            return 'business';
        case 'FIRST':
            return 'first';
        default:
            return 'economy';
    }
};

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
    const [sortedResults, setSortedResults] = useState<FlightResult[]>([]);
    const [currentSort, setCurrentSort] = useState<SortOption>("best");
    const [filters, setFilters] = useState<FlightFilterState>({
        airline: "ALL",
        stops: "ALL",
        source: "ALL",
    });
    const [error, setError] = useState<string | null>(null);
    const [viewerTier, setViewerTier] = useState<UserTier>('FREE');
    const [hasPremiumAccess, setHasPremiumAccess] = useState(false);
    const { data: session } = useSession();
    const lastBootSearchRef = useRef<string>('');

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
    const [cabin, setCabin] = useState<SearchCabin>("economy");
    const [persona, setPersona] = useState<SearchPersona>("comfort");

    // Pagination state
    const [visibleCount, setVisibleCount] = useState(20);
    const interactedFlightKeysRef = useRef<Set<string>>(new Set());
    const ignoredFlightKeysRef = useRef<Set<string>>(new Set());

    const showMore = () => {
        setVisibleCount(prev => prev + 20);
    };

    const resetFilters = () => {
        setFilters({
            airline: "ALL",
            stops: "ALL",
            source: "ALL",
        });
    };

    const validatePassengerSelection = useCallback((selection: {
        adults: number;
        children: number;
        infants: number;
    }) => {
        const totalPassengers = selection.adults + selection.children + selection.infants;

        if (selection.adults < 1) {
            return t('adultRequired');
        }

        if (selection.infants > selection.adults) {
            return t('infantsRequireAdults');
        }

        if (totalPassengers > 9) {
            return t('passengerLimit');
        }

        return null;
    }, [t]);

    // Swap cities function
    const swapCities = () => {
        const tempCity = fromCity;
        const tempIata = fromIata;
        setFromCity(toCity);
        setFromIata(toIata);
        setToCity(tempCity);
        setToIata(tempIata);
    };

    // Unified Search Logic
    const executeSearch = async (params: {
        origin: string;
        destination: string;
        date: string;
        returnDate?: string;
        adults: number;
        children: number;
        infants: number;
        cabin: SearchCabin;
        persona: SearchPersona;
        tripType: "ONE_WAY" | "ROUND_TRIP";
    }) => {
        if (!params.origin || !params.destination || !params.date) {
            setError(t('fillAllFields'));
            return;
        }

        const passengerValidationError = validatePassengerSelection(params);
        if (passengerValidationError) {
            setError(passengerValidationError);
            return;
        }

        setLoading(true);
        setError(null);
        setResults([]);
        setVisibleCount(20); // Reset pagination

        try {
            // Validate IATA codes (3 letters)
            if (params.origin.length !== 3 || params.destination.length !== 3) {
                setError(t('invalidAirports'));
                setLoading(false);
                return;
            }

            // Convert params to URLSearchParams for GET request
            const queryParams = new URLSearchParams({
                origin: params.origin,
                destination: params.destination,
                date: params.date,
                adults: params.adults.toString(),
                children: params.children.toString(),
                infants: params.infants.toString(),
                cabin: params.cabin,
                persona: params.persona,
                tripType: params.tripType
            });

            if (params.returnDate) {
                queryParams.append('returnDate', params.returnDate);
            }

            window.history.replaceState(null, '', `${window.location.pathname}?${queryParams.toString()}`);

            const res = await fetch(`/api/flight-search?${queryParams.toString()}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || t('error'));
            }

            const flights = Array.isArray(data) ? data : (data.results || []);

            const access = Array.isArray(data) ? null : data.viewerAccess;
            if (access) {
                const periodEnd = access.stripeCurrentPeriodEnd
                    ? new Date(access.stripeCurrentPeriodEnd)
                    : null;
                const periodValid = !!periodEnd && periodEnd > new Date();
                const activePremium = Boolean(access.isPremium && periodValid);
                setHasPremiumAccess(activePremium);
                setViewerTier(activePremium ? (access.userTier as UserTier) : 'FREE');
            }

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
        const initialParams = new URLSearchParams(window.location.search);
        const urlOrigin = initialParams.get('origin');
        const urlDestination = initialParams.get('destination');
        const urlDate = initialParams.get('date');
        const urlReturnDate = initialParams.get('returnDate');
        const urlAdults = initialParams.get('adults');
        const urlChildren = initialParams.get('children');
        const urlInfants = initialParams.get('infants');
        const urlCabin = initialParams.get('cabin');
        const urlPersona = initialParams.get('persona');

        if (urlOrigin && urlDestination && urlDate) {
            const normalizedCabin = normalizeCabinParam(urlCabin);
            const searchKey = [
                urlOrigin,
                urlDestination,
                urlDate,
                urlReturnDate || '',
                urlAdults || '1',
                urlChildren || '0',
                urlInfants || '0',
                normalizedCabin,
                (urlPersona || 'comfort').toLowerCase(),
            ].join('|');
            if (lastBootSearchRef.current === searchKey) {
                return;
            }
            lastBootSearchRef.current = searchKey;

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
            if (urlChildren) setChildren(parseInt(urlChildren));
            if (urlInfants) setInfants(parseInt(urlInfants));
            setCabin(normalizedCabin);
            const normalizedPersona = ((urlPersona || 'comfort').toLowerCase() as SearchPersona);
            setPersona(
                normalizedPersona === 'budget' || normalizedPersona === 'business' || normalizedPersona === 'family'
                    ? normalizedPersona
                    : 'comfort'
            );

            // Trigger Search
            executeSearch({
                origin: urlOrigin,
                destination: urlDestination,
                date: urlDate,
                returnDate: urlReturnDate || undefined,
                adults: urlAdults ? parseInt(urlAdults) : 1,
                children: urlChildren ? parseInt(urlChildren) : 0,
                infants: urlInfants ? parseInt(urlInfants) : 0,
                cabin: normalizedCabin,
                persona:
                    normalizedPersona === 'budget' || normalizedPersona === 'business' || normalizedPersona === 'family'
                        ? normalizedPersona
                        : 'comfort',
                tripType: urlReturnDate ? 'ROUND_TRIP' : 'ONE_WAY'
            });
        }
    }, [executeSearch]);

    useEffect(() => {
        const plan = (session?.user as any)?.subscriptionPlan;
        const sessionPremium = plan === 'PRO' || plan === 'ELITE';
        if (sessionPremium && viewerTier === 'FREE') {
            setViewerTier(plan);
        }
        if (sessionPremium && !hasPremiumAccess) {
            setHasPremiumAccess(true);
        }
    }, [session, viewerTier, hasPremiumAccess]);

    async function handleSearch(e: React.FormEvent) {
        e.preventDefault();

        if (fromCity && fromIata) {
            localStorage.setItem('lastFlightOrigin', fromCity);
            localStorage.setItem('lastFlightOriginIata', fromIata.toUpperCase());
        }

        executeSearch({
            origin: fromIata,
            destination: toIata,
            date: departureDate,
            returnDate: tripType === "roundTrip" ? returnDate : undefined,
            adults,
            children,
            infants,
            cabin,
            persona,
            tripType: tripType === "roundTrip" ? "ROUND_TRIP" : "ONE_WAY"
        });
    }

    const handleFromChange = useCallback((city: string, iata: string) => {
        setFromCity(city);
        setFromIata(iata);
    }, []);

    const handleToChange = useCallback((city: string, iata: string) => {
        setToCity(city);
        setToIata(iata);
    }, []);

    const selectDestination = (dest: typeof popularDestinations[0]) => {
        setToCity(dest.city);
        setToIata(dest.iata);
    };

    const sortFlights = (flights: FlightResult[], sortBy: SortOption): FlightResult[] => {
        const sorted = [...flights];

        const parseNumeric = (value: unknown): number => {
            if (typeof value === 'number' && Number.isFinite(value)) return value;
            if (typeof value === 'string') {
                const numeric = Number(value.replace(/[^0-9.]/g, ''));
                if (Number.isFinite(numeric)) return numeric;
            }
            return 0;
        };

        const resolvePrice = (flight: FlightResult) => {
            const direct = parseNumeric((flight as any).price);
            if (direct > 0) return direct;

            const providerPrice = Array.isArray((flight as any).bookingProviders)
                ? Math.min(
                    ...((flight as any).bookingProviders as any[])
                        .map((provider) => parseNumeric(provider?.price))
                        .filter((price) => price > 0)
                )
                : Infinity;

            return Number.isFinite(providerPrice) && providerPrice > 0 ? providerPrice : Number.MAX_SAFE_INTEGER;
        };

        const resolveDuration = (flight: FlightResult) => {
            const direct = parseNumeric((flight as any).duration);
            if (direct > 0) return direct;

            const depMs = flight.departTime ? new Date(flight.departTime).getTime() : NaN;
            const arrMs = flight.arriveTime ? new Date(flight.arriveTime).getTime() : NaN;
            if (Number.isFinite(depMs) && Number.isFinite(arrMs) && arrMs > depMs) {
                return Math.round((arrMs - depMs) / 60000);
            }

            return Number.MAX_SAFE_INTEGER;
        };

        const resolveAgentScore = (flight: FlightResult) => {
            const score = Number(flight.agentScore ?? flight.advancedScore?.displayScore ?? flight.score ?? 0);
            return Number.isFinite(score) ? score : 0;
        };

        const isBestValue = (flight: FlightResult) => {
            const tag = (flight.advancedScore?.valueTag || '').toString().toLowerCase();
            return tag.includes('en i̇yi fiyat/performans') || tag.includes('en iyi fiyat/performans') || tag.includes('best value');
        };
        
        switch (sortBy) {
            case "cheapest":
                return sorted.sort((a, b) => resolvePrice(a) - resolvePrice(b));
            case "fastest":
                return sorted.sort((a, b) => resolveDuration(a) - resolveDuration(b));
            case "best":
            default:
                // Best (default): Agent Score priority (high -> low),
                // with Best Value + 8.5+ flights pinned to the very top.
                return sorted.sort((a, b) => {
                    const agentA = resolveAgentScore(a);
                    const agentB = resolveAgentScore(b);

                    const premiumBestA = Number(agentA >= 8.5) + Number(isBestValue(a));
                    const premiumBestB = Number(agentB >= 8.5) + Number(isBestValue(b));
                    if (premiumBestA !== premiumBestB) {
                        return premiumBestB - premiumBestA;
                    }

                    if (agentA !== agentB) {
                        return agentB - agentA;
                    }

                    return resolvePrice(a) - resolvePrice(b);
                });
        }
    };

    const handleSortChange = (sortBy: SortOption) => {
        setCurrentSort(sortBy);
        setSortedResults(sortFlights(results, sortBy));
    };

    // Auto-sort when results change
    useEffect(() => {
        if (results.length > 0) {
            setSortedResults(sortFlights(results, currentSort));
        }
    }, [results, currentSort]);

    const availableAirlines = useMemo(() => {
        return Array.from(
            new Set(
                results
                    .map((flight) => String(flight.airline || "").trim())
                    .filter(Boolean)
            )
        ).sort((a, b) => a.localeCompare(b));
    }, [results]);

    const filteredResults = useMemo(() => {
        return sortedResults.filter((flight) => {
            const airline = String(flight.airline || "").trim();
            const source = String(flight.source || "").toUpperCase();
            const stops = Number(flight.stops || 0);

            const airlineMatch = filters.airline === "ALL" || airline === filters.airline;
            const sourceMatch = filters.source === "ALL" || source === filters.source;

            const stopMatch =
                filters.stops === "ALL" ||
                (filters.stops === "DIRECT" && stops === 0) ||
                (filters.stops === "ONE_STOP" && stops === 1) ||
                (filters.stops === "TWO_PLUS" && stops >= 2);

            return airlineMatch && sourceMatch && stopMatch;
        });
    }, [sortedResults, filters]);

    const getFlightKey = (flight: FlightResult) =>
        `${flight.id}|${flight.source}|${flight.flightNumber}|${flight.departTime}`;

    const championData = useMemo(() => {
        const list = [...filteredResults];
        const empty = { ordered: list, labels: {} as Record<string, ChampionBadge> };
        if (list.length === 0) return empty;

        const parseNum = (value: unknown): number => {
            if (typeof value === 'number' && Number.isFinite(value)) return value;
            if (typeof value === 'string') {
                const n = Number(value.replace(/[^0-9.]/g, ''));
                return Number.isFinite(n) ? n : 0;
            }
            return 0;
        };
        const resolvePrice = (flight: FlightResult) => {
            const direct = parseNum((flight as any).price);
            if (direct > 0) return direct;
            return Number.MAX_SAFE_INTEGER;
        };
        const resolveDuration = (flight: FlightResult) => {
            const direct = parseNum((flight as any).duration);
            if (direct > 0) return direct;
            const depMs = flight.departTime ? new Date(flight.departTime).getTime() : NaN;
            const arrMs = flight.arriveTime ? new Date(flight.arriveTime).getTime() : NaN;
            if (Number.isFinite(depMs) && Number.isFinite(arrMs) && arrMs > depMs) {
                return Math.round((arrMs - depMs) / 60000);
            }
            return Number.MAX_SAFE_INTEGER;
        };
        const resolveScore = (flight: FlightResult) => {
            const score = Number(flight.advancedScore?.totalScore ?? flight.agentScore ?? flight.advancedScore?.displayScore ?? flight.score ?? 0);
            return Number.isFinite(score) ? score : 0;
        };
        const resolveRisk = (flight: FlightResult) => {
            const connectionRisk = flight.advancedScore?.connectionRisk || 'low';
            const connectionRiskScore = connectionRisk === 'critical' ? 4 : connectionRisk === 'high' ? 3 : connectionRisk === 'medium' ? 2 : 1;
            const delayPenalty = Number(flight.advancedScore?.delayProbability || 18) / 10;
            const reliabilityPenalty = (10 - Number(flight.advancedScore?.breakdown?.reliability || 5)) / 2;
            const selfTransferPenalty = Number(flight.advancedScore?.breakdown?.selfTransfer || 10) < 10 ? 2 : 0;
            return connectionRiskScore + delayPenalty + reliabilityPenalty + selfTransferPenalty;
        };

        const labels: Record<string, ChampionBadge> = {};
        const selectedKeys = new Set<string>();
        const champions: FlightResult[] = [];

        const pickChampion = (label: ChampionBadge, comparator: (a: FlightResult, b: FlightResult) => number) => {
            const candidate = [...list].sort(comparator).find((f) => !selectedKeys.has(getFlightKey(f)));
            if (!candidate) return;
            const key = getFlightKey(candidate);
            selectedKeys.add(key);
            labels[key] = label;
            champions.push(candidate);
        };

        pickChampion('Best Overall', (a, b) => resolveScore(b) - resolveScore(a));
        pickChampion('Best Value', (a, b) => {
            const valueA = Number(a.advancedScore?.breakdown?.priceValue || 0);
            const valueB = Number(b.advancedScore?.breakdown?.priceValue || 0);
            if (valueA !== valueB) return valueB - valueA;
            return resolvePrice(a) - resolvePrice(b);
        });
        pickChampion('Lowest Risk', (a, b) => resolveRisk(a) - resolveRisk(b));
        pickChampion('Fastest', (a, b) => resolveDuration(a) - resolveDuration(b));

        const ordered = [...champions, ...list.filter((f) => !selectedKeys.has(getFlightKey(f)))];
        return { ordered, labels };
    }, [filteredResults]);

    const rankedResults = useMemo(() => {
        const base = championData.ordered;
        const result = base.map((flight) => ({ ...flight }));

        const parseNum = (value: unknown): number => {
            if (typeof value === 'number' && Number.isFinite(value)) return value;
            if (typeof value === 'string') {
                const n = Number(value.replace(/[^0-9.]/g, ''));
                return Number.isFinite(n) ? n : 0;
            }
            return 0;
        };
        const resolveDuration = (flight: FlightResult) => {
            const direct = parseNum((flight as any).duration);
            if (direct > 0) return direct;
            const depMs = flight.departTime ? new Date(flight.departTime).getTime() : NaN;
            const arrMs = flight.arriveTime ? new Date(flight.arriveTime).getTime() : NaN;
            if (Number.isFinite(depMs) && Number.isFinite(arrMs) && arrMs > depMs) return Math.round((arrMs - depMs) / 60000);
            return Number.MAX_SAFE_INTEGER;
        };

        result.forEach((flight) => {
            const currentKey = getFlightKey(flight);
            const currentPrice = parseNum(flight.price);
            const currentDuration = resolveDuration(flight);

            const alt = base
                .filter((candidate) => getFlightKey(candidate) !== currentKey)
                .map((candidate) => {
                    const priceDiff = parseNum(candidate.price) - currentPrice;
                    const timeGain = currentDuration - resolveDuration(candidate);
                    return { candidate, priceDiff, timeGain };
                })
                .filter((x) => x.priceDiff >= 40 && x.timeGain >= 180)
                .sort((a, b) => a.priceDiff - b.priceDiff || b.timeGain - a.timeGain)[0];

            if (alt) {
                const hoursSaved = Math.max(1, Math.round(alt.timeGain / 60));
                flight.counterfactualNote = `Bu uçuştan $${Math.round(alt.priceDiff)} daha pahalı ama ${hoursSaved} saat daha kısa bir alternatif var.`;
            }
        });

        return result;
    }, [championData]);

    useEffect(() => {
        if (!rankedResults.length || loading) return;

        const timeoutId = window.setTimeout(() => {
            const slice = rankedResults.slice(0, Math.max(visibleCount, 20));

            for (const flight of slice) {
                const key = getFlightKey(flight);
                if (interactedFlightKeysRef.current.has(key) || ignoredFlightKeysRef.current.has(key)) {
                    continue;
                }

                const payload = {
                    action: 'IGNORE',
                    flightId: flight.id,
                    flightNumber: flight.flightNumber,
                    provider: String(flight.source || '').toUpperCase(),
                    origin: String(flight.from || '').toUpperCase(),
                    destination: String(flight.to || '').toUpperCase(),
                    departureDate: String(flight.departTime || '').slice(0, 10),
                    selectedPrice: Number(flight.price) || null,
                    selectedScore: Number(flight.agentScore ?? flight.advancedScore?.displayScore ?? 0) || null,
                    rank: null,
                    totalResults: rankedResults.length,
                    currency: String(flight.currency || 'AUD').toUpperCase(),
                    isDirect: Number(flight.stops) === 0,
                    departTime: flight.departTime,
                };

                try {
                    const body = JSON.stringify(payload);
                    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
                        const blob = new Blob([body], { type: 'application/json' });
                        navigator.sendBeacon('/api/selection-track', blob);
                    } else {
                        fetch('/api/selection-track', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body,
                            keepalive: true,
                        }).catch(() => undefined);
                    }
                } catch {
                    // Best effort only.
                }

                ignoredFlightKeysRef.current.add(key);
            }
        }, 10000);

        return () => window.clearTimeout(timeoutId);
    }, [rankedResults, visibleCount, loading]);

    useEffect(() => {
        setVisibleCount(20);
    }, [filters, currentSort, results.length]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
            {/* Hero Section with Search */}
            <div className="relative z-50">
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
                    <div className="relative z-50 overflow-visible bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-6 md:p-8 border border-white/20">
                        <form onSubmit={handleSearch} className="space-y-6">
                            {/* Trip Type Toggle */}
                            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
                                <button type="button" onClick={() => setTripType("oneWay")} className={`px-5 py-2.5 rounded-lg font-medium transition-all text-sm ${tripType === "oneWay" ? "bg-white text-blue-600 shadow-md" : "text-slate-600 hover:text-slate-900"}`}>{t('oneWay')}</button>
                                <button type="button" onClick={() => setTripType("roundTrip")} className={`px-5 py-2.5 rounded-lg font-medium transition-all text-sm ${tripType === "roundTrip" ? "bg-white text-blue-600 shadow-md" : "text-slate-600 hover:text-slate-900"}`}>{t('roundTrip')}</button>
                            </div>

                            {/* From & To with Swap Button */}
                            <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-end">
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-slate-700">{t('from')}</label>
                                    <SmartCitySearch 
                                        placeholder={t('from')} 
                                        value={fromCity} 
                                        iataCode={fromIata}
                                        onChange={handleFromChange}
                                        isDestination={false}
                                    />
                                </div>
                                <button 
                                    type="button" 
                                    onClick={swapCities} 
                                    className="hidden md:flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 transition-all hover:scale-110 active:scale-95 mb-0.5"
                                >
                                    <ArrowRightLeft className="h-5 w-5" />
                                </button>
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-slate-700">{t('to')}</label>
                                    <SmartCitySearch 
                                        placeholder={t('to')} 
                                        value={toCity} 
                                        iataCode={toIata}
                                        onChange={handleToChange}
                                        isDestination={true}
                                    />
                                </div>
                            </div>

                            {/* Dates */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <DatePicker label={t('departureDate')} placeholder={t('selectDate')} value={departureDate} onChange={setDepartureDate} minDate={new Date()} locale={locale} />
                                <DatePicker label={t('returnDate')} placeholder={t('selectDate')} value={returnDate} onChange={setReturnDate} minDate={departureDate ? new Date(departureDate) : new Date()} locale={locale} disabled={tripType === "oneWay"} />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-slate-700">{t('travelers_label')}</label>
                                    <PassengerSelector
                                        adults={adults}
                                        setAdults={setAdults}
                                        childrenCount={children}
                                        setChildrenCount={setChildren}
                                        infants={infants}
                                        setInfants={setInfants}
                                        cabin={toSelectorCabin(cabin)}
                                        setCabin={(value) => setCabin(fromSelectorCabin(value))}
                                        className="w-full"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-slate-700">Seyahat Amacı</label>
                                    <select
                                        value={persona}
                                        onChange={(e) => setPersona(e.target.value as SearchPersona)}
                                        className="w-full h-12 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="budget">Budget</option>
                                        <option value="comfort">Comfort</option>
                                        <option value="business">Business</option>
                                        <option value="family">Family</option>
                                    </select>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                                    {t('totalPassengers', { count: adults + children + infants })}
                                </div>
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
                <div className="relative z-10 bg-slate-50 min-h-screen py-8">
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
                            <h2 className="text-2xl font-bold text-slate-900">
                                {rankedResults.length} / {results.length} {t('resultsFound')}
                            </h2>
                        </div>
                        
                        {/* Veri Kaynağı Göstergesi */}
                        <DataSourceIndicator flights={results} />

                        <FlightFilters
                            filters={filters}
                            airlines={availableAirlines}
                            filteredCount={filteredResults.length}
                            totalCount={results.length}
                            onChange={setFilters}
                            onReset={resetFilters}
                        />
                        
                        {/* Sıralama Çubuğu */}
                        <FlightSortBar 
                            currentSort={currentSort}
                            onSortChange={handleSortChange}
                            resultCount={rankedResults.length}
                        />
                        
                        <ErrorBoundary>
                            <div className="space-y-4" style={{ contentVisibility: "auto", containIntrinsicSize: "900px" }}>
                                {rankedResults.slice(0, visibleCount).map((flight, index) => (
                                    (() => {
                                        const nearbyCompetitor =
                                            rankedResults[index + 1] ||
                                            rankedResults[index - 1] ||
                                            null;
                                        return (
                                    <FlightResultCard
                                        key={`${flight.id}-${flight.source}-${flight.flightNumber}-${flight.departTime}-${index}`}
                                        flight={flight}
                                        championBadge={championData.labels[getFlightKey(flight)]}
                                        isPremium={hasPremiumAccess}
                                        userTier={viewerTier}
                                        onUserAction={() => {
                                            interactedFlightKeysRef.current.add(getFlightKey(flight));
                                        }}
                                        selectionContext={{
                                            rank: index + 1,
                                            totalResults: rankedResults.length,
                                            competitorPrice: nearbyCompetitor ? Number(nearbyCompetitor.price || 0) : null,
                                            competitorScore:
                                                nearbyCompetitor && Number.isFinite(Number(nearbyCompetitor.agentScore))
                                                    ? Number(nearbyCompetitor.agentScore)
                                                    : nearbyCompetitor && Number.isFinite(Number(nearbyCompetitor.advancedScore?.displayScore))
                                                        ? Number(nearbyCompetitor.advancedScore?.displayScore)
                                                        : null,
                                        }}
                                    />
                                        );
                                    })()
                                ))}
                            </div>
                        </ErrorBoundary>

                        {/* DAHA FAZLA GÖSTER BUTONU */}
                        {rankedResults.length > visibleCount && (
                            <div className="mt-8 text-center">
                                <button
                                    onClick={showMore}
                                    className="bg-white border border-slate-300 text-slate-600 font-bold py-3 px-8 rounded-full hover:bg-slate-50 hover:border-slate-400 transition shadow-sm"
                                >
                                    {t('showMore', { count: rankedResults.length - visibleCount })}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div >
    );
}

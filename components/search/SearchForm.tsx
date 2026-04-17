'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { Button } from "@/components/ui/button";
import { Search, Plane } from "lucide-react";
import { CitySearchInput } from "@/components/CitySearchInput";
import { DatePicker } from "@/components/DatePicker";
import { PassengerSelector } from "@/components/PassengerSelector";
import { useTranslations, useLocale } from 'next-intl';

export function SearchForm() {
    const t = useTranslations('SearchForm');
    const tCommon = useTranslations('common');
    const locale = useLocale(); // "en" | "tr" | "de"
    const router = useRouter();


    const [tripType, setTripType] = useState<'ONE_WAY' | 'ROUND_TRIP' | 'MULTI_CITY'>('ROUND_TRIP');
    const [returnDate, setReturnDate] = useState<Date | undefined>(undefined);

    const [origin, setOrigin] = useState<any>(null);
    const [destination, setDestination] = useState<any>(null);
    const [date, setDate] = useState<Date | undefined>(new Date());

    // Passenger State
    const [adults, setAdults] = useState(1);
    const [childrenCount, setChildrenCount] = useState(0);
    const [infants, setInfants] = useState(0);
    const [cabin, setCabin] = useState<"ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST">("ECONOMY");
    const [persona, setPersona] = useState<'budget' | 'comfort' | 'business' | 'family'>('comfort');

    const handleSearch = () => {
        // SAFETY: Ensure origin and destination have correct structure
        if (!origin?.iata || !destination?.iata || !date) {
            console.error('[SearchForm] Invalid form state:', { origin, destination, date });
            alert('Please select valid airports and date');
            return;
        }

        try {
            const dateStr = date.toISOString().split('T')[0];
            const returnDateStr = returnDate ? returnDate.toISOString().split('T')[0] : '';

            const queryParams = new URLSearchParams({
                // Core Params
                origin: origin.iata,
                destination: destination.iata,
                date: dateStr,
                tripType: tripType, // 'ONE_WAY' | 'ROUND_TRIP'

                // Return Date (if round trip)
                ...(tripType === 'ROUND_TRIP' && returnDateStr ? { returnDate: returnDateStr } : {}),

                // Passengers
                adults: adults.toString(),
                children: childrenCount.toString(),
                infants: infants.toString(),
                cabin: cabin,
                persona,
            });

            router.push(`/flight-search?${queryParams.toString()}`);
        } catch (error) {
            console.error('[SearchForm] Error during search:', error);
            alert('An error occurred. Please try again.');
        }
    };

    return (
        <div className="w-full relative">
            {/* Trip Type Tabs */}
            <div className="flex gap-2 mb-4 px-1">
                {(['ONE_WAY', 'ROUND_TRIP', 'MULTI_CITY'] as const).map((type) => (
                    <button
                        key={type}
                        onClick={() => setTripType(type)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all duration-200 ${
                            tripType === type
                                ? 'bg-white/25 text-white shadow-sm shadow-white/10 backdrop-blur-sm'
                                : 'text-white/55 hover:text-white/80'
                        }`}
                    >
                        {type === 'ONE_WAY' ? (t('one_way') || 'One way')
                            : type === 'ROUND_TRIP' ? (t('round_trip') || 'Round trip')
                            : (t('multi_city') || 'Multi-city')}
                    </button>
                ))}
            </div>

            <div className="bg-white/85 backdrop-blur-xl rounded-[2rem] flight-deck-shadow border border-white/80 p-2 relative z-20 warm-hover overflow-hidden">

                <div className="flex flex-col gap-2 lg:grid lg:grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)] lg:gap-2">
                    <div className="min-w-0 overflow-hidden xl:min-w-[250px]">
                        <CitySearchInput
                            label={tCommon('from')}
                            placeholder={t('origin_placeholder')}
                            onSelect={setOrigin}
                            variant="ghost"
                            className="h-[88px] w-full rounded-2xl transition-colors"
                        />
                    </div>

                    <div className="hidden lg:flex items-center justify-center relative z-10 pointer-events-none">
                        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex items-center">
                            <div className="w-px h-full bg-slate-200/55" />
                        </div>
                        <div className="relative bg-white rounded-full p-1 shadow-sm border border-sky-100">
                            <Plane size={10} className="text-sky-500 fill-sky-500" />
                        </div>
                    </div>

                    <div className="min-w-0 overflow-hidden xl:min-w-[250px]">
                        <CitySearchInput
                            label={tCommon('to')}
                            placeholder={t('destination_placeholder')}
                            onSelect={setDestination}
                            variant="ghost"
                            className="h-[88px] w-full rounded-2xl transition-colors"
                        />
                    </div>
                </div>

                <div className="h-px bg-slate-200/55 my-2 mx-2" />

                <div className="flex flex-col gap-2 lg:grid lg:grid-cols-[minmax(0,2fr)_140px_140px_64px] lg:gap-2 xl:grid-cols-[minmax(340px,2fr)_150px_150px_64px]">
                    <div className="relative group min-w-0 overflow-hidden">
                        <div className="flex h-full min-w-0 overflow-hidden rounded-2xl bg-transparent">
                            <div className="flex-1 min-w-0 overflow-hidden">
                                <DatePicker
                                    label={tCommon('departure')}
                                    date={date}
                                    setDate={setDate}
                                    locale={locale as any}
                                    variant="ghost"
                                    className="h-[88px] w-full rounded-2xl lg:rounded-r-none transition-colors min-w-0"
                                />
                            </div>

                            {tripType === 'ROUND_TRIP' && (
                                <>
                                    <div className="w-px bg-slate-200/55 my-3 shrink-0" />
                                    <div className="flex-1 min-w-0 overflow-hidden">
                                        <DatePicker
                                            label={tCommon('return')}
                                            date={returnDate}
                                            setDate={setReturnDate}
                                            locale={locale as any}
                                            variant="ghost"
                                            className="h-[88px] w-full rounded-2xl lg:rounded-l-none transition-colors min-w-0"
                                            placeholder="Add date"
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="relative group min-w-0 overflow-hidden">
                        <PassengerSelector
                            adults={adults}
                            setAdults={setAdults}
                            childrenCount={childrenCount}
                            setChildrenCount={setChildrenCount}
                            infants={infants}
                            setInfants={setInfants}
                            cabin={cabin}
                            setCabin={setCabin}
                            variant="ghost"
                            className="h-[88px] rounded-2xl transition-colors min-w-0"
                        />
                    </div>

                    <div className="relative group px-3 flex items-center min-w-0">
                        <div className="w-full min-w-0">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-[0.08em] block mb-1 truncate">
                                {tCommon('purpose_title')}
                            </label>
                            <select
                                value={persona}
                                onChange={(e) => setPersona(e.target.value as 'budget' | 'comfort' | 'business' | 'family')}
                                className="w-full h-10 rounded-xl border border-sky-100 bg-sky-50/40 px-2 text-sm font-semibold text-slate-700 min-w-0"
                            >
                                <option value="budget">Budget</option>
                                <option value="comfort">Comfort</option>
                                <option value="business">Business</option>
                                <option value="family">Family</option>
                            </select>
                        </div>
                    </div>

                    <div className="p-2 flex items-center shrink-0">
                        <Button
                            onClick={handleSearch}
                            disabled={!origin || !destination || !date}
                            className="w-full md:w-[56px] md:h-[56px] h-14 rounded-xl md:rounded-full bg-gradient-to-r from-sky-600 to-orange-400 hover:from-sky-500 hover:to-orange-300 text-white shadow-lg shadow-sky-500/40 hover:shadow-sky-500/60 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 btn-glow"
                        >
                            <Search className="h-5 w-5" />
                            <span className="md:hidden ml-2 font-bold">{tCommon('search_flights')}</span>
                        </Button>
                    </div>
                </div>
            </div>

            {/* Multi-City Message (If selected) */}
            {tripType === 'MULTI_CITY' && (
                <div className="absolute top-full left-0 mt-4 bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 text-white text-sm">
                    ⚠️ Multi-city search is currently optimized for desktop. Please use our concierge service for complex itineraries.
                </div>
            )}
        </div>
    );
}


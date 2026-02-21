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
    const [cabin, setCabin] = useState<"ECONOMY" | "BUSINESS" | "FIRST">("ECONOMY");

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
                cabin: cabin
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
            <div className="flex gap-6 mb-4 px-2">
                <button
                    onClick={() => setTripType('ONE_WAY')}
                    className={`text-sm font-bold transition-colors ${tripType === 'ONE_WAY' ? 'text-white' : 'text-white/60 hover:text-white'}`}
                >
                    {t('one_way') || "One way"}
                </button>
                <button
                    onClick={() => setTripType('ROUND_TRIP')}
                    className={`text-sm font-bold transition-colors ${tripType === 'ROUND_TRIP' ? 'text-white' : 'text-white/60 hover:text-white'}`}
                >
                    {t('round_trip') || "Round trip"}
                </button>
                <button
                    onClick={() => setTripType('MULTI_CITY')}
                    className={`text-sm font-bold transition-colors ${tripType === 'MULTI_CITY' ? 'text-white' : 'text-white/60 hover:text-white'}`}
                >
                    {t('multi_city') || "Multi-city"}
                </button>
            </div>

            {/* Unified Search Bar Container */}
            <div className="bg-white rounded-3xl md:rounded-full shadow-2xl shadow-blue-900/20 border border-slate-200/50 p-2 flex flex-col md:flex-row relative z-20">

                {/* Origin */}
                <div className="relative flex-1 group">
                    <CitySearchInput
                        label={t('origin_label') || "From"}
                        placeholder={t('origin_placeholder')}
                        onSelect={setOrigin}
                        variant="ghost"
                        className="h-[88px] w-full rounded-2xl md:rounded-l-full md:rounded-r-none transition-colors"
                    />
                </div>

                {/* Divider */}
                <div className="hidden md:block w-px bg-slate-200 my-4" />
                <div className="md:hidden h-px bg-slate-200 mx-4" />

                {/* Destination */}
                <div className="relative flex-1 group">
                    <CitySearchInput
                        label={t('destination_label') || "To"}
                        placeholder={t('destination_placeholder')}
                        onSelect={setDestination}
                        variant="ghost"
                        className="h-[88px] w-full rounded-2xl md:rounded-none transition-colors"
                    />
                </div>

                {/* Divider */}
                <div className="hidden md:block w-px bg-slate-200 my-4" />
                <div className="md:hidden h-px bg-slate-200 mx-4" />

                {/* Date Selection (Dynamic based on Trip Type) */}
                <div className="relative md:w-[320px] group flex">
                    <div className="flex-1">
                        <DatePicker
                            label={t('date_label') || "Depart"}
                            date={date}
                            setDate={setDate}
                            locale={locale as any}
                            variant="ghost"
                            className="h-[88px] w-full rounded-2xl md:rounded-none transition-colors"
                        />
                    </div>

                    {tripType === 'ROUND_TRIP' && (
                        <>
                            <div className="hidden md:block w-px bg-slate-200 my-4" />
                            <div className="flex-1">
                                <DatePicker
                                    label={t('return_label') || "Return"}
                                    date={returnDate}
                                    setDate={setReturnDate}
                                    locale={locale as any}
                                    variant="ghost"
                                    className="h-[88px] w-full rounded-2xl md:rounded-none transition-colors"
                                    placeholder="Add date"
                                />
                            </div>
                        </>
                    )}
                </div>

                {/* Divider */}
                <div className="hidden md:block w-px bg-slate-200 my-4" />
                <div className="md:hidden h-px bg-slate-200 mx-4" />

                {/* Passengers */}
                <div className="relative md:w-[150px] group">
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
                        className="h-[88px] rounded-2xl md:rounded-none transition-colors"
                    />
                </div>

                {/* Search Button */}
                <div className="p-2 md:pl-0">
                    <Button
                        onClick={handleSearch}
                        disabled={!origin || !destination || !date}
                        className="w-full md:w-[60px] md:h-[60px] h-14 rounded-xl md:rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                    >
                        <Search className="h-6 w-6" />
                        <span className="md:hidden ml-2 font-bold">{t('search_button')}</span>
                    </Button>
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


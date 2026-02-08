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


    const [origin, setOrigin] = useState<any>(null);
    const [destination, setDestination] = useState<any>(null);
    const [date, setDate] = useState<Date | undefined>(new Date());

    // Passenger State
    const [adults, setAdults] = useState(1);
    const [childrenCount, setChildrenCount] = useState(0);
    const [infants, setInfants] = useState(0);
    const [cabin, setCabin] = useState<"ECONOMY" | "BUSINESS" | "FIRST">("ECONOMY");

    const handleSearch = () => {
        if (origin && destination && date) {
            const dateStr = date.toISOString().split('T')[0];
            const queryParams = new URLSearchParams({
                origin: origin.iata,
                destination: destination.iata,
                date: dateStr,
                adults: adults.toString(),
                children: childrenCount.toString(),
                infants: infants.toString(),
                cabin: cabin
            });

            // If round trip is selected (implementation pending in UI but good to support via URL if extended), we could add it.
            // For now, homepage UI handles one way or round trip via radio buttons (but logic was missing).
            // Let's assume one-way for simplicity unless logic is enhanced.
            // TODO: Enhance tripType logic

            router.push(`/flight-search?${queryParams.toString()}`);
        }
    };

    return (
        <div className="w-full relative">
            {/* Unified Search Bar Container */}
            <div className="bg-white rounded-3xl md:rounded-full shadow-2xl shadow-blue-900/20 border border-slate-200/50 p-2 flex flex-col md:flex-row relative z-20">

                {/* Origin */}
                <div className="relative flex-1 group">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none z-10">
                        <Plane className="h-5 w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                    </div>
                    <CitySearchInput
                        placeholder={t('origin_placeholder')}
                        onSelect={setOrigin}
                        variant="ghost"
                        className="h-[72px] w-full text-lg font-bold hover:bg-slate-50 rounded-2xl md:rounded-l-full md:rounded-r-none transition-colors"
                    />
                </div>

                {/* Divider */}
                <div className="hidden md:block w-px bg-slate-200 my-3" />
                <div className="md:hidden h-px bg-slate-200 mx-4" />

                {/* Destination */}
                <div className="relative flex-1 group">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none z-10">
                        <Plane className="h-5 w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors rotate-90" />
                    </div>
                    <CitySearchInput
                        placeholder={t('destination_placeholder')}
                        onSelect={setDestination}
                        variant="ghost"
                        className="h-[72px] w-full text-lg font-bold hover:bg-slate-50 rounded-2xl md:rounded-none transition-colors"
                    />
                </div>

                {/* Divider */}
                <div className="hidden md:block w-px bg-slate-200 my-3" />
                <div className="md:hidden h-px bg-slate-200 mx-4" />

                {/* Date */}
                <div className="relative md:w-[220px] group">
                    <DatePicker
                        date={date}
                        setDate={setDate}
                        locale={locale as any}
                        variant="ghost"
                        className="h-[72px] w-full text-lg font-bold hover:bg-slate-50 rounded-2xl md:rounded-none transition-colors"
                    />
                </div>

                {/* Divider */}
                <div className="hidden md:block w-px bg-slate-200 my-3" />
                <div className="md:hidden h-px bg-slate-200 mx-4" />

                {/* Passengers */}
                <div className="relative md:w-[200px] group">
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
                        className="h-[72px] hover:bg-slate-50 rounded-2xl md:rounded-none transition-colors"
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

            {/* Trip Type Toggles (Optional - positioned below) */}
            <div className="absolute -bottom-10 left-6 flex gap-6 text-sm font-medium text-white/80">
                <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                    <div className="w-4 h-4 rounded-full border-2 border-white/50 flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full shadow-sm" />
                    </div>
                    {t('one_way')}
                </label>
                <label className="flex items-center gap-2 cursor-not-allowed opacity-60">
                    <div className="w-4 h-4 rounded-full border-2 border-white/30" />
                    {t('round_trip')}
                </label>
            </div>
        </div>
    );


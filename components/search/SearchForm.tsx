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
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                {/* Origin */}
                <div className="md:col-span-3 lg:col-span-3 relative group">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none z-10">
                        <Plane className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <div className="pl-1">
                        <CitySearchInput
                            placeholder={t('origin_placeholder')}
                            onSelect={setOrigin}
                            className="pl-10 h-14 w-full bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-xl transition-all"
                        />
                    </div>
                </div>

                {/* Destination */}
                <div className="md:col-span-3 lg:col-span-3 relative group">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none z-10">
                        <Plane className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors rotate-90" />
                    </div>
                    <div className="pl-1">
                        <CitySearchInput
                            placeholder={t('destination_placeholder')}
                            onSelect={setDestination}
                            className="pl-10 h-14 w-full bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-xl transition-all"
                        />
                    </div>
                </div>

                {/* Date */}
                <div className="md:col-span-3 lg:col-span-2">
                    <DatePicker
                        date={date}
                        setDate={setDate}
                        locale={locale as any}
                        className="h-14 w-full bg-slate-50 border-slate-200 rounded-xl"
                    />
                </div>

                {/* Passengers */}
                <div className="md:col-span-3 lg:col-span-2">
                    <PassengerSelector
                        adults={adults}
                        setAdults={setAdults}
                        childrenCount={childrenCount}
                        setChildrenCount={setChildrenCount}
                        infants={infants}
                        setInfants={setInfants}
                        cabin={cabin}
                        setCabin={setCabin}
                        className="h-14 w-full"
                    />
                </div>

                {/* Button */}
                <div className="md:col-span-12 lg:col-span-2">
                    <Button
                        onClick={handleSearch}
                        disabled={!origin || !destination || !date}
                        className="w-full h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02] active:scale-95 text-lg"
                    >
                        <Search className="mr-2 h-5 w-5" />
                        {t('search_button')}
                    </Button>
                </div>
            </div>

            {/* Quick Filters / Class Selection (Optional Future) */}
            <div className="flex gap-4 text-sm text-slate-500 px-2 justify-center md:justify-start">
                <label className="flex items-center gap-2 cursor-pointer hover:text-blue-600 group transition-colors">
                    <div className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center group-hover:border-blue-400">
                        <div className="w-2 h-2 bg-blue-600 rounded-full" />
                    </div>
                    {t('one_way')}
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:text-blue-600 group transition-colors opacity-50 cursor-not-allowed" title="Coming soon">
                    <div className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center group-hover:border-blue-400">
                    </div>
                    {t('round_trip')}
                </label>
            </div>
        </div>
    );
}


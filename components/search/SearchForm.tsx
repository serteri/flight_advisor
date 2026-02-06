'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { Button } from "@/components/ui/button";
import { Search, Plane } from "lucide-react";
import { CitySearchInput } from "@/components/CitySearchInput";
import { DatePicker } from "@/components/DatePicker";
import { useTranslations, useLocale } from 'next-intl';

export function SearchForm() {
    const t = useTranslations('SearchForm');
    const locale = useLocale();
    const router = useRouter();
    const [origin, setOrigin] = useState<any>(null);
    const [destination, setDestination] = useState<any>(null);
    const [date, setDate] = useState<Date | undefined>(new Date());

    const handleSearch = () => {
        if (origin && destination && date) {
            const dateStr = date.toISOString().split('T')[0];
            router.push(`/flight-search?origin=${origin.iata}&destination=${destination.iata}&date=${dateStr}`);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Origin */}
                <div className="md:col-span-4 relative group">
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
                <div className="md:col-span-4 relative group">
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
                <div className="md:col-span-2">
                    <DatePicker
                        date={date}
                        setDate={setDate}
                        locale={locale as any}
                        className="h-14 w-full bg-slate-50 border-slate-200 rounded-xl"
                    />
                </div>

                {/* Button */}
                <div className="md:col-span-2">
                    <Button
                        onClick={handleSearch}
                        disabled={!origin || !destination || !date}
                        className="w-full h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02] active:scale-95"
                    >
                        <Search className="mr-2 h-5 w-5" />
                        {t('search_button')}
                    </Button>
                </div>
            </div>

            {/* Quick Filters / Class Selection (Optional Future) */}
            <div className="flex gap-4 text-sm text-slate-500 px-2">
                <label className="flex items-center gap-2 cursor-pointer hover:text-blue-600">
                    <input type="radio" name="tripType" defaultChecked className="accent-blue-600" /> {t('one_way')}
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:text-blue-600">
                    <input type="radio" name="tripType" className="accent-blue-600" /> {t('round_trip')}
                </label>
            </div>
        </div>
    );
}


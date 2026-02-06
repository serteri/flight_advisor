"use client";

import { useState, useEffect } from "react";
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, isBefore, startOfDay } from "date-fns";
import { tr, de, enUS } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

interface DatePickerProps {
    label?: string;
    placeholder?: string;
    error?: string;
    disabled?: boolean;
    value?: string; // YYYY-MM-DD
    onChange?: (date: string) => void;
    minDate?: Date;
    locale?: "en" | "tr" | "de";

    // Alternative API (React state setters)
    date?: Date | undefined;
    setDate?: (date: Date | undefined) => void;
    className?: string;
}

const localeMap = {
    en: enUS,
    tr: tr,
    de: de,
};

const weekDays = {
    en: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
    tr: ["Pz", "Pt", "Sa", "Ça", "Pe", "Cu", "Ct"],
    de: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
};

export function DatePicker({
    label,
    placeholder,
    error,
    disabled = false,
    value,
    onChange,
    minDate,
    locale = "tr",
    date,
    setDate,
    className
}: DatePickerProps) {
    const [selected, setSelected] = useState<Date | undefined>(
        date || (value ? new Date(value) : undefined)
    );
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(date || (value ? new Date(value) : new Date()));

    const dateLocale = localeMap[locale] || localeMap.tr;
    const days = weekDays[locale] || weekDays.tr;

    useEffect(() => {
        if (date && date !== selected) {
            setSelected(date);
        } else if (value && value !== format(selected || new Date(0), "yyyy-MM-dd")) {
            setSelected(new Date(value));
        }
    }, [value, selected, date]);

    const handleSelect = (selectedDate: Date) => {
        setSelected(selectedDate);

        // Call appropriate callback
        if (setDate) {
            setDate(selectedDate);
        }
        if (onChange) {
            onChange(format(selectedDate, "yyyy-MM-dd"));
        }
        setIsOpen(false);
    };

    const minDateToUse = minDate ? startOfDay(minDate) : startOfDay(new Date());

    // Generate calendar days for current and next month
    const generateCalendarDays = (month: Date) => {
        const start = startOfMonth(month);
        const end = endOfMonth(month);
        const daysInMonth = eachDayOfInterval({ start, end });

        // Get the day of week for the first day (0 = Sunday)
        const startDayOfWeek = start.getDay();

        // Add empty slots for days before the first day
        const emptySlots = Array(startDayOfWeek).fill(null);

        return [...emptySlots, ...daysInMonth];
    };

    const currentMonthDays = generateCalendarDays(currentMonth);
    const nextMonthDate = addMonths(currentMonth, 1);
    const nextMonthDays = generateCalendarDays(nextMonthDate);

    const isDateDisabled = (date: Date) => {
        return isBefore(date, minDateToUse);
    };

    return (
        <div className="relative">
            <label className="text-sm font-semibold mb-2 block text-slate-700">
                {label}
            </label>

            {/* Input trigger */}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`
                    w-full h-12 px-4 pl-12 text-left relative
                    bg-white border rounded-xl
                    hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200
                    transition-all duration-200
                    ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'cursor-pointer'}
                    ${error ? 'border-red-500' : 'border-slate-200'}
                    ${selected ? 'text-slate-900' : 'text-slate-400'}
                `}
            >
                <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                {selected ? format(selected, "d MMMM yyyy", { locale: dateLocale }) : (placeholder || "Tarih seçin")}
            </button>

            {/* Calendar Dropdown */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Calendar popover */}
                    <div className="absolute left-0 z-50 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 animate-in fade-in-0 zoom-in-95">
                        {/* Two months side by side */}
                        <div className="flex gap-8">
                            {/* Month 1 */}
                            <div className="w-[280px]">
                                {/* Month Header */}
                                <div className="flex items-center justify-between mb-4">
                                    <button
                                        type="button"
                                        onClick={() => setCurrentMonth(prev => addMonths(prev, -1))}
                                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                    >
                                        <ChevronLeft className="h-4 w-4 text-slate-600" />
                                    </button>
                                    <h3 className="font-semibold text-slate-900">
                                        {format(currentMonth, "MMMM yyyy", { locale: dateLocale })}
                                    </h3>
                                    <div className="w-8" /> {/* Spacer */}
                                </div>

                                {/* Weekday headers */}
                                <div className="grid grid-cols-7 gap-1 mb-2">
                                    {days.map(day => (
                                        <div key={day} className="h-8 flex items-center justify-center text-xs font-medium text-slate-400">
                                            {day}
                                        </div>
                                    ))}
                                </div>

                                {/* Days grid */}
                                <div className="grid grid-cols-7 gap-1">
                                    {currentMonthDays.map((day, idx) => (
                                        <div key={idx} className="aspect-square">
                                            {day ? (
                                                <button
                                                    type="button"
                                                    onClick={() => !isDateDisabled(day) && handleSelect(day)}
                                                    disabled={isDateDisabled(day)}
                                                    className={`
                                                        w-full h-full rounded-lg text-sm font-medium
                                                        transition-all duration-150
                                                        ${isDateDisabled(day)
                                                            ? 'text-slate-200 cursor-not-allowed'
                                                            : 'hover:bg-blue-50 hover:text-blue-600 cursor-pointer'
                                                        }
                                                        ${selected && isSameDay(day, selected)
                                                            ? 'bg-blue-600 text-white hover:bg-blue-700 hover:text-white'
                                                            : ''
                                                        }
                                                        ${isToday(day) && !selected?.getTime()
                                                            ? 'bg-slate-100 font-bold'
                                                            : ''
                                                        }
                                                        ${!isDateDisabled(day) && !selected?.getTime()
                                                            ? 'text-slate-700'
                                                            : ''
                                                        }
                                                    `}
                                                >
                                                    {format(day, "d")}
                                                </button>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="w-px bg-slate-200" />

                            {/* Month 2 */}
                            <div className="w-[280px]">
                                {/* Month Header */}
                                <div className="flex items-center justify-between mb-4">
                                    <div className="w-8" /> {/* Spacer */}
                                    <h3 className="font-semibold text-slate-900">
                                        {format(nextMonthDate, "MMMM yyyy", { locale: dateLocale })}
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
                                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                    >
                                        <ChevronRight className="h-4 w-4 text-slate-600" />
                                    </button>
                                </div>

                                {/* Weekday headers */}
                                <div className="grid grid-cols-7 gap-1 mb-2">
                                    {days.map(day => (
                                        <div key={day} className="h-8 flex items-center justify-center text-xs font-medium text-slate-400">
                                            {day}
                                        </div>
                                    ))}
                                </div>

                                {/* Days grid */}
                                <div className="grid grid-cols-7 gap-1">
                                    {nextMonthDays.map((day, idx) => (
                                        <div key={idx} className="aspect-square">
                                            {day ? (
                                                <button
                                                    type="button"
                                                    onClick={() => !isDateDisabled(day) && handleSelect(day)}
                                                    disabled={isDateDisabled(day)}
                                                    className={`
                                                        w-full h-full rounded-lg text-sm font-medium
                                                        transition-all duration-150
                                                        ${isDateDisabled(day)
                                                            ? 'text-slate-200 cursor-not-allowed'
                                                            : 'hover:bg-blue-50 hover:text-blue-600 cursor-pointer'
                                                        }
                                                        ${selected && isSameDay(day, selected)
                                                            ? 'bg-blue-600 text-white hover:bg-blue-700 hover:text-white'
                                                            : ''
                                                        }
                                                        ${isToday(day) && !selected?.getTime()
                                                            ? 'bg-slate-100 font-bold'
                                                            : ''
                                                        }
                                                        ${!isDateDisabled(day) && !selected?.getTime()
                                                            ? 'text-slate-700'
                                                            : ''
                                                        }
                                                    `}
                                                >
                                                    {format(day, "d")}
                                                </button>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Footer with quick actions */}
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setCurrentMonth(new Date())}
                                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                            >
                                Bugüne Git
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="text-xs text-slate-500 hover:text-slate-700"
                            >
                                Kapat
                            </button>
                        </div>
                    </div>
                </>
            )}

            {error && (
                <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                    {error}
                </p>
            )}
        </div>
    );
}

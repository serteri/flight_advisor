import { useState, useEffect, useRef } from "react";
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, isBefore, startOfDay } from "date-fns";
import { tr, de, enUS } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslations } from 'next-intl';

interface DatePickerProps {
    label?: string;
    placeholder?: string;
    error?: string;
    disabled?: boolean;
    value?: string; // YYYY-MM-DD
    onChange?: (date: string) => void;
    minDate?: Date;
    locale?: "en" | "tr" | "de";
    variant?: "default" | "ghost";

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
    locale = "en",
    variant = "default",
    date,
    setDate,
    className
}: DatePickerProps) {
    const t = useTranslations('DatePicker');
    const [selected, setSelected] = useState<Date | undefined>(
        date || (value ? new Date(value) : undefined)
    );
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(date || (value ? new Date(value) : new Date()));
    const containerRef = useRef<HTMLDivElement>(null);

    // Fallback to enUS if locale is not found
    const dateLocale = localeMap[locale] || localeMap.en;
    const days = weekDays[locale] || weekDays.en;

    useEffect(() => {
        if (date && date !== selected) {
            setSelected(date);
        } else if (value && value !== format(selected || new Date(0), "yyyy-MM-dd")) {
            setSelected(new Date(value));
        }
    }, [value, selected, date]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (selectedDate: Date) => {
        const newDate = startOfDay(selectedDate);
        setSelected(newDate);

        // Call appropriate callback
        if (setDate) {
            setDate(newDate);
        }
        if (onChange) {
            onChange(format(newDate, "yyyy-MM-dd"));
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
        <div className="relative" ref={containerRef}>
            {label && variant === "default" && (
                <label className="text-sm font-semibold mb-2 block text-slate-700">
                    {label}
                </label>
            )}

            {/* Input trigger */}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`
                    w-full pl-0 relative
                    flex transition-all duration-200 text-left cursor-pointer
                    ${variant === 'default'
                        ? 'items-center h-14 px-4 pl-12 bg-white border rounded-xl hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
                        : 'flex-col justify-center h-full px-4 md:px-6 bg-transparent border-0 hover:bg-slate-100/80 rounded-lg'
                    }
                    ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}
                    ${error ? 'border-red-500' : (variant === 'default' ? 'border-slate-200' : '')}
                    ${selected && variant === 'default' ? 'text-slate-900 border-blue-500 ring-1 ring-blue-100' : (selected ? 'text-slate-900' : 'text-slate-400')}
                    ${className}
                `}
            >
                {variant === "default" && (
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-md bg-blue-50 text-blue-600">
                        <CalendarIcon className="h-4 w-4" />
                    </div>
                )}

                {variant === "ghost" && label && (
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5 pointer-events-none">
                        {label}
                    </div>
                )}

                <div className={`flex flex-col justify-center ${variant === "default" ? "h-full" : ""}`}>
                    {selected
                        ? (
                            <div className={`flex flex-col items-start justify-center ${variant === "ghost" ? "gap-0" : ""}`}>
                                {variant === "default" && (
                                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider leading-none mb-1">
                                        {format(selected, "EEEE", { locale: dateLocale })}
                                    </span>
                                )}
                                <span className={`font-bold text-slate-900 leading-none ${variant === "ghost" ? "text-xl md:text-2xl font-black" : "text-lg"}`}>
                                    {format(selected, variant === "ghost" ? "d MMM yy" : "d MMMM yyyy", { locale: dateLocale })}
                                </span>
                            </div>
                        )
                        : <span className={`${variant === "ghost" ? "text-xl md:text-2xl font-bold" : "text-lg font-semibold"} text-slate-400`}>{placeholder || t('placeholder')}</span>
                    }
                </div>
            </button>

            {/* Calendar Popover */}
            {
                isOpen && (
                    <div className="absolute top-full right-0 md:right-0 md:translate-x-1/4 z-[60] mt-4 bg-white rounded-3xl shadow-2xl shadow-blue-900/20 border border-slate-100 animate-in fade-in zoom-in-95 origin-top-right xl:w-[670px] w-[320px] overflow-hidden">
                        {/* Header Controls */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-white">
                            <button
                                type="button"
                                onClick={() => setCurrentMonth(prev => addMonths(prev, -1))}
                                className="p-2 hover:bg-slate-50 rounded-lg transition-colors text-slate-500 hover:text-blue-600 disabled:opacity-30"
                                disabled={isBefore(addMonths(currentMonth, -1), startOfMonth(minDateToUse))}
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </button>

                            <div className="flex-1 flex justify-center md:justify-start md:pl-10 font-bold text-slate-800 text-lg">
                                {/* Mobile view only shows one title, desktop shows 2 via grid below, but we can simplify header logic */}
                                <span className="xl:hidden">
                                    {format(currentMonth, "MMMM yyyy", { locale: dateLocale })}
                                </span>
                            </div>

                            <button
                                type="button"
                                onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
                                className="p-2 hover:bg-slate-50 rounded-lg transition-colors text-slate-500 hover:text-blue-600"
                            >
                                <ChevronRight className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="flex flex-col xl:flex-row">
                            {/* Month 1 */}
                            <div className="p-4 w-full xl:w-1/2 xl:border-r border-slate-100">
                                <div className="text-center font-bold text-slate-800 mb-4 hidden xl:block">
                                    {format(currentMonth, "MMMM yyyy", { locale: dateLocale })}
                                </div>

                                {/* Weekdays */}
                                <div className="grid grid-cols-7 mb-2">
                                    {days.map(day => (
                                        <div key={day} className="h-8 flex items-center justify-center text-xs font-bold text-slate-400">
                                            {day}
                                        </div>
                                    ))}
                                </div>

                                {/* Days */}
                                <div className="grid grid-cols-7 gap-1">
                                    {currentMonthDays.map((day, idx) => (
                                        <div key={idx} className="aspect-square relative flex items-center justify-center">
                                            {day ? (
                                                <button
                                                    type="button"
                                                    onClick={() => !isDateDisabled(day) && handleSelect(day)}
                                                    disabled={isDateDisabled(day)}
                                                    className={`
                                                    w-9 h-9 rounded-full text-sm font-medium transition-all
                                                    ${selected && isSameDay(day, selected)
                                                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                                                            : isDateDisabled(day)
                                                                ? 'text-slate-300 cursor-not-allowed'
                                                                : 'text-slate-700 hover:bg-blue-50 hover:text-blue-600'
                                                        }
                                                    ${isToday(day) && !selected ? 'ring-1 ring-blue-600 text-blue-600 font-bold' : ''}
                                                `}
                                                >
                                                    {format(day, "d")}
                                                </button>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Month 2 (Hidden on Mobile/Tablet/Small Laptop) */}
                            <div className="p-4 w-full xl:w-1/2 hidden xl:block">
                                <div className="text-center font-bold text-slate-800 mb-4">
                                    {format(nextMonthDate, "MMMM yyyy", { locale: dateLocale })}
                                </div>

                                {/* Weekdays */}
                                <div className="grid grid-cols-7 mb-2">
                                    {days.map(day => (
                                        <div key={day} className="h-8 flex items-center justify-center text-xs font-bold text-slate-400">
                                            {day}
                                        </div>
                                    ))}
                                </div>

                                {/* Days */}
                                <div className="grid grid-cols-7 gap-1">
                                    {nextMonthDays.map((day, idx) => (
                                        <div key={idx} className="aspect-square relative flex items-center justify-center">
                                            {day ? (
                                                <button
                                                    type="button"
                                                    onClick={() => !isDateDisabled(day) && handleSelect(day)}
                                                    disabled={isDateDisabled(day)}
                                                    className={`
                                                    w-9 h-9 rounded-full text-sm font-medium transition-all
                                                    ${selected && isSameDay(day, selected)
                                                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                                                            : isDateDisabled(day)
                                                                ? 'text-slate-300 cursor-not-allowed'
                                                                : 'text-slate-700 hover:bg-blue-50 hover:text-blue-600'
                                                        }
                                                    ${isToday(day) && !selected ? 'ring-1 ring-blue-600 text-blue-600 font-bold' : ''}
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

                        {/* Footer */}
                        <div className="flex items-center justify-between p-3 border-t border-slate-100 bg-slate-50/50">
                            <button
                                type="button"
                                onClick={() => handleSelect(new Date())}
                                className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                            >
                                {t('today')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                                {t('close')}
                            </button>
                        </div>
                    </div>
                )
            }

            {
                error && (
                    <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                        {error}
                    </p>
                )
            }
        </div >
    );
}

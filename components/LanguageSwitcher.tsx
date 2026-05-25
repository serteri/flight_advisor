"use client";

import { usePathname, useRouter } from "@/i18n/routing";
import { useLocale } from "next-intl";
import { Check, ChevronDown, Globe } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function LanguageSwitcher() {
    const router = useRouter();
    const pathname = usePathname();
    const locale = useLocale();
    const [open, setOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", onClickOutside);
        return () => document.removeEventListener("mousedown", onClickOutside);
    }, []);

    const switchLocale = (locale: string) => {
        router.replace(pathname, { locale: locale as "en" | "tr" | "de" });
        setOpen(false);
    };

    const localeOptions = ["en", "tr", "de"] as const;
    const currentLocale = locale.toUpperCase();

    return (
        <div className="relative" ref={menuRef}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label="Switch language"
            >
                <Globe size={14} className="text-slate-500" />
                <span>{currentLocale}</span>
                <ChevronDown size={14} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
            </button>

            {open && (
                <div className="absolute right-0 top-[calc(100%+8px)] min-w-[120px] rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                    {localeOptions.map((code) => {
                        const isActive = code === locale;

                        return (
                            <button
                                key={code}
                                type="button"
                                onClick={() => switchLocale(code)}
                                className="w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                <span>{code.toUpperCase()}</span>
                                {isActive && <Check size={14} className="text-sky-600" />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

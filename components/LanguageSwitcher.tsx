"use client";

import { usePathname, useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

export function LanguageSwitcher() {
    const router = useRouter();
    const pathname = usePathname();

    const switchLocale = (locale: string) => {
        router.replace(pathname, { locale: locale as "en" | "tr" | "de" });
    };

    return (
        <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => switchLocale("en")} className="font-semibold text-xs px-2 h-8">EN</Button>
            <span className="text-slate-300">|</span>
            <Button variant="ghost" size="sm" onClick={() => switchLocale("tr")} className="font-semibold text-xs px-2 h-8">TR</Button>
            <span className="text-slate-300">|</span>
            <Button variant="ghost" size="sm" onClick={() => switchLocale("de")} className="font-semibold text-xs px-2 h-8">DE</Button>
        </div>
    );
}

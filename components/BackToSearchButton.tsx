"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface BackToSearchButtonProps {
    fallbackUrl: string;
}

export function BackToSearchButton({ fallbackUrl }: BackToSearchButtonProps) {
    const router = useRouter();
    const [canGoBack, setCanGoBack] = useState(false);

    useEffect(() => {
        // Simple check if there is history (not perfect but better than nothing)
        // Ideally checking referrer is safer to know IF we came from search
        if (typeof window !== "undefined" && window.history.length > 1) {
            if (document.referrer.includes("/flight-search")) {
                setCanGoBack(true);
            }
        }
    }, [fallbackUrl]);

    const handleBack = (e: React.MouseEvent) => {
        if (canGoBack) {
            e.preventDefault();
            router.back();
        }
        // Otherwise let the Link default behavior happen (navigate to fallback)
    };

    return (
        <a
            href={fallbackUrl}
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 mb-6 transition-colors cursor-pointer"
        >
            <ArrowRight className="h-4 w-4 rotate-180" />
            Back to Flight Search
        </a>
    );
}

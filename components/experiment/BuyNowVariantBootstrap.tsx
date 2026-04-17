"use client";

import { useEffect, useState } from 'react';
import {
    BUY_NOW_VARIANT_CHANGE_EVENT,
    BuyNowVariantBucket,
    getBuyNowVariantBucket,
    setBuyNowVariantBucket,
} from '@/lib/experiment/buyNowVariant';

export default function BuyNowVariantBootstrap() {
    const [isOpen, setIsOpen] = useState(false);
    const [activeVariant, setActiveVariant] = useState<BuyNowVariantBucket>('A');

    useEffect(() => {
        // Assign and persist a stable A/B/C bucket on first visit.
        setActiveVariant(getBuyNowVariantBucket());

        const onVariantChange = (event: Event) => {
            const custom = event as CustomEvent<{ variant?: BuyNowVariantBucket }>;
            const next = custom?.detail?.variant;
            if (next === 'A' || next === 'B' || next === 'C') {
                setActiveVariant(next);
            }
        };

        const onShortcut = (event: KeyboardEvent) => {
            if (event.altKey && event.shiftKey && event.key.toLowerCase() === 'v') {
                event.preventDefault();
                setIsOpen((prev) => !prev);
                setActiveVariant(getBuyNowVariantBucket());
            }
        };

        window.addEventListener(BUY_NOW_VARIANT_CHANGE_EVENT, onVariantChange as EventListener);
        window.addEventListener('keydown', onShortcut);

        return () => {
            window.removeEventListener(BUY_NOW_VARIANT_CHANGE_EVENT, onVariantChange as EventListener);
            window.removeEventListener('keydown', onShortcut);
        };
    }, []);

    const applyVariant = (variant: BuyNowVariantBucket) => {
        setBuyNowVariantBucket(variant);
        setActiveVariant(variant);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[120]">
            <div className="rounded-2xl border border-sky-200/60 bg-white/80 backdrop-blur-xl shadow-[0_10px_36px_-14px_rgba(2,132,199,0.45)] px-3 py-2.5 w-[210px]">
                <div className="flex items-center justify-between mb-2">
                    <div>
                        <div className="text-[10px] uppercase tracking-wider font-black text-sky-700">Variant Switcher</div>
                        <div className="text-[11px] text-slate-500">Alt + Shift + V</div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="text-xs text-slate-500 hover:text-slate-800 rounded-full px-2 py-1 hover:bg-slate-100 transition-colors"
                        aria-label="Close variant switcher"
                    >
                        ✕
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    {(['A', 'B', 'C'] as const).map((variant) => {
                        const active = activeVariant === variant;
                        return (
                            <button
                                key={variant}
                                type="button"
                                onClick={() => applyVariant(variant)}
                                className={`h-8 w-8 rounded-full text-xs font-bold transition-all ${
                                    active
                                        ? 'bg-gradient-to-br from-sky-600 to-blue-700 text-white shadow-md shadow-sky-500/30'
                                        : 'bg-slate-100 text-slate-600 hover:bg-sky-100 hover:text-sky-700'
                                }`}
                                aria-pressed={active}
                            >
                                {variant}
                            </button>
                        );
                    })}
                    <span className="text-[11px] text-slate-600 ml-1">Active: {activeVariant}</span>
                </div>
            </div>
        </div>
    );
}

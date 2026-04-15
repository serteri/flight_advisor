'use client';

import { useTranslations } from 'next-intl';
import { Lock, Wifi, Utensils, Luggage, Eye, BellRing, Info, Shield } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { FlightDetailDialog } from '@/components/FlightDetailDialog';
import { LockedFeatureOverlay, PremiumBadge } from '@/components/ui/LockedFeature';
import type { UserTier } from '@/lib/tierUtils';
import { getCanonicalMealLabel, getWifiStatus, hasAnyMeal } from '@/lib/meal-utils';
import { DEFAULT_AIRLINE_LOGO, getAirlineLogoCandidates } from '@/lib/airline-logo-utils';

export default function FlightResultCard({ 
    flight, 
    isPremium = false, 
    userTier = 'FREE',
    championBadge,
    onUserAction,
    selectionContext
}: { 
    flight: any; 
    isPremium?: boolean; 
    userTier?: UserTier;
    championBadge?: 'Best Overall' | 'Best Value' | 'Lowest Risk' | 'Fastest';
    onUserAction?: (action: 'BOOK_CLICKED' | 'DECISION_CLICKED' | 'DECISION_SHOWN' | 'TRACK_CLICKED') => void;
    selectionContext?: {
        rank?: number;
        totalResults?: number;
        competitorPrice?: number | null;
        competitorScore?: number | null;
    };
}) {
    const t = useTranslations('Results');
    const [showScore, setShowScore] = useState(isPremium);
    const [showDetails, setShowDetails] = useState(false);
    const [showLockOverlay, setShowLockOverlay] = useState(false);
    const [decisionTracked, setDecisionTracked] = useState(false);
    
    // Safety check: if flight data is missing critical fields, render error
    if (!flight || !flight.id) {
        console.error('[FlightResultCard] Invalid flight data:', flight);
        return (
            <div className="bg-red-50 rounded-[16px] p-5 border-2 border-red-200 text-red-700">
                <p className="font-semibold">❌ Flight data error. Please try again.</p>
            </div>
        );
    }

    // Safe extract required fields with fallbacks
    const departureTime = flight.departureTime || flight.departTime;
    const arrivalTime = flight.arrivalTime || flight.arriveTime;
    const airline = flight.airline || 'Unknown Airline';
    const flightNumber = flight.flightNumber || 'N/A';
    const source = flight.source || 'UNKNOWN';
    const origin = flight.origin || flight.from || 'XXX';
    const destination = flight.destination || flight.to || 'XXX';
    const price = flight.price || 0;
    const stops = flight.stops ?? 0;
    const duration = flight.duration || 0;
    const hasMeal = hasAnyMeal(flight);
    const wifiStatus = getWifiStatus(flight);

    const toText = (value: any, fallback: string) => {
        if (typeof value === 'string') return value;
        if (typeof value === 'number') return String(value);
        if (value && typeof value === 'object') {
            return value.iataCode || value.iata_code || value.iata || value.code || value.city || value.city_name || value.name || fallback;
        }
        return fallback;
    };

    const originText = toText(origin, 'XXX');
    const destinationText = toText(destination, 'XXX');

    const airlineLogoCandidates = useMemo(() => {
        return getAirlineLogoCandidates(flight);
    }, [flight]);

    const [logoIndex, setLogoIndex] = useState(0);
    useEffect(() => {
        setLogoIndex(0);
    }, [airlineLogoCandidates]);

    const airlineLogo = airlineLogoCandidates[logoIndex] || DEFAULT_AIRLINE_LOGO;

    const formatLocalTime = (value: any) => {
        if (!value) return '--:--';
        if (typeof value === 'string') {
            const match = value.match(/(\d{2}:\d{2})/);
            return match ? match[1] : value;
        }
        try {
            return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
            return '--:--';
        }
    };

    const formatDuration = (mins: number) => {
        if (!mins || Number.isNaN(mins)) return '0h 0m';
        const h = Math.floor(mins / 60);
        const m = Math.round(mins % 60);
        return `${h}h ${m}m`;
    };

    const hasExplicitTimezone = (value: string) => /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim());

    const toCode = (value: any): string => {
        if (!value) return '';
        if (typeof value === 'string') return value.toUpperCase();
        if (typeof value === 'object') {
            const code = value.iata || value.iata_code || value.iataCode || value.code || value.id;
            if (code) return String(code).toUpperCase();
        }
        return '';
    };

    const parseIsoDateToUtcMs = (value: string): number => {
        const text = value.trim();
        if (!text) return NaN;
        if (!hasExplicitTimezone(text)) return NaN;
        const timestamp = new Date(text).getTime();
        return Number.isFinite(timestamp) ? timestamp : NaN;
    };

    const parseMinutes = (value: unknown): number => {
        if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value);
        if (typeof value === 'string') {
            const iso = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
            if (iso) {
                const h = parseInt(iso[1] || '0', 10);
                const m = parseInt(iso[2] || '0', 10);
                return h * 60 + m;
            }
            const hm = value.match(/(\d+)\s*h\s*(\d+)?\s*m?/i);
            if (hm) {
                const h = parseInt(hm[1] || '0', 10);
                const m = parseInt(hm[2] || '0', 10);
                return h * 60 + m;
            }
            const mins = value.match(/(\d+)\s*m(in)?/i);
            if (mins) return parseInt(mins[1], 10);
        }
        return 0;
    };

    const getSegmentDurationMinutes = (seg: any, fallbackMinutes: number) => {
        if (typeof seg?.duration === 'number') return seg.duration;
        if (typeof seg?.duration === 'string') {
            const isoMatch = seg.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
            if (isoMatch) {
                const hours = parseInt(isoMatch[1] || '0', 10);
                const mins = parseInt(isoMatch[2] || '0', 10);
                return hours * 60 + mins;
            }

            const hasHours = seg.duration.includes('h') || seg.duration.includes('H');
            const numbers = seg.duration.match(/(\d+)/g)?.map(Number) || [];
            if (hasHours) {
                const hours = numbers[0] || 0;
                const mins = numbers[1] || 0;
                return hours * 60 + mins;
            }
            if (numbers[0]) return numbers[0];
        }

        const dep = seg?.departure || seg?.departing_at || seg?.departure_time || seg?.departure_at;
        const arr = seg?.arrival || seg?.arriving_at || seg?.arrival_time || seg?.arrival_at;
        if (dep && arr) {
            const depMs = parseIsoDateToUtcMs(String(dep));
            const arrMs = parseIsoDateToUtcMs(String(arr));
            if (!Number.isNaN(depMs) && !Number.isNaN(arrMs)) {
                return Math.max(0, Math.round((arrMs - depMs) / 60000));
            }
        }

        return fallbackMinutes;
    };

    const segments = Array.isArray(flight.segments) ? flight.segments : [];
    const bookingUrl =
        (typeof flight.deepLink === 'string' && flight.deepLink) ||
        (typeof flight.bookingLink === 'string' && flight.bookingLink) ||
        (Array.isArray(flight.bookingProviders) && flight.bookingProviders[0]?.link) ||
        '';

    const carrierSummary = useMemo(() => {
        const entries: Array<{ name: string; logo: string }> = [];
        const seen = new Set<string>();

        for (const seg of segments) {
            const name = String(
                seg?.operatingAirlineName ||
                seg?.operatingAirline ||
                seg?.marketingAirlineName ||
                seg?.marketingAirline ||
                seg?.airline ||
                ''
            ).trim();
            if (!name) continue;

            const key = name.toUpperCase();
            if (seen.has(key)) continue;
            seen.add(key);

            const segLogoCandidates = getAirlineLogoCandidates({
                airlineLogo: seg?.airlineLogo,
                segments: [
                    {
                        airlineLogo: seg?.airlineLogo,
                        marketingAirline: seg?.marketingAirlineCode || seg?.marketingAirline,
                        carrierCode: seg?.operatingAirlineCode || seg?.operatingAirline,
                        airlineCode: seg?.airlineCode,
                    },
                ],
            } as any);

            entries.push({
                name,
                logo: segLogoCandidates[0] || DEFAULT_AIRLINE_LOGO,
            });
        }

        if (entries.length === 0) {
            return [{ name: airline, logo: airlineLogo }];
        }

        return entries;
    }, [segments, airline, airlineLogo]);

    const carrierSummaryText =
        carrierSummary.length > 1
            ? carrierSummary.map(e => e.name).join(' + ')
            : (carrierSummary[0]?.name || airline);
    const segmentsTotalMinutes = segments.reduce((sum: number, seg: any) => sum + getSegmentDurationMinutes(seg, 0), 0);
    const layoversTotalMinutes = Array.isArray(flight.layovers)
        ? flight.layovers.reduce((sum: number, layover: any) => sum + parseMinutes(layover?.duration), 0)
        : 0;
    const assembledTotalMinutes = segmentsTotalMinutes + layoversTotalMinutes;
    const endpointTotalMinutes = Math.max(0, Math.round((new Date(arrivalTime).getTime() - new Date(departureTime).getTime()) / 60000));
    const totalDurationMinutes = duration > 0
        ? duration
        : assembledTotalMinutes > 0
            ? assembledTotalMinutes
            : endpointTotalMinutes;

    const trackingCompetitorPrice =
        Number.isFinite(Number(selectionContext?.competitorPrice))
            ? Number(selectionContext?.competitorPrice)
            : Array.isArray(flight.bookingProviders) && flight.bookingProviders.length > 1
                ? Number(flight.bookingProviders[1]?.price || 0)
                : null;

    const trackingCompetitorScore =
        Number.isFinite(Number(selectionContext?.competitorScore))
            ? Number(selectionContext?.competitorScore)
            : null;

    const totalDurationLabel = (() => {
        const localeCode = (typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : '').toLowerCase();
        if (localeCode === 'tr') return 'Toplam süre';
        if (localeCode === 'de') return 'Gesamtdauer';
        return 'Total duration';
    })();

    // Validate critical date fields
    if (!departureTime || !arrivalTime) {
        console.error('[FlightResultCard] Missing time fields:', { departureTime, arrivalTime });
        return (
            <div className="bg-red-50 rounded-[16px] p-5 border-2 border-red-200 text-red-700">
                <p className="font-semibold">❌ Invalid flight times. Please try again.</p>
            </div>
        );
    }

    const hasPremiumAccess = isPremium || userTier === 'PRO' || userTier === 'ELITE';
    const isPremiumUser = hasPremiumAccess;
    const hasEliteAccess = userTier === 'ELITE';
    const displayPrice = Number.isFinite(price) && price > 0 ? Math.max(1, Math.round(price)) : null;
    const displayOriginalPrice = displayPrice ? Math.max(displayPrice, Math.round(displayPrice * 1.15)) : null;
    const estimatedTotalCost = flight.advancedScore?.estimatedTotalCost;
    const personalBias = flight.advancedScore?.personalBias;
    const decisionRecommendation = String(flight.advancedScore?.decisionRecommendation || '').toUpperCase();
    const sourceLabel = source === 'DUFFEL' ? 'DUFFEL' : (source === 'PRICELINE' || source === 'SERPAPI') ? 'PRICELINE' : 'KIWI';
    const sourceSubLabel = source === 'DUFFEL' ? '🏛️ Duffel' : (source === 'PRICELINE' || source === 'SERPAPI') ? '⚡ Priceline' : '🌐 Kiwi';
    const hasInvalidData = flight.advancedScore?.dataQuality === 'invalid';
    const localizeValueTag = (tag: string) => {
        const locale = (typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : '').toLowerCase();
        const isEnglish = locale === 'en';
        if (!isEnglish) return tag;

        const map: Record<string, string> = {
            'En İyi Fiyat/Performans': 'Best Value',
            'Dengeli Seçenek': 'Balanced Choice',
            'Ekonomik Seçenek': 'Budget Option',
            'En Konforlu Seçenek': 'Most Comfortable',
            'Düşük Riskli Seçenek': 'Low Risk Choice',
            'Veri Hatası': 'Data Error',
        };
        return map[tag] || tag;
    };
    const displayScore =
        typeof flight.agentScore === 'number' && Number.isFinite(flight.agentScore)
            ? flight.agentScore
            : typeof flight.advancedScore?.displayScore === 'number' && Number.isFinite(flight.advancedScore.displayScore)
                ? flight.advancedScore.displayScore
                : typeof flight.score === 'number' && Number.isFinite(flight.score)
                    ? flight.score
                    : 0;

        const localeCode = (typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : '').toLowerCase();
        const isTrLocale = localeCode === 'tr';

        const mealLabel = getCanonicalMealLabel(flight, localeCode);

        const wifiLabel =
                wifiStatus === 'available'
                        ? t('wifi_available')
                        : wifiStatus === 'check_with_airline'
                            ? (isTrLocale ? 'Havayoluna sor' : 'Check airline')
                            : wifiStatus === 'unknown'
                                ? (isTrLocale ? 'Bilgi yok' : 'Info unavailable')
                                : t('wifi_none');

    const sendSelectionEvent = (action: 'BOOK_CLICKED' | 'DECISION_CLICKED' | 'DECISION_SHOWN' | 'TRACK_CLICKED') => {
        const departureHour = departureTime ? new Date(departureTime).getUTCHours() : null;
        const isNight = Number.isFinite(Number(departureHour))
            ? Number(departureHour) >= 18 || Number(departureHour) < 6
            : false;
        const payload = {
            action,
            flightId: flight.id,
            flightNumber,
            airline,
            provider: source,
            origin: originText,
            destination: destinationText,
            departureDate: String(departureTime || '').slice(0, 10),
            selectedPrice: Number(price) || null,
            selectedScore: Number.isFinite(displayScore) ? displayScore : null,
            competitorPrice: trackingCompetitorPrice,
            competitorScore: trackingCompetitorScore,
            routeAveragePrice: Number(flight.advancedScore?.routeIntelligence?.avgPriceRoute || 0) || null,
            decisionRecommendation: flight.advancedScore?.decisionRecommendation || null,
            decisionConfidence: Number(flight.advancedScore?.decisionConfidence || 0) || null,
            rank: selectionContext?.rank ?? null,
            totalResults: selectionContext?.totalResults ?? null,
            currency: flight.currency || 'AUD',
            isDirect: Number(stops) === 0,
            stopCount: Number(stops || 0),
            isNight,
            departureHour,
            departTime: departureTime,
        };

        try {
            const body = JSON.stringify(payload);
            if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
                const blob = new Blob([body], { type: 'application/json' });
                navigator.sendBeacon('/api/selection-track', blob);
                return;
            }

            fetch('/api/selection-track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
                keepalive: true,
            }).catch(() => undefined);
        } catch {
            // Best effort only - never block UX.
        }
    };

    const handleTrackClick = () => {
        if (!hasPremiumAccess) {
            setShowLockOverlay(true);
            return;
        }
        sendSelectionEvent('TRACK_CLICKED');
        onUserAction?.('TRACK_CLICKED');
        alert("✅ Uçuş takibe alındı! Fiyat düşerse haber vereceğiz.");
    };

    const openCheckout = async (plan: 'PRO', billingCycle: 'monthly' | 'yearly' = 'monthly') => {
        try {
            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan, billingCycle, trial: false }),
            });
            const data = await res.json();
            if (res.ok && data?.url && typeof window !== 'undefined') {
                window.location.href = data.url;
                return;
            }
        } catch {
            // fall through to pricing
        }
        if (typeof window !== 'undefined') {
            const locale = window.location.pathname.split('/')[1] || 'en';
            window.location.href = `/${locale}/pricing`;
        }
    };

    const openOneTimeReport = () => {
        if (typeof window === 'undefined') return;
        const locale = window.location.pathname.split('/')[1] || 'en';
        const configured = process.env.NEXT_PUBLIC_ONE_TIME_REPORT_URL;
        window.location.href = configured || `/${locale}/pricing?offer=report`;
    };

    const openPricingPage = (offer: 'pro' | 'report' = 'pro') => {
        if (typeof window === 'undefined') return;
        const locale = window.location.pathname.split('/')[1] || 'en';
        window.location.href = `/${locale}/pricing?offer=${offer}`;
    };

    const handleDetailsClick = () => {
        sendSelectionEvent('DECISION_CLICKED');
        onUserAction?.('DECISION_CLICKED');
        setShowDetails(true);
    };

    const handleBookClick = () => {
        if (!bookingUrl) return;
        sendSelectionEvent('BOOK_CLICKED');
        onUserAction?.('BOOK_CLICKED');
        if (typeof window !== 'undefined') {
            window.open(bookingUrl, '_blank', 'noopener,noreferrer');
        }
    };

    const handleSeeBetterOptionsClick = () => {
        sendSelectionEvent('DECISION_CLICKED');
        onUserAction?.('DECISION_CLICKED');
        if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    useEffect(() => {
        if (decisionTracked) return;
        if (!flight?.advancedScore?.decisionRecommendation) return;

        sendSelectionEvent('DECISION_SHOWN');
        onUserAction?.('DECISION_SHOWN');
        setDecisionTracked(true);
    }, [decisionTracked, flight?.advancedScore?.decisionRecommendation]);

    const decisionAction = decisionRecommendation === 'BUY_NOW'
        ? {
            message: 'Prices are likely to increase soon.',
            context: 'This is cheaper than typical prices for this route.',
            cta: 'Book now',
            onClick: handleBookClick,
            className: 'bg-emerald-600 hover:bg-emerald-700 text-white',
        }
        : decisionRecommendation === 'WAIT'
            ? {
                message: 'Prices may drop - consider waiting.',
                context: 'Track this fare and act if the market softens further.',
                cta: 'Track this flight',
                onClick: handleTrackClick,
                className: 'bg-amber-500 hover:bg-amber-600 text-white',
            }
            : decisionRecommendation === 'AVOID'
                ? {
                    message: 'This price is higher than usual.',
                    context: 'Better-ranked options are likely above this result.',
                    cta: 'See better options',
                    onClick: handleSeeBetterOptionsClick,
                    className: 'bg-slate-900 hover:bg-slate-800 text-white',
                }
                : null;

    return (
        <div className="bg-white rounded-[16px] p-5 border-2 border-slate-200 hover:border-blue-500 transition-all shadow-sm relative group mb-4">
            {/* DEBUG INDICATOR - REMOVE LATER */}
            <div className="hidden">DEBUG: FlightResultCard Active</div>

            {/* Premium Badge (Top Right) - For PRO/ELITE users */}
            {hasPremiumAccess && (
                <div className="absolute top-3 right-3 z-20">
                    <PremiumBadge tier={userTier as 'PRO' | 'ELITE'} />
                </div>
            )}

            {championBadge && (
                <div className="absolute top-3 right-24 z-20">
                    <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-1 text-[10px] font-extrabold tracking-wide uppercase">
                        {championBadge}
                    </span>
                </div>
            )}

            {/* 🏷️ KAYNAK ETİKETİ (ÜÇLÜ MOTOR) */}
            <div className="absolute top-0 left-0 z-20">
                <span className={`text-[10px] font-black px-3 py-1 rounded-tl-[16px] rounded-br-[8px] text-white ${source === 'DUFFEL' ? 'bg-emerald-600' : 'bg-blue-600'
                    }`}>
                    {sourceLabel}
                </span>
            </div>

            {/* TRACK BUTONU (SAĞ ÜST ALTINA TAŞINDI) */}
            <button
                onClick={handleTrackClick}
                className={`absolute top-12 right-4 text-slate-400 hover:text-blue-600 flex items-center gap-1 transition-colors ${!hasPremiumAccess && 'cursor-not-allowed opacity-50'}`}
                title={t('track')}
            >
                <span className="text-[10px] font-bold">{t('track')}</span>
                <BellRing className="w-4 h-4" />
                {!hasPremiumAccess && <Lock className="w-3 h-3 ml-1 text-amber-500" />}
            </button>

            <div className="flex flex-col md:flex-row justify-between gap-4 mt-8">

                {/* SOL: Uçuş Detayları */}
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                        {/* Logo area: single logo OR all carrier logos side-by-side */}
                        {carrierSummary.length > 1 ? (
                            <div className="flex items-center gap-1 shrink-0">
                                {carrierSummary.map((entry, i) => (
                                    <div key={entry.name} className="relative w-10 h-10 rounded bg-slate-50 border border-slate-100 overflow-hidden flex items-center justify-center" style={{ marginLeft: i > 0 ? '-8px' : 0, zIndex: carrierSummary.length - i }}>
                                        <img
                                            src={entry.logo}
                                            alt={entry.name}
                                            width={40}
                                            height={40}
                                            loading="lazy"
                                            decoding="async"
                                            className="w-10 h-10 object-contain"
                                            onError={(e) => { (e.currentTarget as HTMLImageElement).src = DEFAULT_AIRLINE_LOGO; }}
                                        />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="w-12 h-12 rounded bg-slate-50 border border-slate-100 overflow-hidden flex items-center justify-center shrink-0">
                                <img
                                    src={airlineLogo}
                                    alt={airline}
                                    width={48}
                                    height={48}
                                    loading="lazy"
                                    decoding="async"
                                    className="w-12 h-12 object-contain"
                                    onError={() => {
                                        setLogoIndex((current) =>
                                            current < airlineLogoCandidates.length - 1 ? current + 1 : current
                                        );
                                    }}
                                />
                            </div>
                        )}
                        <div>
                            <h4 className="font-bold text-lg text-slate-900 leading-tight">{carrierSummaryText || airline}</h4>
                            <div className="flex gap-2 items-center mt-1">
                                <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-mono">{flightNumber}</span>
                                {/* Provider Source Badge */}
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${source === 'DUFFEL' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                                    }`}>
                                    {sourceSubLabel}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between px-2 gap-6">
                        <div className="text-left">
                            <span className="text-2xl font-black text-slate-800">
                                {formatLocalTime(departureTime)}
                            </span>
                            <p className="text-xs font-bold text-slate-400">{originText}</p>
                        </div>

                        {/* SÜRE VE AKTARMA DETAYLI */}
                        <div className="flex-1 flex flex-col items-center gap-2">
                            {/* Toplam Seyahat Süresini ve Badge'i Hesapla */}
                            {(() => {
                                const deptTime = new Date(departureTime).getTime();
                                const arrTime = new Date(arrivalTime).getTime();
                                const totalMinutes = Math.max(0, (arrTime - deptTime) / (1000 * 60));
                                const hours = Math.floor(totalMinutes / 60);
                                const mins = Math.round(totalMinutes % 60);

                                return (
                                    <div className="text-center">
                                        <span className="text-sm font-bold text-slate-700 block mb-1">
                                            {formatDuration(totalDurationMinutes)} {totalDurationLabel}
                                        </span>
                                        
                                        {/* Stops Badge - PROMINENT */}
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full font-bold text-xs ${
                                            stops === 0 
                                                ? 'bg-green-100 text-green-700' 
                                                : 'bg-orange-100 text-orange-700'
                                        }`}>
                                            {stops === 0 ? `✈️ ${t('direct')}` : `📍 ${stops} ${t('stops')}`}
                                        </span>
                                    </div>
                                );
                            })()}

                            {/* Layover Timeline */}
                            {stops > 0 && flight.layovers && flight.layovers.length > 0 && (
                                <div className="w-full bg-gradient-to-r from-slate-100 to-slate-50 p-3 rounded-lg mt-2 border border-slate-200">
                                    <div className="space-y-1.5">
                                        {flight.layovers.map((l: any, idx: number) => {
                                            const airportCode = typeof l.airport === 'string' ? l.airport : (l.airport?.iataCode || l.airport?.code || 'XXX');
                                            const durationNum = parseMinutes(l.duration);
                                            const hrs = Math.floor(durationNum / 60);
                                            const mins = durationNum % 60;
                                            const cityName = toText(l.city, airportCode);
                                            
                                            return (
                                                <div key={idx} className="flex items-center justify-between text-xs">
                                                    <div className="flex items-center gap-2 flex-1">
                                                        <span className="font-bold text-slate-900">{airportCode}</span>
                                                        <span className="text-slate-600 truncate">{cityName}</span>
                                                    </div>
                                                    <span className="font-semibold text-slate-700 whitespace-nowrap">
                                                        {hrs}h {mins}m
                                                    </span>
                                                    {idx < flight.layovers.length - 1 && (
                                                        <span className="text-slate-400 ml-1">→</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="text-right">
                            <span className="text-2xl font-black text-slate-800">
                                {formatLocalTime(arrivalTime)}
                            </span>
                            <p className="text-xs font-bold text-slate-400">{destinationText}</p>
                        </div>
                    </div>

                    {/* SEGMENT DETAILS (EACH LEG) */}
                    {segments.length > 0 && (
                        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="text-xs font-bold text-slate-500 uppercase mb-2">Flight legs</div>
                            <div className="space-y-2">
                                {segments.map((seg: any, idx: number) => {
                                    const segFrom = toText(seg.origin || seg.from || seg.departure_airport?.id, 'XXX');
                                    const segTo = toText(seg.destination || seg.to || seg.arrival_airport?.id, 'XXX');
                                    const segDep = seg.departure || seg.departing_at || seg.departure_time || seg.departure_at || seg.departure_airport?.time;
                                    const segArr = seg.arrival || seg.arriving_at || seg.arrival_time || seg.arrival_at || seg.arrival_airport?.time;
                                    const segDuration = getSegmentDurationMinutes(seg, 0);
                                    const operatingCarrier = String(seg.operatingCarrier || seg.operatingAirlineName || seg.operatingAirline || seg.airline || 'Unknown Carrier').trim();
                                    const marketingCarrier = String(seg.marketingCarrier || seg.marketingAirlineName || seg.marketingAirline || operatingCarrier).trim();
                                    const layoverAfter = Array.isArray(flight.layovers) ? flight.layovers[idx] : null;
                                    const layoverMinutes = parseMinutes(layoverAfter?.duration);
                                    const layoverAirportCode = toText(layoverAfter?.airport, segTo).toUpperCase();
                                    const layoverCity = toText(layoverAfter?.city, layoverAirportCode);

                                    return (
                                        <div key={`${segFrom}-${segTo}-${idx}`} className="flex flex-col gap-1.5">
                                            <div className="flex items-center justify-between text-sm gap-3">
                                                <span className="font-semibold text-slate-800 truncate">{segFrom} → {segTo}</span>
                                                <span className="font-semibold text-slate-700 shrink-0">{formatDuration(segDuration)}</span>
                                            </div>
                                            {/* Operating Carrier — prominent */}
                                            <div className="flex items-center gap-2">
                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-full">
                                                    ✈ {operatingCarrier}
                                                </span>
                                                {marketingCarrier && marketingCarrier !== operatingCarrier && (
                                                    <span className="text-[10px] text-slate-400 font-medium">marketed by {marketingCarrier}</span>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between text-xs text-slate-500 gap-3">
                                                <span>{formatLocalTime(segDep)} departure</span>
                                                <span>{formatLocalTime(segArr)} arrival</span>
                                            </div>
                                            {idx < segments.length - 1 && (() => {
                                                // Prefer flight.layovers, fall back to computing from adjacent segment timestamps
                                                let layMins = layoverMinutes;
                                                let layCode = layoverAirportCode;
                                                let layCity = layoverCity;
                                                if (layMins === 0) {
                                                    const nextSeg = segments[idx + 1] as any;
                                                    const curArr = seg.arriving_at || seg.arrival_time || seg.arrival;
                                                    const nextDep = nextSeg?.departing_at || nextSeg?.departure_time || nextSeg?.departure;
                                                    if (curArr && nextDep) {
                                                        const a = new Date(curArr).getTime();
                                                        const d = new Date(nextDep).getTime();
                                                        if (Number.isFinite(a) && Number.isFinite(d) && d > a) {
                                                            layMins = Math.round((d - a) / 60000);
                                                        }
                                                    }
                                                    if (!layCode) {
                                                        layCode = toText(seg.destination || seg.arrival_airport || seg.to, segTo).toUpperCase();
                                                        layCity = layCode;
                                                    }
                                                }
                                                if (layMins <= 0) return null;
                                                return (
                                                    <div className="rounded-xl border-2 border-blue-200 bg-blue-50 px-3 py-2.5 text-xs font-bold text-blue-900 shadow-sm flex items-center gap-2">
                                                        <span className="text-base">🛫</span>
                                                        <span>{formatDuration(layMins)} layover in {layCity || layCode} ({layCode})</span>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* AMENITIES (LOCKED FOR FREE USERS) */}
                    <div className="mt-5 pt-3 border-t border-slate-100">
                        {/* Amenity Content (blurred for FREE, visible for PRO) */}
                        <div className={`flex flex-wrap gap-4 ${!hasPremiumAccess ? 'filter blur-sm opacity-50 select-none pointer-events-none' : ''}`}>
                            <div className="flex items-center gap-1.5">
                                <Utensils className={`w-3.5 h-3.5 ${hasMeal ? 'text-slate-700' : 'text-slate-300'}`} />
                                <span className="text-[11px] font-medium text-slate-600">
                                    {mealLabel}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Wifi className={`w-3.5 h-3.5 ${wifiStatus === 'available' ? 'text-blue-600' : wifiStatus === 'check_with_airline' ? 'text-amber-500' : 'text-slate-300'}`} />
                                <span className="text-[11px] font-medium text-slate-600">
                                    {wifiLabel}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Luggage className={`w-3.5 h-3.5 ${flight.amenities?.baggage ? 'text-slate-700' : 'text-slate-300'}`} />
                                <span className="text-[11px] font-medium text-slate-600">
                                    {flight.policies?.baggageKg > 0
                                        ? `${flight.policies.baggageKg}kg Dahil`
                                        : String(flight.baggage || '').toLowerCase() === 'checked'
                                            ? (isTrLocale ? 'Check-in Dahil' : 'Checked Included')
                                            : String(flight.baggage || '').toLowerCase() === 'cabin'
                                                ? `${flight.policies?.cabinBagKg || 7}kg ${isTrLocale ? 'Kabin' : 'Cabin Only'}`
                                                : flight.baggageSummary?.checked || (isTrLocale ? 'Dahil Değil' : 'Not Included')}
                                </span>
                            </div>
                            
                            {/* PRO/ELITE Only: Refund/Change Info */}
                            {hasPremiumAccess && flight.policies && (
                                <>
                                    {flight.policies.refundable !== undefined && (
                                        <div className="flex items-center gap-1.5">
                                            <Shield className={`w-3.5 h-3.5 ${flight.policies.refundable ? 'text-green-600' : 'text-red-400'}`} />
                                            <span className="text-[11px] font-medium text-slate-600">
                                                {flight.policies.refundable ? '✓ Refundable' : '✗ Non-refundable'}
                                            </span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Premium callout for FREE users */}
                    {!hasPremiumAccess && (
                        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm font-semibold text-slate-900">Premium analysis locked</p>
                                <p className="text-xs text-slate-600">Don't risk overpaying. Unlock the best decision before you book.</p>
                            </div>
                            <button
                                onClick={() => setShowLockOverlay(true)}
                                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm"
                            >
                                Unlock Clear Recommendation
                            </button>
                        </div>
                    )}

                        {/* ── Intelligence Panel v2 ────────────────────────────────── */}
                        {(() => {
                            const intel = flight.advancedScore;
                            if (!intel) return null;

                            const confScore: number = intel.confidenceScore ?? 0;
                            const confColor = confScore >= 80 ? 'bg-green-500' : confScore >= 50 ? 'bg-amber-400' : 'bg-rose-400';
                            const confLabel = confScore >= 80 ? 'Yüksek' : confScore >= 50 ? 'Orta' : 'Düşük';

                            const priceIntelConfig: Record<string, { icon: string; colorClass: string; label: string }> = {
                                'Strong deal':      { icon: '🔥', colorClass: 'bg-green-100 text-green-700 border-green-300', label: 'Güçlü İndirim' },
                                'Below average':    { icon: '✅', colorClass: 'bg-emerald-100 text-emerald-700 border-emerald-300', label: 'Ortalamanın Altında' },
                                'Fair price':       { icon: '📊', colorClass: 'bg-slate-100 text-slate-600 border-slate-300', label: 'Ortalama Fiyat' },
                                'Monitor price':    { icon: '⏳', colorClass: 'bg-amber-100 text-amber-700 border-amber-300', label: 'Fiyat Yükseliyor' },
                                'Expect increase':  { icon: '📈', colorClass: 'bg-rose-100 text-rose-700 border-rose-300', label: 'Hızlı Artama Bekleniyor' },
                            };
                            const pIntel = intel.priceIntel;
                            const pConf = pIntel ? priceIntelConfig[pIntel.label] : null;

                            // ── CONNECTION: use semantic label + risk for colour ──────────────
                            const connRisk = intel.connectionRisk ?? 'low';
                            const connLabel = intel.connectionLabel ?? (stops === 0 ? 'Non-stop' : 'Good connection window');
                            const connIconMap: Record<string, string> = {
                                low: '🟢', medium: '🟡', high: '🟠', critical: '🔴',
                            };
                            const connColorMap: Record<string, string> = {
                                low:      'bg-green-100 text-green-700',
                                medium:   'bg-amber-100 text-amber-700',
                                high:     'bg-orange-100 text-orange-700',
                                critical: 'bg-rose-100 text-rose-700',
                            };

                            // ── DELAY: semantic label only, no fake % ─────────────────────────
                            const delayRiskLabel = intel.delayRiskLabel ?? 'Typical delay risk';
                            const delayCat = intel.delayProbability ?? 18; // internal proxy only, never shown raw
                            const delayColorClass = delayCat >= 28 ? 'bg-rose-100 text-rose-700' : delayCat >= 18 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700';

                            return (
                                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                                    {/* Confidence score — always visible */}
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Veri Kalitesi</span>
                                        <div className="flex items-center gap-1.5">
                                            <span className={`w-2 h-2 rounded-full ${confColor}`} />
                                            <span className="text-xs font-bold text-slate-700">{confLabel} ({confScore}%)</span>
                                        </div>
                                    </div>

                                    {/* Confidence statement — shown when score >= 60 */}
                                    {confScore >= 60 && (
                                        <div className={`rounded-lg px-3 py-2 text-xs font-semibold ${confScore >= 80 ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
                                            {confScore >= 80
                                                ? `✅ We are ${confScore}% confident this is a great deal`
                                                : `📊 We are ${confScore}% confident in this analysis`}
                                        </div>
                                    )}

                                    {/* Intel badges — blurred for FREE */}
                                    <div className={`flex flex-wrap gap-2 ${!hasPremiumAccess ? 'blur-[3px] select-none pointer-events-none' : ''}`}>
                                        {pConf && pIntel && (
                                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${pConf.colorClass}`}>
                                                {pConf.icon}{' '}
                                                {pIntel.absoluteDelta != null && pIntel.absoluteDelta > 0
                                                    ? `${flight.currency || '$'}${pIntel.absoluteDelta} cheaper than typical`
                                                    : pIntel.absoluteDelta != null && pIntel.absoluteDelta < 0
                                                        ? `${flight.currency || '$'}${Math.abs(pIntel.absoluteDelta)} above average`
                                                        : pConf.label}
                                            </span>
                                        )}
                                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${delayColorClass}`}>
                                            ⏱ {delayRiskLabel}
                                        </span>
                                        {stops > 0 && (
                                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${connColorMap[connRisk]}`}>
                                                {connIconMap[connRisk]} {connLabel}
                                                {(intel.minConnectionMinutes ?? -1) > 0 && (
                                                    <span className="ml-0.5 opacity-75">({intel.minConnectionMinutes} min)</span>
                                                )}
                                            </span>
                                        )}
                                    </div>

                                    {/* Explanation — blurred for FREE */}
                                    {intel.explanation && (
                                        <p className={`text-xs text-slate-600 leading-relaxed ${!hasPremiumAccess ? 'blur-[3px] select-none pointer-events-none' : ''}`}>
                                            💡 {intel.explanation}
                                        </p>
                                    )}

                                    {flight.counterfactualNote && (
                                        <p className={`text-xs text-indigo-700 leading-relaxed bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-2 ${!hasPremiumAccess ? 'blur-[3px] select-none pointer-events-none' : ''}`}>
                                            🤖 {flight.counterfactualNote}
                                        </p>
                                    )}

                                    {flight.advancedScore?.decisionRecommendation && (
                                        <div className={`rounded-lg px-3 py-2 border text-xs font-semibold ${
                                            flight.advancedScore.decisionRecommendation === 'BUY_NOW'
                                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                                : flight.advancedScore.decisionRecommendation === 'AVOID'
                                                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                                                    : 'bg-amber-50 border-amber-200 text-amber-800'
                                        } ${!hasPremiumAccess ? 'blur-[3px] select-none pointer-events-none' : ''}`}>
                                            <div className="uppercase tracking-wide text-[10px] font-extrabold mb-0.5">Decision Recommendation</div>
                                            <div>
                                                {flight.advancedScore.decisionRecommendation === 'BUY_NOW' ? 'BUY NOW' : flight.advancedScore.decisionRecommendation}
                                                {Number.isFinite(Number(flight.advancedScore?.decisionConfidence)) && (
                                                    <span className="ml-1">({Math.round(Number(flight.advancedScore?.decisionConfidence || 0))}% confidence)</span>
                                                )}
                                            </div>
                                            {flight.advancedScore?.decisionReason && (
                                                <div className="font-medium mt-1">{flight.advancedScore.decisionReason}</div>
                                            )}
                                        </div>
                                    )}

                                    {decisionAction && hasPremiumAccess && (
                                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                                            <div className="text-xs font-bold text-slate-900">{decisionAction.message}</div>
                                            <div className="text-[11px] text-slate-600 mt-1">{decisionAction.context}</div>
                                        </div>
                                    )}

                                    {flight.advancedScore?.regretInsight && (
                                        <p className={`text-xs font-semibold leading-relaxed rounded-lg px-2.5 py-2 border bg-blue-50 text-blue-800 border-blue-200 ${!hasPremiumAccess ? 'blur-[3px] select-none pointer-events-none' : ''}`}>
                                            🧠 {flight.advancedScore.regretInsight}
                                        </p>
                                    )}

                                    {/* Regret Minimization Stat — psychological framing */}
                                    {flight.advancedScore?.regretStat && (
                                        <p className={`text-xs font-semibold leading-relaxed rounded-lg px-2.5 py-2 border ${
                                            (flight.advancedScore.regretStat.cheaperThan ?? 50) <= 25
                                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                                : (flight.advancedScore.regretStat.cheaperThan ?? 50) <= 50
                                                    ? 'bg-blue-50 text-blue-800 border-blue-200'
                                                    : 'bg-slate-50 text-slate-700 border-slate-200'
                                        } ${!hasPremiumAccess ? 'blur-[3px] select-none pointer-events-none' : ''}`}>
                                            📊 {flight.advancedScore.regretStat.label}
                                        </p>
                                    )}

                                    {/* CTA for FREE users */}
                                    {!isPremiumUser && (
                                        <button
                                            onClick={() => openPricingPage('pro')}
                                            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition-all"
                                        >
                                            🔓 Don't risk overpaying. Unlock the best decision before you book.
                                        </button>
                                    )}
                                </div>
                            );
                        })()}

                    {/* KONTROL ET BUTONU - View Analysis */}
                    <div className="mt-4 pt-4 border-t border-slate-100">
                        <button
                            onClick={decisionAction ? decisionAction.onClick : handleDetailsClick}
                            className={`w-full font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                                decisionAction
                                    ? `${decisionAction.className}`
                                    : hasPremiumAccess
                                        ? 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                            }`}
                        >
                            <Eye className="w-4 h-4" />
                            {decisionAction ? decisionAction.cta : 'View Analysis'}
                            {!hasPremiumAccess && <Lock className="w-3 h-3 ml-1 text-amber-600" />}
                        </button>
                        <button
                            onClick={handleDetailsClick}
                            disabled={false}
                            className={`mt-2 w-full font-semibold py-2 px-4 rounded-lg transition-colors ${
                                hasPremiumAccess
                                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                    : 'bg-slate-100 text-slate-400'
                            }`}
                        >
                            View analysis
                        </button>
                    </div>

                    {/* 🚨 HISTORICAL PUNCTUALITY RADAR (PRO+) */}
                    {hasPremiumAccess && flight.historicalPerformance && (
                        <div className="mt-4 pt-3 border-t border-slate-100">
                            <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ${
                                flight.historicalPerformance.risk === 'HIGH' 
                                    ? 'bg-red-100 text-red-700 border border-red-300'
                                    : flight.historicalPerformance.risk === 'MODERATE'
                                    ? 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                                    : 'bg-green-100 text-green-700 border border-green-300'
                            }`}>
                                <span className="text-lg">
                                    {flight.historicalPerformance.risk === 'HIGH' ? '⚠️' : 
                                     flight.historicalPerformance.risk === 'MODERATE' ? '📊' : '✓'}
                                </span>
                                <div className="text-left leading-tight">
                                    <div className="font-bold text-xs">
                                        {flight.historicalPerformance.delayProbability}% Delay Risk
                                    </div>
                                    <div className="text-[10px] opacity-80">
                                        {flight.historicalPerformance.historicalContext.delayedFlights} of {flight.historicalPerformance.historicalContext.totalFlights} delayed
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 💺 REAL SEAT DATA (PRO+) */}
                    {hasPremiumAccess && flight.seatMapData && !flight.seatMapData.error && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-300">
                                <span className="text-lg">🟢</span>
                                <div className="text-left leading-tight">
                                    <div className="font-bold text-xs">
                                        {flight.seatMapData.availableSeats} Real Seats Available
                                    </div>
                                    <div className="text-[10px] opacity-80">
                                        {flight.seatMapData.totalSeats} total ({Math.round((flight.seatMapData.availableSeats / flight.seatMapData.totalSeats) * 100)}% free)
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ⚲ SEAT DATA UNAVAILABLE (show gracefully) */}
                    {hasPremiumAccess && flight.seatMapData && flight.seatMapData.error && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 text-slate-600 border border-slate-300 text-[11px]">
                                <span>ℹ️</span>
                                <span>{flight.seatMapData.message || 'Seat data not available'}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* SAĞ TARAF: FİYAT VE SKOR */}
                <div className="w-full md:w-52 border-l pl-6 flex flex-col justify-between relative">

                    {/* SKOR KUTUSU (PREMIUM KİLİDİ) */}
                    <div className="h-32 relative flex items-center justify-center mb-2 rounded-xl overflow-hidden bg-slate-50 border border-slate-100 px-3">
                        {!hasPremiumAccess ? (
                            <div className="text-center opacity-70">
                                <div className="text-5xl font-black text-slate-300 blur-sm">8.5</div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Analysis locked</span>
                            </div>
                        ) : (
                            <div className="text-center w-full">
                                <div className={`text-4xl font-black leading-none ${hasInvalidData ? 'text-red-600' : 'text-blue-600'}`}>
                                    {Number.isFinite(displayScore) ? displayScore.toFixed(1) : '0.0'}
                                </div>
                                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide leading-none mt-1 block">{t('agentScore')}</span>
                                <div className="text-xs text-slate-600 mt-1 font-semibold leading-relaxed">10-Criteria Engine</div>
                                {Number(flight.advancedScore?.forYouBonus || 0) > 0 && (
                                    <div className="mt-1 inline-flex text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">
                                        For You +{Number(flight.advancedScore?.forYouBonus || 0).toFixed(1)}
                                    </div>
                                )}
                                {Number(personalBias?.loyaltyBoost || 0) > 0 && personalBias?.loyaltyAirline && (
                                    <div className="mt-1 inline-flex text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">
                                        Loyalty Boost +{Number(personalBias.loyaltyBoost).toFixed(1)} · {personalBias.loyaltyAirline}
                                    </div>
                                )}
                                {flight.advancedScore?.valueTag && (
                                    <div className={`mt-2 inline-flex max-w-[150px] text-center text-[11px] leading-snug px-2.5 py-1 rounded-full font-semibold whitespace-normal break-words ${hasInvalidData ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                        {hasInvalidData ? localizeValueTag('Veri Hatası') : localizeValueTag(flight.advancedScore.valueTag)}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* FİYAT SECTION */}
                    <div className="text-center mb-3">
                        {/* Deal Tier Badge */}
                        {(() => {
                            const tier = flight.advancedScore?.dealTier;
                            if (!tier || tier === 'NORMAL') return null;
                            const cfg: Record<string, { icon: string; cls: string; text: string }> = {
                                RARE_DEAL:  { icon: '🔥', cls: 'bg-amber-100 text-amber-800 border-amber-300', text: 'Rare Deal' },
                                GOOD_DEAL:  { icon: '🟢', cls: 'bg-green-100 text-green-700 border-green-300', text: 'Good Deal' },
                                EXPENSIVE:  { icon: '🔴', cls: 'bg-rose-100 text-rose-700 border-rose-300', text: 'Above Average' },
                            };
                            const c = cfg[tier];
                            if (!c) return null;
                            return (
                                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border mb-1.5 ${c.cls}`}>
                                    {c.icon} {c.text}
                                </span>
                            );
                        })()}

                        <div className="flex flex-col items-center">
                            {displayOriginalPrice && (
                                <span className="text-sm font-bold text-slate-400 line-through">
                                    ${displayOriginalPrice}
                                </span>
                            )}
                            <span className="text-2xl font-black text-blue-600 leading-none">
                                {displayPrice ? `$${displayPrice}` : 'N/A'}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium">
                                {flight.bookingProviders?.length ? `${flight.bookingProviders.length} providers` : 'Best Price'}
                            </span>

                            {estimatedTotalCost && Number.isFinite(Number(estimatedTotalCost.total)) && (
                                <div className="mt-2 w-full rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-left">
                                    <div className="text-[10px] font-bold uppercase tracking-wide text-amber-800">
                                        True Cost Engine
                                    </div>
                                    <div className="text-xs font-extrabold text-slate-800">
                                        Estimated total cost: ${Math.round(Number(estimatedTotalCost.total)).toLocaleString()}
                                    </div>
                                    <div className="text-[10px] text-slate-600">
                                        Extras: baggage ${Math.round(Number(estimatedTotalCost.estimatedBaggageFee || 0))} + meal ${Math.round(Number(estimatedTotalCost.estimatedMealCost || 0))}
                                    </div>
                                    <div className="text-[10px] text-slate-600">
                                        Seat ${Math.round(Number(estimatedTotalCost.estimatedSeatSelectionCost || 0))} + transfer ${Math.round(Number(estimatedTotalCost.estimatedAirportTransferCost || 0))} + hidden fees ${Math.round(Number(estimatedTotalCost.estimatedHiddenFeeBuffer || 0))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* BUY / WAIT Signal */}
                        {(() => {
                            const sig = flight.advancedScore?.buyWaitSignal;
                            if (!sig) return null;
                            const cfg: Record<string, { icon: string; cls: string }> = {
                                BUY:     { icon: '🟢', cls: 'bg-green-50 text-green-800 border-green-300' },
                                MONITOR: { icon: '🟡', cls: 'bg-amber-50 text-amber-800 border-amber-300' },
                                WAIT:    { icon: '🔴', cls: 'bg-rose-50 text-rose-800 border-rose-300' },
                            };
                            const c = cfg[sig.action] ?? cfg.MONITOR;
                            return (
                                <div className={`mt-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold leading-snug text-center ${c.cls}`}>
                                    {c.icon} {sig.label}
                                </div>
                            );
                        })()}
                    </div>

                    {/* PUAN DETAYLARI (NEDEN BU PUAN?) */}
                    {(isPremium || showScore) && (
                        <div className="mt-2 flex flex-wrap justify-center gap-1 w-full px-2">
                            {flight.scorePros?.map((pro: string, i: number) => (
                                <span key={`p-${i}`} className="text-[8px] font-bold bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded whitespace-nowrap">
                                    {String(pro)}
                                </span>
                            ))}
                            {flight.scoreCons?.map((con: string, i: number) => (
                                <span key={`c-${i}`} className="text-[8px] font-bold bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded whitespace-nowrap">
                                    {String(con)}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* DETAY DİALOĞU */}
            <FlightDetailDialog 
                flight={flight} 
                open={showDetails} 
                onClose={() => setShowDetails(false)} 
                hasPremiumAccess={hasPremiumAccess}
                canTrack={hasPremiumAccess}
            />

            {/* UPGRADE OVERLAY DIALOG (Full Screen) */}
            {showLockOverlay && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowLockOverlay(false)}>
                    <div className="bg-white rounded-2xl p-8 max-w-md mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="space-y-3">
                            <LockedFeatureOverlay
                                featureName="Flight Intelligence Suite"
                                requiredTier="PRO"
                                description="Don't risk overpaying. Unlock the best decision before you book."
                                benefits={[
                                    'Decision Recommendation (Premium)',
                                    'Confidence + Regret Insights (Premium)',
                                    'True Cost Breakdown (Premium)',
                                ]}
                                variant="panel"
                                className="w-full"
                            />
                            <button
                                onClick={() => openCheckout('PRO', 'monthly')}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2.5 rounded-lg"
                            >
                                🔓 Get a Clear Recommendation - Monthly Pro ($19)
                            </button>
                            <button
                                onClick={openOneTimeReport}
                                className="w-full bg-white border border-slate-300 hover:border-slate-400 text-slate-700 text-sm font-semibold py-2.5 rounded-lg"
                            >
                                One-time Report ($4.99)
                            </button>
                        </div>
                        <button
                            onClick={() => setShowLockOverlay(false)}
                            className="mt-4 w-full text-center text-sm text-gray-500 hover:text-gray-700"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

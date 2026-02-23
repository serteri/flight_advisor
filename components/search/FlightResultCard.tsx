'use client';

import { useTranslations } from 'next-intl';
import { Lock, Wifi, Utensils, Luggage, Eye, BellRing, Info, Shield } from 'lucide-react';
import { useState } from 'react';
import { FlightDetailDialog } from '@/components/FlightDetailDialog';
import { LockedFeatureOverlay, PremiumBadge } from '@/components/ui/LockedFeature';
import type { UserTier } from '@/lib/tierUtils';

export default function FlightResultCard({ 
    flight, 
    isPremium = false, 
    userTier = 'FREE' 
}: { 
    flight: any; 
    isPremium?: boolean; 
    userTier?: UserTier;
}) {
    const t = useTranslations('Results');
    const [showScore, setShowScore] = useState(isPremium);
    const [showDetails, setShowDetails] = useState(false);
    const [showLockOverlay, setShowLockOverlay] = useState(false);
    
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
    const airlineLogo = flight.airlineLogo || '/default-airline.png';
    const source = flight.source || 'UNKNOWN';
    const origin = flight.origin || flight.from || 'XXX';
    const destination = flight.destination || flight.to || 'XXX';
    const price = flight.price || 0;
    const stops = flight.stops ?? 0;
    const duration = flight.duration || 0;

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

    const getSegmentDurationMinutes = (seg: any, fallbackMinutes: number) => {
        const dep = seg?.departure || seg?.departing_at || seg?.departure_time || seg?.departure_at;
        const arr = seg?.arrival || seg?.arriving_at || seg?.arrival_time || seg?.arrival_at;
        if (dep && arr) {
            const depMs = new Date(dep).getTime();
            const arrMs = new Date(arr).getTime();
            if (!Number.isNaN(depMs) && !Number.isNaN(arrMs)) {
                return Math.max(0, Math.round((arrMs - depMs) / 60000));
            }
        }

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
            return numbers[0] || fallbackMinutes;
        }

        return fallbackMinutes;
    };

    const segments = Array.isArray(flight.segments) ? flight.segments : [];
    const totalDurationMinutes = duration > 0
        ? duration
        : Math.max(0, Math.round((new Date(arrivalTime).getTime() - new Date(departureTime).getTime()) / 60000));

    const totalDurationLabel = (() => {
        const label = t('total_duration');
        return label.includes('.') ? 'Total duration' : label;
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

    const hasPremiumAccess = userTier === 'PRO' || userTier === 'ELITE';
    const hasEliteAccess = userTier === 'ELITE';

    const handleLockClick = () => {
        if (!hasPremiumAccess) {
            setShowLockOverlay(true);
            return;
        }
    };

    const handleTrackClick = () => {
        if (!hasPremiumAccess) {
            setShowLockOverlay(true);
            return;
        }
        alert("✅ Uçuş takibe alındı! Fiyat düşerse haber vereceğiz.");
    };

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

            {/* 🏷️ KAYNAK ETİKETİ (ÜÇLÜ MOTOR) */}
            <div className="absolute top-0 left-0 z-20">
                <span className={`text-[10px] font-black px-3 py-1 rounded-tl-[16px] rounded-br-[8px] text-white ${source === 'DUFFEL' ? 'bg-emerald-600' : 'bg-blue-600'
                    }`}>
                    {source === 'DUFFEL' ? 'DUFFEL' : 'KIWI'}
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
                        <img src={airlineLogo} alt={airline} onError={(e) => { e.currentTarget.src = '/default-airline.png'; }} className="w-12 h-12 object-contain" />
                        <div>
                            <h4 className="font-bold text-lg text-slate-900 leading-tight">{airline}</h4>
                            <div className="flex gap-2 items-center mt-1">
                                <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-mono">{flightNumber}</span>
                                {/* Provider Source Badge */}
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${source === 'DUFFEL' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                                    }`}>
                                    {source === 'DUFFEL' ? '🏛️ Duffel' : '🌐 Kiwi'}
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
                                            const durationNum = typeof l.duration === 'number' ? l.duration : parseInt(l.duration) || 0;
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

                                    return (
                                        <div key={`${segFrom}-${segTo}-${idx}`} className="flex flex-col gap-1">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="font-semibold text-slate-800">{segFrom} → {segTo}</span>
                                                <span className="font-semibold text-slate-700">{formatDuration(segDuration)}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs text-slate-500">
                                                <span>{formatLocalTime(segDep)} departure</span>
                                                <span>{formatLocalTime(segArr)} arrival</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* AMENITIES (LOCKED FOR FREE USERS) */}
                    <div className="relative mt-5 pt-3 border-t border-slate-100">
                        {/* Lock Overlay for FREE users */}
                        {!hasPremiumAccess && (
                            <LockedFeatureOverlay
                                featureName="Amenity Intelligence"
                                requiredTier="PRO"
                                description="Unlock detailed amenity analysis, baggage policies, and refund/change conditions"
                                benefits={[
                                    'Aircraft type & age details',
                                    'Real baggage allowance (kg)',
                                    'Refund & change policies',
                                    'WiFi, IFE, meal service details'
                                ]}
                                className="rounded-lg"
                            />
                        )}
                        
                        {/* Amenity Content (blurred for FREE, visible for PRO) */}
                        <div className={`flex flex-wrap gap-4 ${!hasPremiumAccess && 'filter blur-sm opacity-50 select-none pointer-events-none'}`}>
                            <div className="flex items-center gap-1.5">
                                <Utensils className={`w-3.5 h-3.5 ${flight.amenities?.hasMeal ? 'text-slate-700' : 'text-slate-300'}`} />
                                <span className="text-[11px] font-medium text-slate-600">
                                    {flight.amenities?.hasMeal ? t('included') : t('paid')}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Wifi className={`w-3.5 h-3.5 ${flight.amenities?.hasWifi ? 'text-blue-600' : 'text-slate-300'}`} />
                                <span className="text-[11px] font-medium text-slate-600">
                                    {flight.amenities?.hasWifi ? t('wifi_available') : t('wifi_none')}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Luggage className={`w-3.5 h-3.5 ${flight.amenities?.baggage ? 'text-slate-700' : 'text-slate-300'}`} />
                                <span className="text-[11px] font-medium text-slate-600">
                                    {flight.policies?.baggageKg 
                                        ? `${flight.policies.baggageKg}kg` 
                                        : flight.baggageSummary?.checked 
                                            ? flight.baggageSummary.checked 
                                            : flight.amenities?.baggage === 'Dahil' 
                                                ? '20kg Dahil' 
                                                : 'Kontrol Et'}
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

                    {/* KONTROL ET BUTONU - View Analysis Premium Feature */}
                    <div className="mt-4 pt-4 border-t border-slate-100">
                        <button
                            onClick={() => {
                                // If FREE user, show lock overlay instead of opening details
                                if (!hasPremiumAccess) {
                                    setShowLockOverlay(true);
                                } else {
                                    // PRO/ELITE: Show flight details dialog
                                    setShowDetails(true);
                                }
                            }}
                            className={`w-full font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                                hasPremiumAccess 
                                    ? 'bg-blue-100 hover:bg-blue-200 text-blue-700' 
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                        >
                            <Eye className="w-4 h-4" />
                            {hasPremiumAccess ? 'View Analysis' : 'View Analysis (Unlock)'}
                            {!hasPremiumAccess && <Lock className="w-3 h-3 ml-1" />}
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
                    <div className="h-24 relative flex items-center justify-center mb-2 cursor-pointer rounded-xl overflow-hidden bg-slate-50 border border-slate-100" onClick={handleLockClick}>
                        {!hasPremiumAccess ? (
                            // KİLİTLİ HALİ - Updated with better CTA
                            <>
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 backdrop-blur-md z-10 flex flex-col items-center justify-center">
                                    <Lock className="w-6 h-6 text-blue-600 mb-1 animate-pulse" />
                                    <span className="text-[10px] font-bold text-slate-800 text-center px-4 leading-tight">
                                        {t('view_analysis')}<br />
                                        <span className="text-blue-600">Tap to Unlock</span>
                                    </span>
                                </div>
                                {/* Arkada blur görünen sahte skor */}
                                <div className="text-5xl font-black text-slate-300 blur-sm pointer-events-none">8.5</div>
                            </>
                        ) : (
                            // AÇIK HALİ
                            <div className="text-center">
                                <div className="text-5xl font-black text-blue-600 tracking-tighter">{flight.agentScore?.toFixed(1) || "?.?"}</div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('agentScore')}</span>
                            </div>
                        )}
                    </div>

                    {/* FİYAT SECTION */}
                    <div className="text-center mb-3">
                        <div className="flex flex-col items-center">
                            <span className="text-sm font-bold text-slate-400 line-through">
                                ${Math.max(0, Math.floor((flight.price || 0) * 1.15))}
                            </span>
                            <span className="text-2xl font-black text-blue-600 leading-none">
                                ${Math.max(0, Math.floor(flight.price || 0))}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium">
                                {flight.bookingProviders?.length ? `${flight.bookingProviders.length} providers` : 'Best Price'}
                            </span>
                        </div>
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
                canTrack={hasPremiumAccess}
            />

            {/* UPGRADE OVERLAY DIALOG (Full Screen) */}
            {showLockOverlay && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowLockOverlay(false)}>
                    <div className="bg-white rounded-2xl p-8 max-w-md mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <LockedFeatureOverlay
                            featureName="Flight Intelligence Suite"
                            requiredTier="PRO"
                            description="Unlock real-time tracking, EU261 compensation alerts, and detailed flight analysis"
                            benefits={[
                                'Live flight status & disruption alerts',
                                'EU261 compensation calculator',
                                'Detailed amenity & aircraft analysis',
                                'Refund & change policy insights',
                                'Price drop notifications'
                            ]}
                            variant="panel"
                            className="w-full"
                        />
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

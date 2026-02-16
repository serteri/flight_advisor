'use client';

import { useTranslations } from 'next-intl';
import { Lock, Wifi, Utensils, Luggage, Eye, BellRing, Info } from 'lucide-react';
import { useState } from 'react';
import { FlightDetailDialog } from '@/components/FlightDetailDialog';

export default function FlightResultCard({ flight, isPremium = false }: { flight: any, isPremium?: boolean }) {
    const t = useTranslations('Results');
    const [showScore, setShowScore] = useState(isPremium);
    const [showDetails, setShowDetails] = useState(false);

    const handleLockClick = () => {
        if (!isPremium) {
            alert("⚠️ Bu özelliği görmek için Premium üye olmalısınız!");
            return;
        }
    };

    const handleTrackClick = () => {
        if (!isPremium) {
            alert("⚠️ Fiyat Takibi sadece Premium üyeler içindir.");
            return;
        }
        alert("✅ Uçuş takibe alındı! Fiyat düşerse haber vereceğiz.");
    };

    return (
        <div className="bg-white rounded-[16px] p-5 border-2 border-slate-200 hover:border-blue-500 transition-all shadow-sm relative group mb-4">
            {/* DEBUG INDICATOR - REMOVE LATER */}
            <div className="hidden">DEBUG: FlightResultCard Active</div>

            {/* 🏷️ KAYNAK ETİKETİ (ÜÇLÜ MOTOR) */}
            <div className="absolute top-0 left-0 z-20">
                <span className={`text-[10px] font-black px-3 py-1 rounded-tl-[16px] rounded-br-[8px] text-white ${flight.source === 'DUFFEL' ? 'bg-emerald-600' : 'bg-blue-600'
                    }`}>
                    {flight.source === 'DUFFEL' ? 'DUFFEL' : 'KIWI'}
                </span>
            </div>

            {/* TRACK BUTONU (SAĞ ÜST - YENİ) */}
            <button
                onClick={handleTrackClick}
                className="absolute top-3 right-4 text-slate-400 hover:text-blue-600 flex items-center gap-1 transition-colors"
                title={t('track')}
            >
                <span className="text-[10px] font-bold">{t('track')}</span>
                <BellRing className="w-4 h-4" />
            </button>

            <div className="flex flex-col md:flex-row justify-between gap-4 mt-8">

                {/* SOL: Uçuş Detayları */}
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                        <img src={flight.airlineLogo} alt={flight.airline} className="w-12 h-12 object-contain" />
                        <div>
                            <h4 className="font-bold text-lg text-slate-900 leading-tight">{flight.airline}</h4>
                            <div className="flex gap-2 items-center mt-1">
                                <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-mono">{flight.flightNumber}</span>
                                {/* Provider Source Badge */}
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${flight.source === 'DUFFEL' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                                    }`}>
                                    {flight.source === 'DUFFEL' ? '🏛️ Duffel' : '🌐 Kiwi'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between px-2 gap-6">
                        <div className="text-left">
                            <span className="text-2xl font-black text-slate-800">
                                {new Date(flight.departureTime || flight.departTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <p className="text-xs font-bold text-slate-400">{flight.origin || flight.from}</p>
                        </div>

                        {/* SÜRE VE AKTARMA DETAYLI */}
                        <div className="flex-1 flex flex-col items-center">
                            <span className="text-xs font-bold text-slate-600 mb-1">
                                {Math.floor(flight.duration / 60)}h {flight.duration % 60}m
                            </span>

                            <div className="w-full h-[2px] bg-slate-200 relative my-1">
                                {/* Plane Icon */}
                                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 bg-white px-1 text-[10px]">✈️</div>

                                {/* Layover Dots */}
                                {flight.layovers && flight.layovers.length > 0 && (
                                    <div className="absolute top-[-3px] left-0 w-full flex justify-between px-2">
                                        {flight.layovers.map((_: any, i: number) => (
                                            <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-400 border border-white" style={{ left: `${(i + 1) * (100 / (flight.layovers!.length + 1))}%` }} />
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col items-center">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${flight.stops === 0 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                    {flight.stops === 0 ? t('direct') : `${flight.stops} ${t('stops')}`}
                                </span>

                                {/* Layover Details */}
                                {flight.stops > 0 && flight.layovers && flight.layovers.length > 0 && (
                                    <span className="text-[9px] text-slate-500 mt-0.5 text-center">
                                        {flight.layovers.map((l: any) => `${l.airport} (${Math.floor(l.duration / 60)}h ${l.duration % 60}m)`).join(', ')}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="text-right">
                            <span className="text-2xl font-black text-slate-800">
                                {new Date(flight.arrivalTime || flight.arriveTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <p className="text-xs font-bold text-slate-400">{flight.destination || flight.to}</p>
                        </div>
                    </div>

                    {/* AMENITIES (AKILLI GÖSTERİM) */}
                    <div className="flex gap-6 mt-5 pt-3 border-t border-slate-100">
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
                    </div>

                    {/* KONTROL ET BUTONU */}
                    <div className="mt-4 pt-4 border-t border-slate-100">
                        <button
                            onClick={() => setShowDetails(true)}
                            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            <Info className="w-4 h-4" />
                            Kontrol Et
                        </button>
                    </div>
                </div>

                {/* SAĞ TARAF: FİYAT VE SKOR */}
                <div className="w-full md:w-52 border-l pl-6 flex flex-col justify-between relative">

                    {/* SKOR KUTUSU (PREMIUM KİLİDİ) */}
                    <div className="h-24 relative flex items-center justify-center mb-2 cursor-pointer rounded-xl overflow-hidden bg-slate-50 border border-slate-100" onClick={handleLockClick}>
                        {!isPremium ? (
                            // KİLİTLİ HALİ
                            <>
                                <div className="absolute inset-0 bg-white/40 backdrop-blur-md z-10 flex flex-col items-center justify-center">
                                    <Lock className="w-6 h-6 text-blue-600 mb-2" />
                                    <span className="text-[10px] font-bold text-slate-800 text-center px-4 leading-tight">{t('view_analysis')}<br />(Premium)</span>
                                </div>
                                {/* Arkada flu görünen sahte skor */}
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

                    {/* FİYAT */}
                    <div className="text-center mb-3">
                        <span className="text-2xl font-black text-slate-900">${flight.price}</span>
                    </div>

                    {/* PUAN DETAYLARI (NEDEN BU PUAN?) */}
                    {(isPremium || showScore) && (
                        <div className="mt-2 flex flex-wrap justify-center gap-1 w-full px-2">
                            {flight.scorePros?.map((pro: string, i: number) => (
                                <span key={`p-${i}`} className="text-[8px] font-bold bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded whitespace-nowrap">
                                    {pro}
                                </span>
                            ))}
                            {flight.scoreCons?.map((con: string, i: number) => (
                                <span key={`c-${i}`} className="text-[8px] font-bold bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded whitespace-nowrap">
                                    {con}
                                </span>
                            ))}

            {/* DETAY DİALOĞU */}
            <FlightDetailDialog 
                flight={flight} 
                open={showDetails} 
                onClose={() => setShowDetails(false)} 
            />
                        </div>
                    )}

                    {/* FİYAT - SADECE FİYAT GÖZÜKSÜN */}
                    <div className="flex flex-col items-center mt-2">
                        <span className="text-sm font-bold text-slate-400 line-through">
                            ${Math.floor(flight.price * 1.15)}
                        </span>
                        <span className="text-2xl font-black text-blue-600 leading-none">
                            ${Math.floor(flight.price)}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                            {flight.bookingProviders?.length ? `${flight.bookingProviders.length} providers` : 'Best Price'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

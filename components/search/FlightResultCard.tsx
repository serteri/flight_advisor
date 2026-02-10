'use client';

import { useTranslations } from 'next-intl';
import BookButton from './BookButton';
import { Lock } from 'lucide-react';
import { FlightResult } from '@/types/hybridFlight';

export default function FlightResultCard({ flight, isPremium = false }: { flight: any, isPremium?: boolean }) {
    const t = useTranslations('Results');

    // Skor Kilidi (Blur)
    const PremiumLock = ({ label }: { label: string }) => (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-md flex flex-col items-center justify-center z-10 rounded-xl border border-blue-100">
            <Lock className="w-5 h-5 text-blue-600 mb-1" />
            <span className="text-[10px] font-bold text-slate-800">{label}</span>
            <button className="mt-1 text-[9px] bg-blue-600 text-white px-2 py-0.5 rounded-full">Premium</button>
        </div>
    );

    return (
        <div className="bg-white rounded-[16px] p-5 border border-slate-200 hover:border-blue-500 transition-all shadow-sm relative group mb-6">

            {/* 🏷️ YENİ ÖZELLİK: KAYNAK GÖSTERGESİ (SOL ÜST KÖŞE) */}
            <div className="absolute top-0 left-0 bg-slate-100 rounded-tl-[16px] rounded-br-[10px] border-b border-r border-slate-200 px-3 py-1 z-20">
                <span className={`text-[10px] font-black tracking-wider ${flight.source === 'DUFFEL' ? 'text-purple-600' : 'text-orange-600'}`}>
                    DATA: {flight.source}
                </span>
            </div>

            <div className="flex flex-col md:flex-row justify-between gap-4 mt-6">

                {/* SOL: Uçuş Detayları */}
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                        {flight.airlineLogo ? (
                            <img src={flight.airlineLogo} alt={flight.airline} className="w-8 h-8 object-contain" />
                        ) : (
                            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-500">
                                {flight.airline.slice(0, 2)}
                            </div>
                        )}
                        <div>
                            <h4 className="font-bold text-slate-900 leading-tight">{flight.airline}</h4>
                            <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{flight.flightNumber}</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between px-2 gap-4">
                        <div className="text-left w-20">
                            <span className="text-xl font-black text-slate-800">
                                {new Date(flight.departTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <p className="text-[10px] font-bold text-slate-400">{flight.from}</p>
                        </div>

                        {/* Süre Çubuğu */}
                        <div className="flex-1 flex flex-col items-center">
                            <span className="text-[10px] text-slate-500 mb-1">{Math.floor(flight.duration / 60)}h {flight.duration % 60}m</span>
                            <div className="w-full h-[2px] bg-slate-200 relative mt-1 mb-1">
                                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 bg-white px-1 text-[10px]">✈️</div>
                            </div>
                            <span className={`text-[9px] font-bold mt-1 ${flight.stops === 0 ? 'text-green-600' : 'text-orange-500'}`}>
                                {flight.stops === 0 ? "Direkt" : `${flight.stops} Aktarma`}
                            </span>
                        </div>

                        <div className="text-right w-20">
                            <span className="text-xl font-black text-slate-800">
                                {new Date(flight.arriveTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <p className="text-[10px] font-bold text-slate-400">{flight.to}</p>
                        </div>
                    </div>
                </div>

                {/* SAĞ: Fiyat ve Buton */}
                <div className="w-full md:w-48 border-l pl-4 flex flex-col justify-between relative">

                    {/* Agent Score (Premium Kilitli) */}
                    <div className="h-14 relative flex items-center justify-center mb-2">
                        {!isPremium ? (
                            <PremiumLock label="Analizi Gör" />
                        ) : (
                            <div className="text-center">
                                <div className="text-3xl font-black text-blue-600">{flight.agentScore?.toFixed(1) || "?.?"}</div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase">Agent Score</span>
                            </div>
                        )}
                        {/* Arkadaki Blur Görüntü */}
                        {!isPremium && <span className="absolute text-3xl font-black text-slate-200 blur-sm select-none">8.2</span>}
                    </div>

                    {/* Fiyat */}
                    <div className="text-center mb-2">
                        <span className="text-xl font-black text-slate-900">${flight.price}</span>
                    </div>

                    {/* BUTON: Kaynağa Göre Metin Değişir */}
                    <BookButton
                        flight={flight}
                        // Eğer Duffel ise "Aviasales", Rapid ise "Partner" yazar
                        label={flight.source === 'DUFFEL' ? "Aviasales ile Al" : "Siteye Git"}
                    />

                    <p className="text-[8px] text-center text-slate-400 mt-1">
                        {flight.source === 'DUFFEL' ? 'Güvenli yönlendirme' : 'Resmi siteye yönlendirilir'}
                    </p>
                </div>
            </div>
        </div>
    );
}

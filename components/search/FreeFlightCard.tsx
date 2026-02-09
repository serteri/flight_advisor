
"use client";

import { FlightResult } from "@/types/flight";
import { useState } from "react";
import { PremiumAnalysisCard } from "../analysis/PremiumAnalysisCard";
import { FlightAnalysis } from "@/types/flight";

interface FreeFlightCardProps {
    flight: FlightResult;
}

// Zaman formatlama fonksiyonu
const formatTime = (dateString: string) => {
    try {
        return new Date(dateString).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return "N/A";
    }
};

// Süre formatlama fonksiyonu
const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}s ${mins}d`;
};


export function FreeFlightCard({ flight }: FreeFlightCardProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [analysis, setAnalysis] = useState<FlightAnalysis | null>(null);
    const [showAnalysis, setShowAnalysis] = useState(false);

    const handleAnalyze = async () => {
        if (showAnalysis) {
            setShowAnalysis(false);
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(flight),
            });
            const data: FlightAnalysis = await res.json();
            setAnalysis(data);
            setShowAnalysis(true);
        } catch (error) {
            console.error("Analiz verisi alınamadı:", error);
            // Burada kullanıcıya bir hata mesajı gösterilebilir.
        } finally {
            setIsLoading(false);
        }
    };

    // Travelpayouts gibi özel durumlar için farklı kart gösterimi
    if (flight.source === 'travelpayouts') {
        return (
             <div className="bg-white border-2 border-slate-100 rounded-3xl p-6 my-4 shadow-sm">
                <div className="flex justify-between items-center">
                    <div>
                        <p className="font-bold text-slate-800">Daha Fazla Seçenek mi Arıyorsun?</p>
                        <p className="text-sm text-slate-500">
                           {flight.from} - {flight.to} için onlarca havayolunu karşılaştır.
                        </p>
                    </div>
                    <a
                        href={flight.bookingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-amber-500 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-amber-600 transition-colors whitespace-nowrap"
                    >
                        Tümünü Gör
                    </a>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-white border-2 border-slate-100 hover:border-blue-500 rounded-3xl p-4 my-4 transition-all shadow-sm hover:shadow-lg">
            {/* TEMEL UÇUŞ BİLGİSİ */}
            <div className="grid grid-cols-12 items-center gap-4">
                <div className="col-span-3">
                    <p className="text-sm font-bold text-slate-800">{flight.airline}</p>
                    <p className="text-xs text-slate-500">{flight.flightNumber}</p>
                </div>
                
                <div className="col-span-5 flex items-center gap-4">
                    <div className="text-left">
                        <p className="text-xl font-bold">{formatTime(flight.departTime)}</p>
                        <p className="text-sm text-slate-500 font-medium">{flight.from}</p>
                    </div>
                    <div className="flex flex-col items-center flex-grow">
                       <span className="text-[10px] font-bold text-slate-400">
                         {formatDuration(flight.duration)}
                       </span>
                       <div className="w-full h-px bg-slate-200 my-1"></div>
                       <p className="text-[10px] font-bold text-orange-500">{flight.stops} Aktarma</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xl font-bold">{formatTime(flight.arriveTime)}</p>
                        <p className="text-sm text-slate-500 font-medium">{flight.to}</p>
                    </div>
                </div>

                <div className="col-span-2 text-center">
                    <p className="text-2xl font-black text-blue-600">${flight.price.toLocaleString()}</p>
                    <p className="text-xs text-slate-400">{flight.currency}</p>
                </div>
                
                <div className="col-span-2 flex flex-col gap-2">
                     <a href={flight.bookingLink} target="_blank" rel="noopener noreferrer" className="bg-blue-600 text-white text-center px-4 py-2 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors">
                        Rezervasyon
                    </a>
                    <button
                        onClick={handleAnalyze}
                        disabled={isLoading}
                        className="bg-slate-200 text-slate-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-slate-300 transition-colors disabled:opacity-50"
                    >
                        {isLoading ? "Analiz..." : (showAnalysis ? "Kapat" : "Analiz Et »")}
                    </button>
                </div>
            </div>

            {/* PREMIUM ANALİZ KARTI (gizli/görünür) */}
            {showAnalysis && analysis && (
                <div className="mt-4 border-t-2 border-dashed border-slate-200 pt-4">
                    <PremiumAnalysisCard analysis={analysis} />
                </div>
            )}
        </div>
    );
}

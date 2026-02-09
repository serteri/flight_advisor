
"use client";

import { FlightAnalysis } from "@/types/flight";
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';


interface PremiumAnalysisCardProps {
    analysis: FlightAnalysis;
}

export function PremiumAnalysisCard({ analysis }: PremiumAnalysisCardProps) {
    
    return (
        <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl p-6 animate-fade-in">
            <div className="grid grid-cols-12 gap-8">

                {/* SOL TARAF: SKOR & METİN */}
                <div className="col-span-4">
                    <div className="text-center mb-6">
                        <span className="text-7xl font-black text-blue-600">{analysis.score}</span>
                        <p className="text-sm text-slate-500 font-bold uppercase tracking-wider">Guardian Skoru</p>
                    </div>
                    <p className="text-sm text-slate-600 italic leading-relaxed">
                        "{analysis.recommendationText}"
                    </p>
                </div>

                {/* SAĞ TARAF: ARTILAR & EKSİLER */}
                <div className="col-span-8 grid grid-cols-2 gap-6">
                    {/* ARTILAR */}
                    <div>
                        <h3 className="font-bold text-green-600 mb-3 text-lg">Artıları</h3>
                        <ul className="space-y-2">
                            {analysis.pros.map((pro, index) => (
                                <li key={index} className="flex items-start">
                                    <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                                    <span className="text-slate-800 text-sm">{pro}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* EKSİLER */}
                    <div>
                        <h3 className="font-bold text-red-600 mb-3 text-lg">Riskler</h3>
                         {analysis.cons.length > 0 ? (
                            <ul className="space-y-2">
                                {analysis.cons.map((con, index) => (
                                    <li key={index} className="flex items-start">
                                        <XCircleIcon className="h-5 w-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                                        <span className="text-slate-800 text-sm">{con}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                             <div className="flex items-start text-sm text-slate-500">
                                <CheckCircleIcon className="h-5 w-5 text-slate-400 mr-2 mt-0.5 flex-shrink-0" />
                                <span>Kayda değer bir risk bulunamadı.</span>
                             </div>
                        )}
                    </div>
                </div>

                {/* KARAR ÜÇGENİ - Basit görselleştirme */}
                {/* <div className="col-span-12 mt-4">
                     <h3 className="font-bold text-slate-800 mb-2 text-center">Karar Üçgeni</h3>
                     <div className="flex justify-around bg-slate-100 rounded-xl p-4">
                        <div className="text-center">
                            <p className="font-bold text-xl">{analysis.decisionTriangle.price}/10</p>
                            <p className="text-xs uppercase font-semibold">Fiyat</p>
                        </div>
                         <div className="text-center">
                            <p className="font-bold text-xl">{analysis.decisionTriangle.time}/10</p>
                            <p className="text-xs uppercase font-semibold">Süre</p>
                        </div>
                         <div className="text-center">
                            <p className="font-bold text-xl">{analysis.decisionTriangle.comfort}/10</p>
                            <p className="text-xs uppercase font-semibold">Konfor</p>
                        </div>
                     </div>
                </div> */}
            </div>
        </div>
    );
}

// Fade-in animasyonu için globals.css'e ekleyebilirsiniz:
/*
@keyframes fade-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
  animation: fade-in 0.5s ease-out forwards;
}
*/

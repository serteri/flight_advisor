
'use client';

import React from 'react';
import { AircraftLayout, Seat } from '@/types/seatmap';
import { User, Check, XCircle } from 'lucide-react';

interface SeatMapProps {
    layout: AircraftLayout;
}

export function SeatMapVisualizer({ layout }: SeatMapProps) {

    const getSeatStyle = (seat: Seat) => {
        switch (seat.status) {

            // 🟣 1. KULLANICININ KOLTUĞU (EN ÖNEMLİSİ)
            case 'USER_SEAT':
                return `
          bg-purple-600 text-white 
          ring-4 ring-purple-200 
          z-20 scale-110 shadow-lg font-black
          flex items-center justify-center
        `;

            // 🔴 2. DOLU KOLTUK (İşgal Edilmiş)
            case 'OCCUPIED':
                return 'bg-slate-300 text-slate-400 cursor-not-allowed opacity-50';

            case 'BLOCKED':
                return 'bg-slate-200 text-slate-300 cursor-not-allowed pattern-diagonal-lines opacity-40';

            // 🟢 3. BOŞ KOLTUK (Fırsat)
            case 'AVAILABLE':
                return 'bg-white border-2 border-emerald-400 text-emerald-600 hover:bg-emerald-50 cursor-pointer';

            // ⭐ 4. ÖNERİLEN (15. Sıra gibi - manuel eklenirse)
            case 'RECOMMENDED':
                return 'bg-amber-400 text-white animate-pulse ring-2 ring-amber-200';

            default:
                return 'bg-gray-100';
        }
    };

    const renderSeatContent = (seat: Seat) => {
        if (seat.status === 'USER_SEAT') {
            return <User className="w-4 h-4" />;
        }
        return seat.number.replace(/\d+/g, ''); // Sadece harfi göster (24A -> A) - yer kazanmak için
    };

    return (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 overflow-x-auto">

            <div className="flex flex-col items-center min-w-[300px]">
                {/* UÇAK BURNU (Görsel Efekt) */}
                <div className="w-20 h-10 bg-slate-100 rounded-t-full border-t border-l border-r border-slate-200 mb-4 opacity-50"></div>

                <div className="space-y-1">
                    {layout.rows.map(row => (
                        <div key={row.rowNumber} className="flex items-center justify-center gap-2">
                            {/* Sol taraf numarası (Opsiyonel) */}
                            <span className="text-[10px] text-slate-300 w-4 text-right font-mono">{row.rowNumber}</span>

                            <div className="flex gap-1">
                                {row.seats.map(seat => {
                                    // Basit koridor boşluğu mantığı: C ve D arasına boşluk koy (3-3 düzeni varsayımı ile)
                                    // Gerçek veride 'aisle' features'dan gelmeli ama şimdilik harfe göre hack yapıyoruz
                                    const isAisle = seat.coordinates.x === 'C' || seat.coordinates.x === 'F'; // Geniş gövde?
                                    // Daha basit: Tek koridor (3-3) -> C ile D arası.
                                    // Harf sırası: A B C | D E F
                                    const addAisleMargin = seat.coordinates.x === 'C';

                                    return (
                                        <React.Fragment key={seat.number}>
                                            <div
                                                className={`
                                            w-8 h-8 rounded-md text-[10px] transition-all flex items-center justify-center
                                            ${getSeatStyle(seat)}
                                        `}
                                                title={`Seat ${seat.number} - ${seat.status}`}
                                            >
                                                {renderSeatContent(seat)}
                                            </div>
                                            {addAisleMargin && <div className="w-4"></div>}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* LEJANT (RENK AÇIKLAMASI) */}
            <div className="mt-8 flex flex-wrap justify-center gap-4 text-xs font-bold border-t border-slate-100 pt-4">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-purple-600 rounded flex items-center justify-center text-white"><User className="w-3 h-3" /></div> Sizin Yeriniz
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-emerald-400 rounded bg-white"></div> Boş
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-slate-300 rounded opacity-50"></div> Dolu
                </div>
            </div>

        </div>
    );
}

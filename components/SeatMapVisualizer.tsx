import React from 'react';
import { User, Check, X, Star } from 'lucide-react';
import { AircraftLayout, Seat } from '@/types/seatmap';

export function SeatMapVisualizer({ layout }: { layout: AircraftLayout }) {

    // Koltuk Rengi Belirleyici
    const getSeatStyle = (seat: Seat) => {
        switch (seat.status) {
            case 'USER_SEAT':
                return 'bg-blue-600 text-white ring-2 ring-blue-400 z-10';
            case 'OCCUPIED':
                return 'bg-slate-300 text-slate-400 cursor-not-allowed';
            case 'RECOMMENDED':
                return 'bg-emerald-500 text-white ring-4 ring-emerald-200 animate-pulse z-10'; // Parlayan Fırsat
            case 'AVAILABLE':
                return 'bg-white border-2 border-blue-200 text-blue-600 hover:bg-blue-50 cursor-pointer';
            case 'BLOCKED':
                return 'bg-transparent text-transparent';
            default:
                return 'bg-gray-200';
        }
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-200 max-w-md mx-auto">

            {/* BAŞLIK & BİLGİ */}
            <div className="text-center mb-6">
                <h3 className="text-lg font-bold text-slate-800">{layout.aircraftType}</h3>
                <p className="text-xs text-slate-500">Ön Taraf (Cockpit)</p>
            </div>

            {/* UÇAK GÖVDESİ */}
            <div className="relative bg-slate-100 rounded-t-[40%] rounded-b-[100px] pb-12 pt-8 px-4 border-x-4 border-t-4 border-slate-300">

                {/* IZGARA YAPISI */}
                <div className="flex flex-col gap-2">
                    {layout.rows.map((row) => (
                        <div key={row.rowNumber} className="relative flex items-center justify-center gap-4">

                            {/* Sol Taraf (ABC) */}
                            <div className="flex gap-1">
                                {row.seats.slice(0, 3).map((seat) => (
                                    <SeatIcon key={seat.number} seat={seat} style={getSeatStyle(seat)} />
                                ))}
                            </div>

                            {/* Koridor & Sıra No */}
                            <div className="w-6 text-center text-[10px] font-bold text-slate-400">
                                {row.rowNumber}
                            </div>

                            {/* Sağ Taraf (DEF) */}
                            <div className="flex gap-1">
                                {row.seats.slice(3, 6).map((seat) => (
                                    <SeatIcon key={seat.number} seat={seat} style={getSeatStyle(seat)} />
                                ))}
                            </div>

                            {/* Kanat Göstergesi (Opsiyonel) */}
                            {row.isWing && (
                                <div className="absolute -left-6 h-full w-1 bg-slate-300/50"></div>
                            )}
                            {row.isWing && (
                                <div className="absolute -right-6 h-full w-1 bg-slate-300/50"></div>
                            )}

                        </div>
                    ))}
                </div>
            </div>

            {/* LEJANT (AÇIKLAMA) */}
            <div className="mt-6 flex flex-wrap justify-center gap-3 text-xs">
                <div className="flex items-center gap-1"><div className="w-4 h-4 bg-blue-600 rounded"></div> Sizin Yeriniz</div>
                <div className="flex items-center gap-1"><div className="w-4 h-4 bg-emerald-500 rounded"></div> Önerilen</div>
                <div className="flex items-center gap-1"><div className="w-4 h-4 bg-slate-300 rounded"></div> Dolu</div>
                <div className="flex items-center gap-1"><div className="w-4 h-4 border-2 border-blue-200 rounded"></div> Boş</div>
            </div>
        </div>
    );
}

// Tekil Koltuk İkonu
function SeatIcon({ seat, style }: { seat: Seat, style: string }) {
    return (
        <div
            className={`w-8 h-8 rounded-t-lg rounded-b-sm flex items-center justify-center text-[10px] font-bold transition-all ${style}`}
            title={`Seat ${seat.number} - ${seat.status}`}
        >
            {seat.status === 'USER_SEAT' && <User className="w-4 h-4" />}
            {seat.status === 'RECOMMENDED' && <Star className="w-4 h-4 fill-current" />}
            {seat.status === 'OCCUPIED' && <X className="w-3 h-3 opacity-50" />}
            {seat.status === 'AVAILABLE' && seat.number.replace(/[0-9]/g, '')}
        </div>
    );
}

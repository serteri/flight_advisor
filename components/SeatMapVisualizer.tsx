'use client';

import { AircraftLayout, Seat } from '@/types/seatmap';
import { User, Info } from 'lucide-react';

export function SeatMapVisualizer({ layout, userSeat }: { layout: AircraftLayout, userSeat?: string | null }) {

    // Uçak Tipine Göre Konfigürasyon Belirle
    // 777/A350 (Geniş): 3 - 4 - 3 veya 3 - 3 - 3
    // 737/A320 (Dar):   3 - 3
    const isWideBody = ['77W', '777', '350', '330', '787'].includes(layout.aircraftType);

    // Koltukları Bloklara Ayıran Fonksiyon
    const renderRow = (row: any) => {
        // Sadece gerçek koltukları al
        const seats = row.seats;

        // Harf harf gruplama (Generic Layout Handler)
        const firstGroupLetters = ['A', 'B', 'C'];
        // Orta ve Sağ grup mantığı

        const leftGroup = seats.filter((s: any) => firstGroupLetters.includes(s.number.replace(/[0-9]/g, '')));
        const centerGroup = seats.filter((s: any) => ['D', 'E', 'F', 'G'].includes(s.number.replace(/[0-9]/g, '')));
        const rightGroup = seats.filter((s: any) => ['H', 'J', 'K', 'L'].includes(s.number.replace(/[0-9]/g, '')));

        return (
            <div key={row.rowNumber} className="flex items-center justify-center mb-1 group hover:bg-slate-100 rounded-md p-0.5 transition-colors relative">

                {/* Satır Numarası (Sol) - Sabit genişlik */}
                <div className="w-5 text-center text-[8px] text-slate-400 font-mono font-bold mr-1">
                    {row.rowNumber}
                </div>

                {/* SOL BLOK */}
                <div className="flex gap-[2px]">
                    {leftGroup.map((seat: any) => <SeatItem key={seat.number} seat={seat} userSeat={userSeat} />)}
                </div>

                {/* KORİDOR 1 */}
                <div className="w-4 flex items-center justify-center"></div>

                {/* ORTA BLOK (Varsa) */}
                {centerGroup.length > 0 && (
                    <>
                        <div className="flex gap-[2px]">
                            {centerGroup.map((seat: any) => <SeatItem key={seat.number} seat={seat} userSeat={userSeat} />)}
                        </div>
                        {/* KORİDOR 2 */}
                        <div className="w-4 flex items-center justify-center"></div>
                    </>
                )}

                {/* SAĞ BLOK */}
                <div className="flex gap-[2px]">
                    {rightGroup.map((seat: any) => <SeatItem key={seat.number} seat={seat} userSeat={userSeat} />)}
                </div>

                {/* Satır Numarası (Sağ) */}
                <div className="w-5 text-center text-[8px] text-slate-400 font-mono font-bold ml-1">
                    {row.rowNumber}
                </div>

            </div>
        );
    };

    return (
        <div className="bg-slate-50 p-4 rounded-[1.5rem] border-4 border-slate-200 shadow-inner max-w-2xl mx-auto relative overflow-hidden">

            {/* UÇAK BURNU (Gölge Efekti - Minimalist) */}
            <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-white/80 to-transparent pointer-events-none z-0"></div>

            {/* BAŞLIK */}
            <div className="text-center mb-6 relative z-10">
                <h3 className="text-sm font-black text-slate-800 tracking-tighter uppercase">
                    {layout.aircraftType === '77W' ? 'BOEING 777-300ER' : 'AIRBUS A320'}
                </h3>
                <div className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-0.5">
                    {isWideBody ? 'Business / Eco Config' : 'Ekonomi Sınıfı'}
                </div>
            </div>

            {/* KOLTUKLAR */}
            <div className="relative z-10 overflow-x-auto pb-4 max-h-[600px] overflow-y-auto custom-scrollbar">
                <div className="min-w-fit flex flex-col items-center">
                    {layout.rows.map((row: any) => renderRow(row))}
                </div>
            </div>

            {/* LEJANT (Legend) */}
            <div className="mt-3 flex flex-wrap justify-center gap-3 text-[9px] font-bold text-slate-500 relative z-10 border-t border-slate-200 pt-3">
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-white border border-slate-300 rounded-[2px]"></div> Boş</div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-slate-200 border border-slate-200 rounded-[2px] opacity-50"></div> Dolu</div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-purple-600 rounded-[2px]"></div> Sizin Yeriniz</div>
            </div>

        </div>
    );
}

// ✨ KOLTUK BİLEŞENİ (Kompakt - Omuzluklu)
function SeatItem({ seat, userSeat }: { seat: Seat, userSeat?: string | null }) {
    const isUser = seat.status === 'USER_SEAT' || (userSeat && seat.number === userSeat);
    const isOccupied = seat.status === 'OCCUPIED';
    const isRecommended = seat.status === 'RECOMMENDED';

    // Renk Mantığı
    let bgClass = 'bg-white border-slate-300 text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:shadow-sm cursor-pointer'; // Boş
    if (isOccupied) bgClass = 'bg-slate-200 border-slate-200 text-slate-300 cursor-not-allowed'; // Dolu
    if (isRecommended) bgClass = 'bg-emerald-50 border-emerald-400 text-emerald-600 animate-pulse ring-[0.5px] ring-emerald-200'; // Öneri
    if (isUser) bgClass = 'bg-purple-600 border-purple-600 text-white shadow-md shadow-purple-200 scale-105 z-20 ring-1 ring-purple-200'; // Bizimki

    return (
        <div className="relative group/seat">
            {/* Koltuk Gövdesi */}
            <div className={`
        w-6 h-8 rounded-t-lg rounded-b-[3px] border 
        flex flex-col items-center justify-center 
        text-[7px] font-bold transition-all duration-200
        ${bgClass}
        `}>
                {/* Koltuk Kafalığı (Headrest) */}
                <div className={`w-3 h-1 rounded-full mb-0.5 border-t border-black/5 mx-auto ${isUser ? 'bg-purple-400/50' : 'bg-slate-400/10'}`}></div>

                <span className="-mt-px">{isUser ? <User className="w-2.5 h-2.5" /> : seat.number.replace(/[0-9]/g, '')}</span>
            </div>

            {/* Tooltip */}
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] py-0.5 px-1.5 rounded opacity-0 group-hover/seat:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none shadow-sm">
                {seat.number} - {seat.status}
            </div>
        </div>
    );
}

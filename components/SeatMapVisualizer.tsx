'use client';

import { AircraftLayout, Seat } from '@/types/seatmap';
import { User, Info } from 'lucide-react';

export function SeatMapVisualizer({ layout, userSeat }: { layout: AircraftLayout, userSeat?: string | null }) {

    // Uçak Tipine Göre Konfigürasyon Belirle
    // 777/A350 (Geniş): 3 - 4 - 3
    // 737/A320 (Dar):   3 - 3
    const isWideBody = ['77W', '777', '350', '330', '787'].includes(layout.aircraftType);

    // Koltukları Bloklara Ayıran Fonksiyon
    const renderRow = (row: any) => {
        // Sadece gerçek koltukları al (AISLE olanları filtrele)
        const seats = row.seats.filter((s: any) => !s.isAisle);

        let leftGroup = [];
        let centerGroup = [];
        let rightGroup = [];

        if (isWideBody) {
            // 3 - 4 - 3 Düzeni
            leftGroup = seats.slice(0, 3);   // ABC
            centerGroup = seats.slice(3, 7); // DEFG
            rightGroup = seats.slice(7, 10); // HJK
        } else {
            // 3 - 3 Düzeni
            leftGroup = seats.slice(0, 3);   // ABC
            centerGroup = [];                // Yok
            rightGroup = seats.slice(3, 6);  // DEF
        }

        return (
            <div key={row.rowNumber} className="flex items-center justify-center mb-3 relative">

                {/* Satır Numarası (Sol) */}
                <span className="absolute left-2 text-[10px] text-slate-300 font-mono">{row.rowNumber}</span>

                {/* SOL BLOK */}
                <div className="flex gap-1">
                    {leftGroup.map((seat: any) => <SeatItem key={seat.number} seat={seat} userSeat={userSeat} />)}
                </div>

                {/* KORİDOR 1 (Geniş Boşluk) */}
                <div className="w-8 flex items-center justify-center text-[8px] text-slate-200">
                    {/* İsteğe bağlı: Koridor çizgisi veya halı deseni konabilir */}
                </div>

                {/* ORTA BLOK (Varsa) */}
                {centerGroup.length > 0 && (
                    <>
                        <div className="flex gap-1">
                            {centerGroup.map((seat: any) => <SeatItem key={seat.number} seat={seat} userSeat={userSeat} />)}
                        </div>
                        {/* KORİDOR 2 */}
                        <div className="w-8" />
                    </>
                )}

                {/* SAĞ BLOK */}
                <div className="flex gap-1">
                    {rightGroup.map((seat: any) => <SeatItem key={seat.number} seat={seat} userSeat={userSeat} />)}
                </div>

                {/* Satır Numarası (Sağ) */}
                <span className="absolute right-2 text-[10px] text-slate-300 font-mono">{row.rowNumber}</span>

            </div>
        );
    };

    return (
        <div className="bg-slate-50 p-8 rounded-[40px] border-4 border-slate-200 shadow-inner max-w-lg mx-auto relative overflow-hidden">

            {/* UÇAK BURNU (Kokpit Efekti) */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-16 bg-gradient-to-b from-slate-200 to-transparent rounded-b-full opacity-50 blur-xl"></div>

            {/* BAŞLIK */}
            <div className="text-center mb-10 relative z-10">
                <h3 className="text-lg font-black text-slate-800 tracking-tighter">
                    {layout.aircraftType === '77W' ? 'BOEING 777-300ER' : 'AIRBUS A320'}
                </h3>
                <div className="text-xs text-slate-400 font-medium uppercase tracking-widest mt-1">Ön Taraf (Cockpit)</div>
            </div>

            {/* KOLTUKLAR */}
            <div className="relative z-10">
                {layout.rows.map((row: any) => renderRow(row))}
            </div>

            {/* KANATLAR (Süsleme) */}
            <div className="absolute top-1/3 -left-10 w-8 h-64 bg-slate-200 rounded-r-full opacity-30"></div>
            <div className="absolute top-1/3 -right-10 w-8 h-64 bg-slate-200 rounded-l-full opacity-30"></div>

        </div>
    );
}

// ✨ KOLTUK BİLEŞENİ (Daha gerçekçi şekil)
function SeatItem({ seat, userSeat }: { seat: Seat, userSeat?: string | null }) {
    const isUser = seat.status === 'USER_SEAT' || (userSeat && seat.number === userSeat);
    const isOccupied = seat.status === 'OCCUPIED';
    const isRecommended = seat.status === 'RECOMMENDED';

    // Renk Mantığı
    let bgClass = 'bg-white border-slate-300 text-slate-400 hover:border-blue-400'; // Boş
    if (isOccupied) bgClass = 'bg-slate-200 border-slate-200 text-slate-300 cursor-not-allowed'; // Dolu
    if (isRecommended) bgClass = 'bg-emerald-100 border-emerald-400 text-emerald-600 animate-pulse'; // Öneri
    if (isUser) bgClass = 'bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-200 scale-110 z-20'; // Bizimki

    return (
        <div className={`
      w-8 h-10 rounded-t-lg rounded-b-md border-2 
      flex flex-col items-center justify-center 
      text-[9px] font-bold transition-all duration-200
      ${bgClass}
    `}>
            {/* Koltuk Başlığı (Görsel Detay) */}
            <div className={`w-4 h-1 rounded-full mb-1 ${isUser ? 'bg-purple-400' : 'bg-current opacity-20'}`}></div>

            {isUser ? <User className="w-3 h-3" /> : seat.number.replace(/[0-9]/g, '')}
        </div>
    );
}

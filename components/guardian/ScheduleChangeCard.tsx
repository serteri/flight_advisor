'use client';
import { ArrowRight, Octagon, Phone, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface Props {
    oldTime: string; // ISO String
    newTime: string; // ISO String
    airline: string;
}

export function ScheduleChangeCard({ oldTime, newTime, airline }: Props) {
    const oldDate = new Date(oldTime);
    const newDate = new Date(newTime);

    // Saat formatı (HH:mm)
    const formatTime = (date: Date) => date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    // Fark hesabı
    const diffMinutes = (newDate.getTime() - oldDate.getTime()) / 60000;
    const isEarlier = diffMinutes < 0;
    const absDiff = Math.abs(diffMinutes);

    return (
        <div className="bg-white border-l-4 border-amber-500 rounded-r-xl shadow-lg p-6 relative overflow-hidden">

            {/* Başlık */}
            <div className="flex items-start gap-4 mb-6">
                <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
                    <Octagon className="w-8 h-8" />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-slate-900">Uçuş Saati Değişti</h3>
                    <p className="text-slate-600">
                        {airline} havayolu kalkış saatini güncelledi.
                        {isEarlier ? (
                            <span className="font-bold text-red-600"> Lütfen dikkat, uçak {Math.floor(absDiff / 60)}sa {absDiff % 60}dk ERKEN kalkacak.</span>
                        ) : (
                            <span> Uçak {Math.floor(absDiff / 60)}sa {absDiff % 60}dk geç kalkacak.</span>
                        )}
                    </p>
                </div>
            </div>

            {/* Zaman Çizelgesi (Timeline Visual) */}
            <div className="flex items-center justify-center gap-4 md:gap-8 bg-slate-50 p-6 rounded-2xl mb-6">

                {/* ESKİ SAAT */}
                <div className="text-center opacity-50 grayscale">
                    <div className="text-xs font-bold uppercase text-slate-400 mb-1">Eski Plan</div>
                    <div className="text-2xl font-bold text-slate-600 line-through decoration-red-500 decoration-2">
                        {formatTime(oldDate)}
                    </div>
                    <div className="text-xs text-slate-400">{oldDate.toLocaleDateString('tr-TR')}</div>
                </div>

                <ArrowRight className="text-slate-300 w-8 h-8" />

                {/* YENİ SAAT */}
                <div className="text-center">
                    <div className="text-xs font-bold uppercase text-amber-600 mb-1">Yeni Plan</div>
                    <div className="text-4xl font-black text-slate-900">
                        {formatTime(newDate)}
                    </div>
                    <div className="text-xs text-slate-500 font-bold">{newDate.toLocaleDateString('tr-TR')}</div>
                </div>
            </div>

            {/* Aksiyon Butonları */}
            <div className="flex gap-3">
                <button className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md shadow-amber-200 transition-all">
                    <Phone className="w-4 h-4" />
                    Havayolunu Ara (Ücretsiz Değişim)
                </button>
                <button className="flex-1 bg-white border border-slate-300 text-slate-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50">
                    <Check className="w-4 h-4" />
                    Yeni Saati Onayla
                </button>
            </div>

        </div>
    );
}
